"""High-level orchestration for a complete 2D frame analysis."""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from numbers import Integral, Real

import numpy as np
from numpy.typing import NDArray

from .assembly import assemble_global_stiffness
from .geometry import ElementGeometry, calculate_geometry
from .global_stiffness import calculate_global_stiffness
from .loads import (
    assemble_equivalent_nodal_load_vector,
    assemble_nodal_load_vector,
    calculate_global_equivalent_nodal_load,
    calculate_local_equivalent_nodal_load,
)
from .models import DistributedLoad, FrameElement, NodalLoad, Node, Support
from .postprocessing import (
    ElementEquilibriumValidation,
    ElementFieldResults,
    GlobalValidation,
    calculate_element_field_results,
    reshape_nodal_displacements,
    validate_element_equilibrium,
    validate_global_solution,
)
from .recovery import recover_element_end_response
from .solution import (
    assemble_support_transformation,
    calculate_reaction_vector,
    partition_dofs,
    solve_displacements,
)
from .stiffness import calculate_local_stiffness
from .transformation import calculate_transformation


@dataclass(frozen=True, slots=True)
class ElementAnalysisResult:
    """Recovered geometry, end response, fields, and checks for one element."""

    element_id: int
    geometry: ElementGeometry
    local_displacements: NDArray[np.float64]
    local_end_forces: NDArray[np.float64]
    fields: ElementFieldResults
    validation: ElementEquilibriumValidation


@dataclass(frozen=True, slots=True)
class FrameAnalysisResult:
    """Complete numerical result for a frame model."""

    displacements: NDArray[np.float64]
    nodal_displacements: NDArray[np.float64]
    reactions: NDArray[np.float64]
    free_dofs: NDArray[np.int64]
    restrained_dofs: NDArray[np.int64]
    elements: tuple[ElementAnalysisResult, ...]
    validation: GlobalValidation


@dataclass(frozen=True, slots=True)
class _ElementMatrices:
    geometry: ElementGeometry
    local_stiffness: NDArray[np.float64]
    transformation: NDArray[np.float64]
    global_stiffness: NDArray[np.float64]
    local_equivalent_load: NDArray[np.float64]


def _materialize_typed(
    name: str,
    values: Iterable[object],
    expected_type: type,
) -> tuple:
    materialized = tuple(values)
    if not all(isinstance(value, expected_type) for value in materialized):
        raise TypeError(f"{name} must contain only {expected_type.__name__} objects")
    return materialized


def _validate_sampling(number_of_points: int, deformation_scale: float) -> None:
    if isinstance(number_of_points, (bool, np.bool_)) or not isinstance(
        number_of_points,
        Integral,
    ):
        raise TypeError("number_of_points must be an integer")
    if number_of_points < 2:
        raise ValueError("number_of_points must be at least 2")
    if isinstance(deformation_scale, (bool, np.bool_)) or not isinstance(
        deformation_scale,
        Real,
    ):
        raise TypeError("deformation_scale must be a real number")
    if not np.isfinite(deformation_scale):
        raise ValueError("deformation_scale must be finite")


def _validate_model(
    nodes: tuple[Node, ...],
    elements: tuple[FrameElement, ...],
    supports: tuple[Support, ...],
    nodal_loads: tuple[NodalLoad, ...],
    distributed_loads: tuple[DistributedLoad, ...],
) -> None:
    if not nodes:
        raise ValueError("nodes must contain at least one node")
    if not elements:
        raise ValueError("elements must contain at least one element")

    node_ids = [node.id for node in nodes]
    expected_node_ids = list(range(1, len(nodes) + 1))
    if sorted(node_ids) != expected_node_ids:
        raise ValueError(
            "Node.id values must be unique and contiguous from 1 to the node count"
        )

    element_ids = [element.id for element in elements]
    if len(set(element_ids)) != len(element_ids):
        raise ValueError("FrameElement.id values must be unique")

    known_nodes = set(node_ids)
    for element in elements:
        if element.node_i not in known_nodes or element.node_j not in known_nodes:
            raise ValueError(f"FrameElement {element.id} references an unknown node")
    for support in supports:
        if support.node_id not in known_nodes:
            raise ValueError(f"Support references unknown node {support.node_id}")
    for load in nodal_loads:
        if load.node_id not in known_nodes:
            raise ValueError(f"NodalLoad references unknown node {load.node_id}")

    known_elements = set(element_ids)
    for load in distributed_loads:
        if load.element_id not in known_elements:
            raise ValueError(
                f"DistributedLoad references unknown element {load.element_id}"
            )


def solve_frame(
    nodes: Iterable[Node],
    elements: Iterable[FrameElement],
    supports: Iterable[Support],
    nodal_loads: Iterable[NodalLoad] = (),
    distributed_loads: Iterable[DistributedLoad] = (),
    *,
    number_of_points: int = 101,
    deformation_scale: float = 1.0,
) -> FrameAnalysisResult:
    """Assemble, solve, recover, sample, and validate a complete frame model.

    Node identifiers must be contiguous from 1 because they define positions
    in the global degree-of-freedom vector. Element identifiers only need to
    be positive and unique.
    """
    node_records = _materialize_typed("nodes", nodes, Node)
    element_records = _materialize_typed("elements", elements, FrameElement)
    support_records = _materialize_typed("supports", supports, Support)
    nodal_load_records = _materialize_typed(
        "nodal_loads",
        nodal_loads,
        NodalLoad,
    )
    distributed_load_records = _materialize_typed(
        "distributed_loads",
        distributed_loads,
        DistributedLoad,
    )
    _validate_sampling(number_of_points, deformation_scale)
    _validate_model(
        node_records,
        element_records,
        support_records,
        nodal_load_records,
        distributed_load_records,
    )

    nodes_by_id = {node.id: node for node in node_records}
    loads_by_element: dict[int, list[DistributedLoad]] = {
        element.id: [] for element in element_records
    }
    for load in distributed_load_records:
        loads_by_element[load.element_id].append(load)

    element_matrices: dict[int, _ElementMatrices] = {}
    stiffness_contributions = []
    equivalent_load_contributions = []
    for element in element_records:
        geometry = calculate_geometry(
            element,
            nodes_by_id[element.node_i],
            nodes_by_id[element.node_j],
        )
        local_stiffness = calculate_local_stiffness(element, geometry.L)
        transformation = calculate_transformation(geometry)
        global_stiffness = calculate_global_stiffness(
            local_stiffness,
            transformation,
        )
        local_equivalent_load = np.zeros(6, dtype=float)
        for load in loads_by_element[element.id]:
            local_equivalent_load += calculate_local_equivalent_nodal_load(
                element,
                load,
                geometry.L,
            )
        global_equivalent_load = calculate_global_equivalent_nodal_load(
            local_equivalent_load,
            transformation,
        )

        element_matrices[element.id] = _ElementMatrices(
            geometry=geometry,
            local_stiffness=local_stiffness,
            transformation=transformation,
            global_stiffness=global_stiffness,
            local_equivalent_load=local_equivalent_load,
        )
        stiffness_contributions.append((element, global_stiffness))
        equivalent_load_contributions.append((element, global_equivalent_load))

    number_of_nodes = len(node_records)
    global_stiffness = assemble_global_stiffness(
        number_of_nodes,
        stiffness_contributions,
    )
    nodal_load_vector = assemble_nodal_load_vector(
        number_of_nodes,
        nodal_load_records,
    )
    equivalent_load_vector = assemble_equivalent_nodal_load_vector(
        number_of_nodes,
        equivalent_load_contributions,
    )
    total_load = nodal_load_vector + equivalent_load_vector

    free_dofs, restrained_dofs = partition_dofs(number_of_nodes, support_records)
    support_transformation = assemble_support_transformation(
        number_of_nodes,
        support_records,
    )
    displacements = solve_displacements(
        global_stiffness,
        total_load,
        support_records,
    )
    reactions = calculate_reaction_vector(
        global_stiffness,
        displacements,
        total_load,
    )

    element_results = []
    for element in element_records:
        matrices = element_matrices[element.id]
        end_response = recover_element_end_response(
            element,
            displacements,
            matrices.local_stiffness,
            matrices.transformation,
            matrices.local_equivalent_load,
        )
        fields = calculate_element_field_results(
            element,
            nodes_by_id[element.node_i],
            nodes_by_id[element.node_j],
            matrices.geometry,
            end_response.local_displacements,
            end_response.local_end_forces,
            loads_by_element[element.id],
            number_of_points=int(number_of_points),
            deformation_scale=float(deformation_scale),
        )
        validation = validate_element_equilibrium(
            element,
            end_response.local_end_forces,
            matrices.geometry.L,
            loads_by_element[element.id],
        )
        element_results.append(
            ElementAnalysisResult(
                element_id=element.id,
                geometry=matrices.geometry,
                local_displacements=end_response.local_displacements,
                local_end_forces=end_response.local_end_forces,
                fields=fields,
                validation=validation,
            )
        )

    validation = validate_global_solution(
        support_transformation @ global_stiffness @ support_transformation.T,
        support_transformation @ displacements,
        support_transformation @ total_load,
        free_dofs,
    )
    return FrameAnalysisResult(
        displacements=displacements,
        nodal_displacements=reshape_nodal_displacements(displacements),
        reactions=reactions,
        free_dofs=free_dofs,
        restrained_dofs=restrained_dofs,
        elements=tuple(element_results),
        validation=validation,
    )
