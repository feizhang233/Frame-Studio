"""Steps 8-9: direct nodal loads and consistent element load vectors."""

from __future__ import annotations

from collections.abc import Iterable
from numbers import Integral, Real

import numpy as np
from numpy.typing import ArrayLike, NDArray

from .assembly import calculate_element_dof_map, calculate_node_dof_map
from .models import DistributedLoad, FrameElement, NodalLoad


def _validate_positive_integer(name: str, value: int) -> None:
    if isinstance(value, (bool, np.bool_)) or not isinstance(value, Integral):
        raise TypeError(f"{name} must be a positive integer")
    if value <= 0:
        raise ValueError(f"{name} must be a positive integer")


def _validate_length(length: float) -> float:
    if isinstance(length, (bool, np.bool_)) or not isinstance(length, Real):
        raise TypeError("length must be a real number")
    if not np.isfinite(length):
        raise ValueError("length must be finite")
    if length <= 0.0:
        raise ValueError("length must be greater than zero")
    return float(length)


def _validated_vector(name: str, value: ArrayLike) -> NDArray[np.float64]:
    try:
        vector = np.asarray(value, dtype=float)
    except (TypeError, ValueError) as error:
        raise TypeError(f"{name} must be a numeric vector with 6 entries") from error

    if vector.shape != (6,):
        raise ValueError(f"{name} must have shape (6,)")
    if not np.all(np.isfinite(vector)):
        raise ValueError(f"{name} must contain only finite values")
    return vector


def _validated_transformation(value: ArrayLike) -> NDArray[np.float64]:
    try:
        transformation = np.asarray(value, dtype=float)
    except (TypeError, ValueError) as error:
        raise TypeError("transformation must be a numeric 6x6 matrix") from error

    if transformation.shape != (6, 6):
        raise ValueError("transformation must have shape (6, 6)")
    if not np.all(np.isfinite(transformation)):
        raise ValueError("transformation must contain only finite values")
    return transformation


def assemble_nodal_load_vector(
    number_of_nodes: int,
    nodal_loads: Iterable[NodalLoad],
) -> NDArray[np.float64]:
    """Assemble direct global nodal loads into ``P``.

    The entries at each node are ordered ``[Fx, Fy, Mz]`` and correspond to
    the displacement order ``[u, v, phi]``. Multiple loads at the same node
    are added.
    """
    _validate_positive_integer("number_of_nodes", number_of_nodes)
    load_vector = np.zeros(3 * int(number_of_nodes), dtype=float)

    for load in nodal_loads:
        if not isinstance(load, NodalLoad):
            raise TypeError("nodal_loads must contain only NodalLoad objects")
        if load.node_id > number_of_nodes:
            raise ValueError(
                f"NodalLoad references node {load.node_id}, outside "
                f"1..{number_of_nodes}"
            )

        dofs = calculate_node_dof_map(load.node_id)
        load_vector[dofs] += np.array([load.fx, load.fy, load.mz])

    return load_vector


def calculate_local_equivalent_nodal_load(
    element: FrameElement,
    distributed_load: DistributedLoad,
    length: float,
) -> NDArray[np.float64]:
    """Return the local consistent nodal load ``p0_local``.

    ``qx`` and ``qy`` vary linearly between their i- and j-end values. The
    result follows ``[u_i, v_i, phi_i, u_j, v_j, phi_j]``. It is the
    equivalent applied nodal load, not the sign-opposite fixed-end force.
    """
    if not isinstance(element, FrameElement):
        raise TypeError("element must be a FrameElement")
    if not isinstance(distributed_load, DistributedLoad):
        raise TypeError("distributed_load must be a DistributedLoad")
    if distributed_load.element_id != element.id:
        raise ValueError(
            f"DistributedLoad.element_id={distributed_load.element_id} does not "
            f"match FrameElement.id={element.id}"
        )

    L = _validate_length(length)
    qx_i = float(distributed_load.qx_i)
    qy_i = float(distributed_load.qy_i)
    qx_j = float(distributed_load.qx_j)
    qy_j = float(distributed_load.qy_j)

    return np.array(
        [
            L * (2.0 * qx_i + qx_j) / 6.0,
            L * (7.0 * qy_i + 3.0 * qy_j) / 20.0,
            L**2 * (3.0 * qy_i + 2.0 * qy_j) / 60.0,
            L * (qx_i + 2.0 * qx_j) / 6.0,
            L * (3.0 * qy_i + 7.0 * qy_j) / 20.0,
            -L**2 * (2.0 * qy_i + 3.0 * qy_j) / 60.0,
        ],
        dtype=float,
    )


def calculate_global_equivalent_nodal_load(
    local_load: ArrayLike,
    transformation: ArrayLike,
) -> NDArray[np.float64]:
    """Transform an element load vector using ``p0_global = T.T @ p0_local``."""
    local = _validated_vector("local_load", local_load)
    transform = _validated_transformation(transformation)
    return transform.T @ local


def assemble_equivalent_nodal_load_vector(
    number_of_nodes: int,
    element_loads: Iterable[tuple[FrameElement, ArrayLike]],
) -> NDArray[np.float64]:
    """Assemble global element equivalent loads into ``P0``.

    ``element_loads`` supplies one ``(element, p0_global)`` pair for every
    distributed-load contribution. Multiple loads on an element are allowed
    and are added through the same DOF map.
    """
    _validate_positive_integer("number_of_nodes", number_of_nodes)
    load_vector = np.zeros(3 * int(number_of_nodes), dtype=float)

    for contribution in element_loads:
        try:
            element, load_value = contribution
        except (TypeError, ValueError) as error:
            raise TypeError(
                "each contribution must be a (FrameElement, p0_global) pair"
            ) from error

        if not isinstance(element, FrameElement):
            raise TypeError("each contribution must start with a FrameElement")
        if element.node_i > number_of_nodes or element.node_j > number_of_nodes:
            raise ValueError(
                f"FrameElement {element.id} references a node outside "
                f"1..{number_of_nodes}"
            )

        dofs = calculate_element_dof_map(element)
        load_vector[dofs] += _validated_vector("p0_global", load_value)

    return load_vector
