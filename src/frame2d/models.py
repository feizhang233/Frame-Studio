"""Step 1: validated input records for a planar frame model.

No element geometry, stiffness, transformation, assembly, or solution is
performed in this module.
"""

from __future__ import annotations

from dataclasses import dataclass
from numbers import Integral, Real

import numpy as np


def _validate_id(name: str, value: int) -> None:
    """Require a positive integer identifier (booleans are not identifiers)."""
    if isinstance(value, (bool, np.bool_)) or not isinstance(value, Integral):
        raise TypeError(f"{name} must be a positive integer")
    if value <= 0:
        raise ValueError(f"{name} must be a positive integer")


def _validate_finite(name: str, value: float) -> None:
    """Require one finite real scalar."""
    if isinstance(value, (bool, np.bool_)) or not isinstance(value, Real):
        raise TypeError(f"{name} must be a real number")
    if not np.isfinite(value):
        raise ValueError(f"{name} must be finite")


def _validate_positive(name: str, value: float) -> None:
    _validate_finite(name, value)
    if value <= 0.0:
        raise ValueError(f"{name} must be greater than zero")


def _validate_bool(name: str, value: bool) -> None:
    if not isinstance(value, (bool, np.bool_)):
        raise TypeError(f"{name} must be a boolean")


@dataclass(frozen=True, slots=True)
class Node:
    """A frame node in the global X-Y plane.

    Attributes:
        id: Positive, model-wide unique node identifier.
        x: Global X coordinate [m].
        y: Global Y coordinate [m].

    The three nodal degrees of freedom are always ordered ``[u, v, phi]``.
    """

    id: int
    x: float
    y: float

    def __post_init__(self) -> None:
        _validate_id("Node.id", self.id)
        _validate_finite("Node.x", self.x)
        _validate_finite("Node.y", self.y)


@dataclass(frozen=True, slots=True)
class FrameElement:
    """A two-node, prismatic 2D frame element.

    Attributes:
        id: Positive, model-wide unique element identifier.
        node_i: Identifier of the element's local i-end node.
        node_j: Identifier of the element's local j-end node.
        E: Young's modulus [Pa = N/m^2].
        A: Cross-sectional area [m^2].
        I: Second moment of area about the out-of-plane axis [m^4].

    Element DOFs will always be ordered
    ``[u_i, v_i, phi_i, u_j, v_j, phi_j]``.
    """

    id: int
    node_i: int
    node_j: int
    E: float
    A: float
    I: float

    def __post_init__(self) -> None:
        _validate_id("FrameElement.id", self.id)
        _validate_id("FrameElement.node_i", self.node_i)
        _validate_id("FrameElement.node_j", self.node_j)
        if self.node_i == self.node_j:
            raise ValueError("FrameElement.node_i and node_j must be different")
        _validate_positive("FrameElement.E", self.E)
        _validate_positive("FrameElement.A", self.A)
        _validate_positive("FrameElement.I", self.I)


@dataclass(frozen=True, slots=True)
class Support:
    """Prescribed nodal displacements in support-local ``[u, v, phi]`` axes.

    A ``True`` restraint flag means that the corresponding displacement is
    prescribed. Its value is supplied by ``u_value`` or ``v_value`` [m], or
    ``phi_value`` [rad], and defaults to zero. A ``False`` flag means that the
    DOF is free and its associated value must remain zero. ``angle`` rotates
    the support-local +u axis counter-clockwise from global +X [degrees]; the
    local +v axis is 90 degrees counter-clockwise from local +u.
    """

    node_id: int
    u: bool = False
    v: bool = False
    phi: bool = False
    u_value: float = 0.0
    v_value: float = 0.0
    phi_value: float = 0.0
    angle: float = 0.0

    def __post_init__(self) -> None:
        _validate_id("Support.node_id", self.node_id)
        _validate_bool("Support.u", self.u)
        _validate_bool("Support.v", self.v)
        _validate_bool("Support.phi", self.phi)
        _validate_finite("Support.u_value", self.u_value)
        _validate_finite("Support.v_value", self.v_value)
        _validate_finite("Support.phi_value", self.phi_value)
        _validate_finite("Support.angle", self.angle)
        if not (self.u or self.v or self.phi):
            raise ValueError("Support must restrain at least one DOF")
        for name, restrained, value in zip(
            ("u", "v", "phi"),
            self.restraints,
            self.prescribed_values,
            strict=True,
        ):
            if not restrained and value != 0.0:
                raise ValueError(
                    f"Support.{name}_value must be zero when Support.{name} "
                    "is False"
                )

    @property
    def restraints(self) -> tuple[bool, bool, bool]:
        """Return restraint flags in the fixed nodal DOF order."""
        return (bool(self.u), bool(self.v), bool(self.phi))

    @property
    def prescribed_values(self) -> tuple[float, float, float]:
        """Return prescribed values in ``[u, v, phi]`` order."""
        return (float(self.u_value), float(self.v_value), float(self.phi_value))


@dataclass(frozen=True, slots=True)
class NodalLoad:
    """A concentrated load applied at a node in global coordinates.

    Positive ``fx`` acts along global +X, positive ``fy`` along global +Y,
    and positive ``mz`` acts counter-clockwise about +Z.
    """

    node_id: int
    fx: float = 0.0  # [N]
    fy: float = 0.0  # [N]
    mz: float = 0.0  # [N*m]

    def __post_init__(self) -> None:
        _validate_id("NodalLoad.node_id", self.node_id)
        _validate_finite("NodalLoad.fx", self.fx)
        _validate_finite("NodalLoad.fy", self.fy)
        _validate_finite("NodalLoad.mz", self.mz)


@dataclass(frozen=True, slots=True)
class DistributedLoad:
    """A linearly varying element load expressed in local coordinates.

    ``qx_i`` and ``qy_i`` are intensities at the local i end; ``qx_j`` and
    ``qy_j`` are intensities at the local j end. Positive components act along
    local +x and +y. Equal end values represent a uniform load. Conversion to
    an equivalent nodal load vector is deliberately deferred to Step 9.
    """

    element_id: int
    qx_i: float = 0.0  # [N/m]
    qy_i: float = 0.0  # [N/m]
    qx_j: float = 0.0  # [N/m]
    qy_j: float = 0.0  # [N/m]

    def __post_init__(self) -> None:
        _validate_id("DistributedLoad.element_id", self.element_id)
        _validate_finite("DistributedLoad.qx_i", self.qx_i)
        _validate_finite("DistributedLoad.qy_i", self.qy_i)
        _validate_finite("DistributedLoad.qx_j", self.qx_j)
        _validate_finite("DistributedLoad.qy_j", self.qy_j)
