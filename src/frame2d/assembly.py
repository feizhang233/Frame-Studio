"""Steps 6-7: global DOF mapping and stiffness-matrix assembly."""

from __future__ import annotations

from collections.abc import Iterable
from numbers import Integral

import numpy as np
from numpy.typing import ArrayLike, NDArray

from .models import FrameElement


def _validate_positive_integer(name: str, value: int) -> None:
    if isinstance(value, (bool, np.bool_)) or not isinstance(value, Integral):
        raise TypeError(f"{name} must be a positive integer")
    if value <= 0:
        raise ValueError(f"{name} must be a positive integer")


def _validate_element_stiffness(value: ArrayLike) -> NDArray[np.float64]:
    try:
        stiffness = np.asarray(value, dtype=float)
    except (TypeError, ValueError) as error:
        raise TypeError("element stiffness must be a numeric 6x6 matrix") from error

    if stiffness.shape != (6, 6):
        raise ValueError("element stiffness must have shape (6, 6)")
    if not np.all(np.isfinite(stiffness)):
        raise ValueError("element stiffness must contain only finite values")
    return stiffness


def calculate_node_dof_map(node_id: int) -> NDArray[np.int64]:
    """Return the zero-based global indices for node DOFs ``[u, v, phi]``.

    The mathematical one-based indices ``[3n-2, 3n-1, 3n]`` become
    ``[3n-3, 3n-2, 3n-1]`` when used as NumPy array indices.
    """
    _validate_positive_integer("node_id", node_id)
    first_dof = 3 * (int(node_id) - 1)
    return np.arange(first_dof, first_dof + 3, dtype=np.int64)


def calculate_element_dof_map(element: FrameElement) -> NDArray[np.int64]:
    """Return global indices in element order.

    The fixed order is
    ``[u_i, v_i, phi_i, u_j, v_j, phi_j]``.
    """
    return np.concatenate(
        (
            calculate_node_dof_map(element.node_i),
            calculate_node_dof_map(element.node_j),
        )
    )


def assemble_global_stiffness(
    number_of_nodes: int,
    element_stiffnesses: Iterable[tuple[FrameElement, ArrayLike]],
) -> NDArray[np.float64]:
    """Assemble and return the ``(3N, 3N)`` global stiffness matrix.

    ``element_stiffnesses`` supplies one ``(element, k_global)`` pair per
    element. Node identifiers must be within ``1..number_of_nodes``. Each
    contribution is assembled as ``K[I_e, I_e] += k_global`` using the full
    Cartesian index product.
    """
    _validate_positive_integer("number_of_nodes", number_of_nodes)
    total_dofs = 3 * int(number_of_nodes)
    global_stiffness = np.zeros((total_dofs, total_dofs), dtype=float)

    for contribution in element_stiffnesses:
        try:
            element, stiffness_value = contribution
        except (TypeError, ValueError) as error:
            raise TypeError(
                "each contribution must be a (FrameElement, k_global) pair"
            ) from error

        if not isinstance(element, FrameElement):
            raise TypeError("each contribution must start with a FrameElement")
        if element.node_i > number_of_nodes or element.node_j > number_of_nodes:
            raise ValueError(
                f"FrameElement {element.id} references a node outside "
                f"1..{number_of_nodes}"
            )

        dofs = calculate_element_dof_map(element)
        stiffness = _validate_element_stiffness(stiffness_value)
        global_stiffness[np.ix_(dofs, dofs)] += stiffness

    return global_stiffness
