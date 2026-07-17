"""Step 2: element length and direction cosines."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .models import FrameElement, Node


@dataclass(frozen=True, slots=True)
class ElementGeometry:
    """Geometry of a frame element directed from local end i to end j.

    Attributes:
        L: Element length [m].
        c: Direction cosine ``(x_j - x_i) / L`` [-].
        s: Direction cosine ``(y_j - y_i) / L`` [-].
    """

    L: float
    c: float
    s: float


def calculate_geometry(
    element: FrameElement,
    node_i: Node,
    node_j: Node,
) -> ElementGeometry:
    """Calculate ``L``, ``c`` and ``s`` for one element.

    The node arguments must follow the element's i-to-j connectivity. A
    zero-length element is rejected because its direction and stiffness are
    undefined.
    """
    if node_i.id != element.node_i:
        raise ValueError(
            f"node_i.id={node_i.id} does not match element.node_i={element.node_i}"
        )
    if node_j.id != element.node_j:
        raise ValueError(
            f"node_j.id={node_j.id} does not match element.node_j={element.node_j}"
        )

    dx = node_j.x - node_i.x
    dy = node_j.y - node_i.y
    length = float(np.hypot(dx, dy))

    if length == 0.0:
        raise ValueError(f"FrameElement {element.id} has zero length")

    return ElementGeometry(
        L=length,
        c=float(dx / length),
        s=float(dy / length),
    )

