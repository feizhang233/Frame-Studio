import numpy as np

from frame2d import (
    DistributedLoad,
    FrameElement,
    NodalLoad,
    Node,
    Support,
    solve_frame,
)


def test_complete_cantilever_analysis_matches_closed_form() -> None:
    result = solve_frame(
        nodes=[Node(1, 0.0, 0.0), Node(2, 2.0, 0.0)],
        elements=[FrameElement(1, 1, 2, E=200.0, A=0.02, I=0.001)],
        supports=[Support(1, u=True, v=True, phi=True)],
        nodal_loads=[NodalLoad(2, fx=4.0, fy=-1.0)],
        distributed_loads=[DistributedLoad(1, qy_i=-0.6, qy_j=-0.6)],
        number_of_points=3,
    )

    np.testing.assert_allclose(
        result.displacements,
        [0.0, 0.0, 0.0, 2.0, -58.0 / 3.0, -14.0],
    )
    np.testing.assert_allclose(result.reactions[:3], [-4.0, 2.2, 3.2])
    np.testing.assert_array_equal(result.free_dofs, [3, 4, 5])
    np.testing.assert_array_equal(result.restrained_dofs, [0, 1, 2])
    np.testing.assert_allclose(result.elements[0].fields.shear_force, [2.2, 1.6, 1.0])
    np.testing.assert_allclose(
        result.elements[0].fields.bending_moment,
        [-3.2, -1.3, 0.0],
        atol=1.0e-12,
    )
    assert result.validation.passed
    assert result.elements[0].validation.passed


def test_cantilever_accepts_a_direct_tip_moment() -> None:
    result = solve_frame(
        nodes=[Node(1, 0.0, 0.0), Node(2, 2.0, 0.0)],
        elements=[FrameElement(1, 1, 2, E=200.0, A=0.02, I=0.001)],
        supports=[Support(1, u=True, v=True, phi=True)],
        nodal_loads=[NodalLoad(2, mz=1.0)],
        number_of_points=3,
    )

    np.testing.assert_allclose(result.displacements, [0, 0, 0, 0, 10, 10])
    np.testing.assert_allclose(result.reactions[:3], [0, 0, -1])
    assert result.validation.passed


def test_frame_with_inclined_roller_satisfies_local_support_constraint() -> None:
    angle = 30.0
    result = solve_frame(
        nodes=[Node(1, 0.0, 0.0), Node(2, 2.0, 0.0)],
        elements=[FrameElement(1, 1, 2, E=200.0, A=0.02, I=0.001)],
        supports=[
            Support(1, u=True, v=True),
            Support(2, v=True, angle=angle),
        ],
        nodal_loads=[NodalLoad(2, fy=-1.0)],
        number_of_points=3,
    )

    radians = np.deg2rad(angle)
    u, v, _ = result.nodal_displacements[1]
    local_v = -np.sin(radians) * u + np.cos(radians) * v
    rx, ry, _ = result.reactions.reshape((-1, 3))[1]
    local_tangent_reaction = np.cos(radians) * rx + np.sin(radians) * ry
    np.testing.assert_allclose(local_v, 0.0, atol=1.0e-12)
    np.testing.assert_allclose(local_tangent_reaction, 0.0, atol=1.0e-12)
    assert result.validation.passed


def test_solver_sums_multiple_distributed_loads_on_an_element() -> None:
    result = solve_frame(
        nodes=[Node(1, 0.0, 0.0), Node(2, 2.0, 0.0)],
        elements=[FrameElement(7, 1, 2, E=200.0, A=0.02, I=0.001)],
        supports=[Support(1, u=True, v=True, phi=True)],
        distributed_loads=[
            DistributedLoad(7, qy_i=-0.2, qy_j=-0.2),
            DistributedLoad(7, qy_i=-0.4, qy_j=-0.4),
        ],
        number_of_points=3,
    )

    np.testing.assert_allclose(result.elements[0].fields.shear_force, [1.2, 0.6, 0.0])
    np.testing.assert_allclose(
        result.elements[0].fields.bending_moment,
        [-1.2, -0.3, 0.0],
        atol=1.0e-12,
    )


def test_solver_rejects_noncontiguous_node_identifiers() -> None:
    with np.testing.assert_raises_regex(ValueError, "contiguous"):
        solve_frame(
            nodes=[Node(1, 0.0, 0.0), Node(3, 2.0, 0.0)],
            elements=[FrameElement(1, 1, 3, E=200.0, A=0.02, I=0.001)],
            supports=[Support(1, u=True, v=True, phi=True)],
        )
