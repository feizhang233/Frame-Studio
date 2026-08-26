"""Step 13: displacement fields, internal forces, and numerical checks."""

from __future__ import annotations

from collections.abc import Iterable
from dataclasses import dataclass
from numbers import Integral, Real

import numpy as np
from numpy.typing import ArrayLike, NDArray

from .geometry import ElementGeometry
from .models import DistributedLoad, FrameElement, Node


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


def _validated_length(length: float) -> float:
    if isinstance(length, (bool, np.bool_)) or not isinstance(length, Real):
        raise TypeError("length must be a real number")
    if not np.isfinite(length):
        raise ValueError("length must be finite")
    if length <= 0.0:
        raise ValueError("length must be greater than zero")
    return float(length)


def _validated_tolerance(tolerance: float) -> float:
    if isinstance(tolerance, (bool, np.bool_)) or not isinstance(tolerance, Real):
        raise TypeError("tolerance must be a real number")
    if not np.isfinite(tolerance):
        raise ValueError("tolerance must be finite")
    if tolerance < 0.0:
        raise ValueError("tolerance must be non-negative")
    return float(tolerance)


def _summed_load_intensities(
    element: FrameElement,
    distributed_loads: Iterable[DistributedLoad],
) -> tuple[float, float, float, float]:
    qx_i = qy_i = qx_j = qy_j = 0.0
    for load in distributed_loads:
        if not isinstance(load, DistributedLoad):
            raise TypeError(
                "distributed_loads must contain only DistributedLoad objects"
            )
        if load.element_id != element.id:
            raise ValueError(
                f"DistributedLoad.element_id={load.element_id} does not match "
                f"FrameElement.id={element.id}"
            )
        qx_i += float(load.qx_i)
        qy_i += float(load.qy_i)
        qx_j += float(load.qx_j)
        qy_j += float(load.qy_j)
    return qx_i, qy_i, qx_j, qy_j


@dataclass(frozen=True, slots=True)
class ElementFieldResults:
    """Sampled displacement, deformed centerline, and internal-force fields.

    ``axial_force`` is positive in tension. ``shear_force`` and
    ``bending_moment`` follow the mathematical basis: ``V(0)=fy_i``,
    ``M(0)=-m_i``, ``V(L)=-fy_j``, and ``M(L)=m_j``.
    """

    x_local: NDArray[np.float64]
    axial_displacement: NDArray[np.float64]
    transverse_displacement: NDArray[np.float64]
    rotation: NDArray[np.float64]
    axial_force: NDArray[np.float64]
    shear_force: NDArray[np.float64]
    bending_moment: NDArray[np.float64]
    x_global: NDArray[np.float64]
    y_global: NDArray[np.float64]
    x_deformed: NDArray[np.float64]
    y_deformed: NDArray[np.float64]


@dataclass(frozen=True, slots=True)
class GlobalValidation:
    """Dimensionless global stiffness and free-DOF residual checks."""

    stiffness_symmetry_ratio: float
    free_dof_residual_ratio: float
    passed: bool


@dataclass(frozen=True, slots=True)
class ElementEquilibriumValidation:
    """Local force, shear, and moment equilibrium residuals for one element."""

    axial_residual: float
    shear_residual: float
    moment_residual: float
    maximum_normalized_residual: float
    passed: bool


def reshape_nodal_displacements(
    displacements: ArrayLike,
) -> NDArray[np.float64]:
    """Return a copy of ``d`` as one ``[u, v, phi]`` row per node."""
    try:
        vector = np.asarray(displacements, dtype=float)
    except (TypeError, ValueError) as error:
        raise TypeError("displacements must be a numeric vector") from error

    if vector.ndim != 1 or vector.size == 0 or vector.size % 3 != 0:
        raise ValueError(
            "displacements must be a non-empty vector with 3 entries per node"
        )
    if not np.all(np.isfinite(vector)):
        raise ValueError("displacements must contain only finite values")
    return vector.reshape((-1, 3)).copy()


def calculate_element_field_results(
    element: FrameElement,
    node_i: Node,
    node_j: Node,
    geometry: ElementGeometry,
    local_displacements: ArrayLike,
    local_end_forces: ArrayLike,
    distributed_loads: Iterable[DistributedLoad] = (),
    *,
    number_of_points: int = 11,
    deformation_scale: float = 1.0,
) -> ElementFieldResults:
    """Sample one element's Step 13 displacement and internal-force results.

    Axial displacement uses linear interpolation and transverse displacement
    uses cubic Hermite interpolation. Internal forces are recovered by local
    equilibrium from the Step 12 end forces, so linearly varying member loads
    are retained inside the element instead of being lost by differentiating
    only the cubic finite-element displacement field.
    """
    if not isinstance(element, FrameElement):
        raise TypeError("element must be a FrameElement")
    if not isinstance(node_i, Node) or not isinstance(node_j, Node):
        raise TypeError("node_i and node_j must be Node objects")
    if node_i.id != element.node_i or node_j.id != element.node_j:
        raise ValueError("node_i and node_j must follow element connectivity")
    if not isinstance(geometry, ElementGeometry):
        raise TypeError("geometry must be an ElementGeometry")
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

    L = _validated_length(geometry.L)
    dx = float(node_j.x - node_i.x)
    dy = float(node_j.y - node_i.y)
    if not (
        np.isclose(np.hypot(dx, dy), L, rtol=1.0e-12, atol=1.0e-12)
        and np.isclose(dx / L, geometry.c, rtol=1.0e-12, atol=1.0e-12)
        and np.isclose(dy / L, geometry.s, rtol=1.0e-12, atol=1.0e-12)
    ):
        raise ValueError("geometry is inconsistent with node coordinates")

    d_local = _validated_vector("local_displacements", local_displacements, 6)
    q_local = _validated_vector("local_end_forces", local_end_forces, 6)
    qx_i, qy_i, qx_j, qy_j = _summed_load_intensities(
        element,
        distributed_loads,
    )

    x = np.linspace(0.0, L, int(number_of_points), dtype=float)
    xi = x / L

    n1 = 1.0 - xi
    n2 = xi
    h1 = 1.0 - 3.0 * xi**2 + 2.0 * xi**3
    h2 = L * (xi - 2.0 * xi**2 + xi**3)
    h3 = 3.0 * xi**2 - 2.0 * xi**3
    h4 = L * (-xi**2 + xi**3)

    dh1 = (-6.0 * xi + 6.0 * xi**2) / L
    dh2 = 1.0 - 4.0 * xi + 3.0 * xi**2
    dh3 = (6.0 * xi - 6.0 * xi**2) / L
    dh4 = -2.0 * xi + 3.0 * xi**2

    axial_displacement = n1 * d_local[0] + n2 * d_local[3]
    transverse_displacement = (
        h1 * d_local[1]
        + h2 * d_local[2]
        + h3 * d_local[4]
        + h4 * d_local[5]
    )
    rotation = (
        dh1 * d_local[1]
        + dh2 * d_local[2]
        + dh3 * d_local[4]
        + dh4 * d_local[5]
    )

    delta_qx = qx_j - qx_i
    delta_qy = qy_j - qy_i
    integrated_qx = qx_i * x + delta_qx * x**2 / (2.0 * L)
    integrated_qy = qy_i * x + delta_qy * x**2 / (2.0 * L)
    integrated_shear = qy_i * x**2 / 2.0 + delta_qy * x**3 / (6.0 * L)

    axial_force = -q_local[0] - integrated_qx
    shear_force = q_local[1] + integrated_qy
    bending_moment = -q_local[2] + q_local[1] * x + integrated_shear

    c = float(geometry.c)
    s = float(geometry.s)
    x_global = float(node_i.x) + c * x
    y_global = float(node_i.y) + s * x
    global_u = c * axial_displacement - s * transverse_displacement
    global_v = s * axial_displacement + c * transverse_displacement
    x_deformed = x_global + float(deformation_scale) * global_u
    y_deformed = y_global + float(deformation_scale) * global_v

    return ElementFieldResults(
        x_local=x,
        axial_displacement=axial_displacement,
        transverse_displacement=transverse_displacement,
        rotation=rotation,
        axial_force=axial_force,
        shear_force=shear_force,
        bending_moment=bending_moment,
        x_global=x_global,
        y_global=y_global,
        x_deformed=x_deformed,
        y_deformed=y_deformed,
    )


def validate_global_solution(
    global_stiffness: ArrayLike,
    displacements: ArrayLike,
    total_load: ArrayLike,
    free_dofs: ArrayLike,
    *,
    tolerance: float = 1.0e-9,
) -> GlobalValidation:
    """Check stiffness symmetry and equilibrium residuals at free DOFs."""
    try:
        stiffness = np.asarray(global_stiffness, dtype=float)
    except (TypeError, ValueError) as error:
        raise TypeError("global_stiffness must be a numeric square matrix") from error
    if stiffness.ndim != 2 or stiffness.shape[0] != stiffness.shape[1]:
        raise ValueError("global_stiffness must be a square matrix")
    if stiffness.shape[0] == 0 or stiffness.shape[0] % 3 != 0:
        raise ValueError("global_stiffness size must equal 3 times the node count")
    if not np.all(np.isfinite(stiffness)):
        raise ValueError("global_stiffness must contain only finite values")

    total_dofs = stiffness.shape[0]
    displacement_vector = _validated_vector(
        "displacements",
        displacements,
        total_dofs,
    )
    load_vector = _validated_vector("total_load", total_load, total_dofs)
    try:
        free = np.asarray(free_dofs)
    except (TypeError, ValueError) as error:
        raise TypeError("free_dofs must be an integer vector") from error
    if free.ndim != 1 or not np.issubdtype(free.dtype, np.integer):
        raise TypeError("free_dofs must be an integer vector")
    free = free.astype(np.int64, copy=False)
    if np.any(free < 0) or np.any(free >= total_dofs):
        raise ValueError("free_dofs contains an index outside the model")
    if np.unique(free).size != free.size:
        raise ValueError("free_dofs must not contain duplicate indices")

    limit = _validated_tolerance(tolerance)
    stiffness_scale = max(1.0, float(np.linalg.norm(stiffness)))
    load_scale = max(1.0, float(np.linalg.norm(load_vector)))
    symmetry_ratio = float(np.linalg.norm(stiffness - stiffness.T) / stiffness_scale)
    residual = stiffness @ displacement_vector - load_vector
    free_residual_ratio = float(np.linalg.norm(residual[free]) / load_scale)
    return GlobalValidation(
        stiffness_symmetry_ratio=symmetry_ratio,
        free_dof_residual_ratio=free_residual_ratio,
        passed=bool(symmetry_ratio <= limit and free_residual_ratio <= limit),
    )


def validate_element_equilibrium(
    element: FrameElement,
    local_end_forces: ArrayLike,
    length: float,
    distributed_loads: Iterable[DistributedLoad] = (),
    *,
    tolerance: float = 1.0e-9,
) -> ElementEquilibriumValidation:
    """Check local force and moment balance including member loads."""
    if not isinstance(element, FrameElement):
        raise TypeError("element must be a FrameElement")
    q_local = _validated_vector("local_end_forces", local_end_forces, 6)
    L = _validated_length(length)
    qx_i, qy_i, qx_j, qy_j = _summed_load_intensities(
        element,
        distributed_loads,
    )
    limit = _validated_tolerance(tolerance)

    resultant_x = L * (qx_i + qx_j) / 2.0
    resultant_y = L * (qy_i + qy_j) / 2.0
    load_moment_about_i = L**2 * (qy_i + 2.0 * qy_j) / 6.0

    axial_residual = float(q_local[0] + q_local[3] + resultant_x)
    shear_residual = float(q_local[1] + q_local[4] + resultant_y)
    moment_residual = float(
        q_local[2]
        + q_local[5]
        + q_local[4] * L
        + load_moment_about_i
    )

    axial_scale = max(
        1.0,
        abs(float(q_local[0])) + abs(float(q_local[3])) + abs(resultant_x),
    )
    shear_scale = max(
        1.0,
        abs(float(q_local[1])) + abs(float(q_local[4])) + abs(resultant_y),
    )
    moment_scale = max(
        1.0,
        abs(float(q_local[2]))
        + abs(float(q_local[5]))
        + abs(float(q_local[4]) * L)
        + abs(load_moment_about_i),
    )
    maximum_normalized_residual = max(
        abs(axial_residual) / axial_scale,
        abs(shear_residual) / shear_scale,
        abs(moment_residual) / moment_scale,
    )

    return ElementEquilibriumValidation(
        axial_residual=axial_residual,
        shear_residual=shear_residual,
        moment_residual=moment_residual,
        maximum_normalized_residual=float(maximum_normalized_residual),
        passed=bool(maximum_normalized_residual <= limit),
    )
