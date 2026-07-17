"""Steps 10-11: prescribed displacements, solution, and reactions."""

from __future__ import annotations

from collections.abc import Iterable
from numbers import Integral

import numpy as np
from numpy.typing import ArrayLike, NDArray

from .assembly import calculate_node_dof_map
from .models import Support


def _validate_positive_integer(name: str, value: int) -> None:
    if isinstance(value, (bool, np.bool_)) or not isinstance(value, Integral):
        raise TypeError(f"{name} must be a positive integer")
    if value <= 0:
        raise ValueError(f"{name} must be a positive integer")


def _validated_global_stiffness(value: ArrayLike) -> NDArray[np.float64]:
    try:
        stiffness = np.asarray(value, dtype=float)
    except (TypeError, ValueError) as error:
        raise TypeError("global_stiffness must be a numeric square matrix") from error

    if stiffness.ndim != 2 or stiffness.shape[0] != stiffness.shape[1]:
        raise ValueError("global_stiffness must be a square matrix")
    if stiffness.shape[0] == 0 or stiffness.shape[0] % 3 != 0:
        raise ValueError("global_stiffness size must equal 3 times the node count")
    if not np.all(np.isfinite(stiffness)):
        raise ValueError("global_stiffness must contain only finite values")
    return stiffness


def _validated_global_vector(
    name: str,
    value: ArrayLike,
    total_dofs: int,
) -> NDArray[np.float64]:
    try:
        vector = np.asarray(value, dtype=float)
    except (TypeError, ValueError) as error:
        raise TypeError(f"{name} must be a numeric vector") from error

    if vector.shape != (total_dofs,):
        raise ValueError(f"{name} must have shape ({total_dofs},)")
    if not np.all(np.isfinite(vector)):
        raise ValueError(f"{name} must contain only finite values")
    return vector


def assemble_support_transformation(
    number_of_nodes: int,
    supports: Iterable[Support],
) -> NDArray[np.float64]:
    """Return ``S`` such that ``d_support = S @ d_global``.

    Each support angle rotates the two translational axes at its node while
    leaving the out-of-plane rotation unchanged. Nodes without a support use
    the global axes. Repeated support records at one node must use the same
    orientation.
    """
    _validate_positive_integer("number_of_nodes", number_of_nodes)
    transformation = np.eye(3 * int(number_of_nodes), dtype=float)
    orientations: dict[int, tuple[float, float]] = {}

    for support in supports:
        if not isinstance(support, Support):
            raise TypeError("supports must contain only Support objects")
        if support.node_id > number_of_nodes:
            raise ValueError(
                f"Support references node {support.node_id}, outside "
                f"1..{number_of_nodes}"
            )

        angle = np.deg2rad(float(support.angle))
        c = float(np.cos(angle))
        s = float(np.sin(angle))
        previous = orientations.get(support.node_id)
        if previous is not None and not np.allclose(
            previous,
            (c, s),
            rtol=0.0,
            atol=1.0e-12,
        ):
            raise ValueError(
                f"conflicting support angles at node {support.node_id}"
            )
        orientations[support.node_id] = (c, s)

        dofs = calculate_node_dof_map(support.node_id)
        transformation[np.ix_(dofs, dofs)] = np.array(
            [
                [c, s, 0.0],
                [-s, c, 0.0],
                [0.0, 0.0, 1.0],
            ],
            dtype=float,
        )

    return transformation


def partition_dofs(
    number_of_nodes: int,
    supports: Iterable[Support],
) -> tuple[NDArray[np.int64], NDArray[np.int64]]:
    """Return ``(free_dofs, restrained_dofs)`` as zero-based indices.

    Support flags always correspond to ``[u, v, phi]``. Repeated support
    records at a node are combined, so a DOF is restrained if any record
    restrains it.
    """
    support_records = tuple(supports)
    assemble_support_transformation(number_of_nodes, support_records)
    restrained_mask, _ = _collect_prescribed_displacements(
        number_of_nodes,
        support_records,
    )

    free_dofs = np.flatnonzero(~restrained_mask).astype(np.int64)
    restrained_dofs = np.flatnonzero(restrained_mask).astype(np.int64)
    return free_dofs, restrained_dofs


def _collect_prescribed_displacements(
    number_of_nodes: int,
    supports: Iterable[Support],
) -> tuple[NDArray[np.bool_], NDArray[np.float64]]:
    """Validate supports and return restraint mask plus prescribed values."""
    _validate_positive_integer("number_of_nodes", number_of_nodes)
    total_dofs = 3 * int(number_of_nodes)
    restrained_mask = np.zeros(total_dofs, dtype=bool)
    prescribed_values = np.zeros(total_dofs, dtype=float)

    for support in supports:
        if not isinstance(support, Support):
            raise TypeError("supports must contain only Support objects")
        if support.node_id > number_of_nodes:
            raise ValueError(
                f"Support references node {support.node_id}, outside "
                f"1..{number_of_nodes}"
            )

        node_dofs = calculate_node_dof_map(support.node_id)
        restraint_flags = np.asarray(support.restraints, dtype=bool)
        support_values = np.asarray(support.prescribed_values, dtype=float)
        for dof, value in zip(
            node_dofs[restraint_flags],
            support_values[restraint_flags],
            strict=True,
        ):
            if restrained_mask[dof] and prescribed_values[dof] != value:
                raise ValueError(
                    f"conflicting prescribed displacement values at global "
                    f"DOF {int(dof)}"
                )
            restrained_mask[dof] = True
            prescribed_values[dof] = value

    return restrained_mask, prescribed_values


def assemble_prescribed_displacement_vector(
    number_of_nodes: int,
    supports: Iterable[Support],
) -> NDArray[np.float64]:
    """Return the complete support-local prescribed vector ``d_c``.

    Entries at free DOFs are zero placeholders. Use :func:`partition_dofs` to
    distinguish free DOFs from genuinely prescribed zero displacements.
    """
    support_records = tuple(supports)
    assemble_support_transformation(number_of_nodes, support_records)
    _, prescribed_values = _collect_prescribed_displacements(
        number_of_nodes,
        support_records,
    )
    return prescribed_values


def solve_displacements(
    global_stiffness: ArrayLike,
    total_load: ArrayLike,
    supports: Iterable[Support],
) -> NDArray[np.float64]:
    """Solve the free displacements and return the complete vector ``d``.

    The global system is first rotated to support-local axes. For arbitrary
    prescribed displacements, the reduced support-coordinate system is
    ``K_ff @ d_f = P_total_f - K_fc @ d_c``. ``numpy.linalg.solve`` is used;
    the reduced stiffness matrix is never explicitly inverted. The returned
    displacement vector is transformed back to global axes.
    """
    global_matrix = _validated_global_stiffness(global_stiffness)
    total_dofs = global_matrix.shape[0]
    global_load = _validated_global_vector("total_load", total_load, total_dofs)
    number_of_nodes = total_dofs // 3
    support_records = tuple(supports)
    support_transformation = assemble_support_transformation(
        number_of_nodes,
        support_records,
    )
    stiffness = support_transformation @ global_matrix @ support_transformation.T
    load = support_transformation @ global_load
    free_dofs, restrained_dofs = partition_dofs(
        number_of_nodes,
        support_records,
    )

    support_displacements = assemble_prescribed_displacement_vector(
        number_of_nodes,
        support_records,
    )
    if free_dofs.size == 0:
        return support_transformation.T @ support_displacements

    reduced_stiffness = stiffness[np.ix_(free_dofs, free_dofs)]
    coupling_stiffness = stiffness[np.ix_(free_dofs, restrained_dofs)]
    reduced_load = (
        load[free_dofs]
        - coupling_stiffness @ support_displacements[restrained_dofs]
    )
    try:
        support_displacements[free_dofs] = np.linalg.solve(
            reduced_stiffness,
            reduced_load,
        )
    except np.linalg.LinAlgError as error:
        raise np.linalg.LinAlgError(
            "reduced stiffness matrix K_ff is singular; check supports, "
            "connectivity, and element properties"
        ) from error

    return support_transformation.T @ support_displacements


def calculate_reaction_vector(
    global_stiffness: ArrayLike,
    displacements: ArrayLike,
    total_load: ArrayLike,
) -> NDArray[np.float64]:
    """Return the complete residual/reaction vector ``R = K @ d - P_total``.

    The result is expressed in global ``[X, Y, Mz]`` directions. With an
    inclined support, both global translational components may be nonzero;
    transform the residual to support-local axes before checking which
    constrained/free directional components vanish.
    """
    stiffness = _validated_global_stiffness(global_stiffness)
    total_dofs = stiffness.shape[0]
    displacement_vector = _validated_global_vector(
        "displacements",
        displacements,
        total_dofs,
    )
    load = _validated_global_vector("total_load", total_load, total_dofs)
    return stiffness @ displacement_vector - load
