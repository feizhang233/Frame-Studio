"""Step 3: Euler-Bernoulli 2D frame local stiffness matrix."""

from __future__ import annotations

from numbers import Real

import numpy as np
from numpy.typing import NDArray

from .models import FrameElement


def calculate_local_stiffness(
    element: FrameElement,
    length: float,
) -> NDArray[np.float64]:
    """Return the 6x6 local stiffness matrix for a prismatic frame element.

    The local DOF order is fixed as
    ``[u_i, v_i, phi_i, u_j, v_j, phi_j]``. Local +x runs from i to j,
    local +y is 90 degrees counter-clockwise from local +x, and positive
    rotation is counter-clockwise.

    Euler-Bernoulli bending is used, so shear deformation is not included.
    """
    if isinstance(length, (bool, np.bool_)) or not isinstance(length, Real):
        raise TypeError("length must be a real number")
    if not np.isfinite(length):
        raise ValueError("length must be finite")
    if length <= 0.0:
        raise ValueError("length must be greater than zero")

    E = float(element.E)
    A = float(element.A)
    I = float(element.I)
    L = float(length)

    axial = E * A / L
    bending_12 = 12.0 * E * I / L**3
    bending_6 = 6.0 * E * I / L**2
    bending_4 = 4.0 * E * I / L
    bending_2 = 2.0 * E * I / L

    return np.array(
        [
            [axial, 0.0, 0.0, -axial, 0.0, 0.0],
            [0.0, bending_12, bending_6, 0.0, -bending_12, bending_6],
            [0.0, bending_6, bending_4, 0.0, -bending_6, bending_2],
            [-axial, 0.0, 0.0, axial, 0.0, 0.0],
            [0.0, -bending_12, -bending_6, 0.0, bending_12, -bending_6],
            [0.0, bending_6, bending_2, 0.0, -bending_6, bending_4],
        ],
        dtype=float,
    )

