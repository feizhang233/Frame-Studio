"""Step 4: displacement transformation matrix for a 2D frame element."""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

from .geometry import ElementGeometry


def calculate_transformation(
    geometry: ElementGeometry,
) -> NDArray[np.float64]:
    """Return the 6x6 matrix that maps global DOFs to local DOFs.

    With local +x directed from i to j and local +y obtained by a 90-degree
    counter-clockwise rotation, the convention is

    ``d_local = T @ d_global``.

    Both displacement vectors use the order
    ``[u_i, v_i, phi_i, u_j, v_j, phi_j]`` in their respective coordinates.
    """
    c = float(geometry.c)
    s = float(geometry.s)

    if not (np.isfinite(c) and np.isfinite(s)):
        raise ValueError("direction cosines must be finite")
    if not np.isclose(c * c + s * s, 1.0, rtol=1.0e-12, atol=1.0e-12):
        raise ValueError("direction cosines must satisfy c^2 + s^2 = 1")

    return np.array(
        [
            [c, s, 0.0, 0.0, 0.0, 0.0],
            [-s, c, 0.0, 0.0, 0.0, 0.0],
            [0.0, 0.0, 1.0, 0.0, 0.0, 0.0],
            [0.0, 0.0, 0.0, c, s, 0.0],
            [0.0, 0.0, 0.0, -s, c, 0.0],
            [0.0, 0.0, 0.0, 0.0, 0.0, 1.0],
        ],
        dtype=float,
    )

