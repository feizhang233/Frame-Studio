"""Step 12: recover element-local displacements and nodal end forces."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from numpy.typing import ArrayLike, NDArray

from .assembly import calculate_element_dof_map
from .models import FrameElement


def _validated_vector(
    name: str,
    value: ArrayLike,
    expected_size: int,
) -> NDArray[np.float64]:
    try:
        vector = np.asarray(value, dtype=float)
    except (TypeError, ValueError) as error:
        raise TypeError(f"{name} must be a numeric vector") from error

    if vector.shape != (expected_size,):
        raise ValueError(f"{name} must have shape ({expected_size},)")
    if not np.all(np.isfinite(vector)):
        raise ValueError(f"{name} must contain only finite values")
    return vector


def _validated_element_matrix(name: str, value: ArrayLike) -> NDArray[np.float64]:
    try:
        matrix = np.asarray(value, dtype=float)
    except (TypeError, ValueError) as error:
        raise TypeError(f"{name} must be a numeric 6x6 matrix") from error

    if matrix.shape != (6, 6):
        raise ValueError(f"{name} must have shape (6, 6)")
    if not np.all(np.isfinite(matrix)):
        raise ValueError(f"{name} must contain only finite values")
    return matrix


@dataclass(frozen=True, slots=True)
class ElementEndResponse:
    """Recovered vectors for one element.

    All three vectors use the fixed order
    ``[u_i, v_i, phi_i, u_j, v_j, phi_j]``. ``global_displacements`` is the
    six-entry vector extracted from the complete structural displacement
    vector. ``local_end_forces`` follows
    ``[fx_i, fy_i, m_i, fx_j, fy_j, m_j]`` in local coordinates.
    """

    global_displacements: NDArray[np.float64]
    local_displacements: NDArray[np.float64]
    local_end_forces: NDArray[np.float64]


def extract_element_displacements(
    element: FrameElement,
    displacements: ArrayLike,
) -> NDArray[np.float64]:
    """Extract ``d_e`` from the complete global displacement vector ``d``."""
    if not isinstance(element, FrameElement):
        raise TypeError("element must be a FrameElement")

    try:
        global_displacements = np.asarray(displacements, dtype=float)
    except (TypeError, ValueError) as error:
        raise TypeError("displacements must be a numeric vector") from error

    if global_displacements.ndim != 1 or global_displacements.size == 0:
        raise ValueError("displacements must be a non-empty vector")
    if global_displacements.size % 3 != 0:
        raise ValueError("displacements size must equal 3 times the node count")
    if not np.all(np.isfinite(global_displacements)):
        raise ValueError("displacements must contain only finite values")

    number_of_nodes = global_displacements.size // 3
    if element.node_i > number_of_nodes or element.node_j > number_of_nodes:
        raise ValueError(
            f"FrameElement {element.id} references a node outside "
            f"1..{number_of_nodes}"
        )

    return global_displacements[calculate_element_dof_map(element)].copy()


def recover_local_displacements(
    element_displacements: ArrayLike,
    transformation: ArrayLike,
) -> NDArray[np.float64]:
    """Return ``d_local = T @ d_e`` for one element."""
    element_vector = _validated_vector(
        "element_displacements",
        element_displacements,
        6,
    )
    transform = _validated_element_matrix("transformation", transformation)
    return transform @ element_vector


def recover_local_end_forces(
    local_stiffness: ArrayLike,
    local_displacements: ArrayLike,
    local_equivalent_nodal_load: ArrayLike | None = None,
) -> NDArray[np.float64]:
    """Return ``q_local = k_local @ d_local - p0_local``.

    ``p0_local`` is the applied consistent equivalent nodal load, not the
    sign-opposite fixed-end force. It defaults to zero for an unloaded member.
    """
    stiffness = _validated_element_matrix("local_stiffness", local_stiffness)
    displacement_vector = _validated_vector(
        "local_displacements",
        local_displacements,
        6,
    )
    if local_equivalent_nodal_load is None:
        equivalent_load = np.zeros(6, dtype=float)
    else:
        equivalent_load = _validated_vector(
            "local_equivalent_nodal_load",
            local_equivalent_nodal_load,
            6,
        )

    return stiffness @ displacement_vector - equivalent_load


def recover_element_end_response(
    element: FrameElement,
    displacements: ArrayLike,
    local_stiffness: ArrayLike,
    transformation: ArrayLike,
    local_equivalent_nodal_load: ArrayLike | None = None,
) -> ElementEndResponse:
    """Perform the complete Step 12 recovery for one element."""
    element_displacements = extract_element_displacements(element, displacements)
    local_displacements = recover_local_displacements(
        element_displacements,
        transformation,
    )
    local_end_forces = recover_local_end_forces(
        local_stiffness,
        local_displacements,
        local_equivalent_nodal_load,
    )
    return ElementEndResponse(
        global_displacements=element_displacements,
        local_displacements=local_displacements,
        local_end_forces=local_end_forces,
    )
