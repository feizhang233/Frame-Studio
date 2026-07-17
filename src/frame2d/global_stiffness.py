"""Step 5: transform one element stiffness matrix to global coordinates."""

from __future__ import annotations

import numpy as np
from numpy.typing import ArrayLike, NDArray


def _validated_matrix(name: str, value: ArrayLike) -> NDArray[np.float64]:
    try:
        matrix = np.asarray(value, dtype=float)
    except (TypeError, ValueError) as error:
        raise TypeError(f"{name} must be a numeric 6x6 matrix") from error

    if matrix.shape != (6, 6):
        raise ValueError(f"{name} must have shape (6, 6)")
    if not np.all(np.isfinite(matrix)):
        raise ValueError(f"{name} must contain only finite values")
    return matrix


def calculate_global_stiffness(
    k_local: ArrayLike,
    transformation: ArrayLike,
) -> NDArray[np.float64]:
    """Return ``k_global = T.T @ k_local @ T`` for one frame element.

    This follows the Step 4 convention ``d_local = T @ d_global`` and does
    not compute or use an explicit matrix inverse.
    """
    local = _validated_matrix("k_local", k_local)
    transform = _validated_matrix("transformation", transformation)
    return transform.T @ local @ transform

