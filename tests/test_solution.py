import numpy as np
import pytest

from frame2d import (
    ElementGeometry,
    FrameElement,
    Support,
    assemble_prescribed_displacement_vector,
    assemble_support_transformation,
    calculate_global_stiffness,
    calculate_local_stiffness,
    calculate_reaction_vector,
    calculate_transformation,
    partition_dofs,
    solve_displacements,
)


def cantilever_stiffness() -> np.ndarray:
    element = FrameElement(1, 1, 2, E=200.0, A=0.02, I=0.001)
    k_local = calculate_local_stiffness(element, length=2.0)
    transformation = calculate_transformation(ElementGeometry(2.0, 1.0, 0.0))
    return calculate_global_stiffness(k_local, transformation)


def test_dofs_are_partitioned_in_u_v_phi_order() -> None:
    supports = [
        Support(1, u=True, v=True),
        Support(1, phi=True),
        Support(3, v=True),
    ]

    free, restrained = partition_dofs(3, supports)

    np.testing.assert_array_equal(restrained, [0, 1, 2, 7])
    np.testing.assert_array_equal(free, [3, 4, 5, 6, 8])


def test_prescribed_displacement_vector_uses_u_v_phi_order() -> None:
    supports = [
        Support(1, u=True, u_value=0.01),
        Support(1, v=True, v_value=-0.02),
        Support(2, phi=True, phi_value=0.03),
    ]

    actual = assemble_prescribed_displacement_vector(2, supports)

    np.testing.assert_allclose(actual, [0.01, -0.02, 0.0, 0.0, 0.0, 0.03])


def test_inclined_support_transformation_rotates_translational_axes() -> None:
    actual = assemble_support_transformation(
        1,
        [Support(1, v=True, angle=30.0)],
    )

    c = np.sqrt(3.0) / 2.0
    s = 0.5
    np.testing.assert_allclose(
        actual,
        [[c, s, 0.0], [-s, c, 0.0], [0.0, 0.0, 1.0]],
        atol=1.0e-14,
    )


def test_inclined_roller_enforces_its_local_normal_displacement() -> None:
    stiffness = np.eye(3)
    load = np.array([10.0, 0.0, 0.0])
    support = Support(1, v=True, angle=45.0)

    displacement = solve_displacements(stiffness, load, [support])
    reaction = calculate_reaction_vector(stiffness, displacement, load)

    np.testing.assert_allclose(displacement, [5.0, 5.0, 0.0], atol=1.0e-14)
    np.testing.assert_allclose(reaction, [-5.0, 5.0, 0.0], atol=1.0e-14)
    angle = np.deg2rad(support.angle)
    local_displacement = np.array(
        [
            np.cos(angle) * displacement[0] + np.sin(angle) * displacement[1],
            -np.sin(angle) * displacement[0] + np.cos(angle) * displacement[1],
        ]
    )
    assert local_displacement[1] == pytest.approx(0.0, abs=1.0e-14)


def test_repeated_support_records_require_one_orientation_per_node() -> None:
    with pytest.raises(ValueError, match="conflicting support angles"):
        partition_dofs(
            1,
            [Support(1, u=True, angle=0.0), Support(1, v=True, angle=30.0)],
        )


def test_nonzero_base_motion_produces_compatible_rigid_body_motion() -> None:
    stiffness = cantilever_stiffness()
    supports = (
        support
        for support in [
            Support(
                1,
                u=True,
                v=True,
                phi=True,
                u_value=0.01,
                v_value=-0.02,
                phi_value=0.03,
            )
        ]
    )

    actual = solve_displacements(stiffness, np.zeros(6), supports)
    reactions = calculate_reaction_vector(stiffness, actual, np.zeros(6))

    # A force-free frame follows the imposed small rigid motion:
    # u_j=u_i, v_j=v_i+phi_i*L, phi_j=phi_i.
    expected = np.array([0.01, -0.02, 0.03, 0.01, 0.04, 0.03])
    np.testing.assert_allclose(actual, expected, rtol=0.0, atol=1.0e-14)
    np.testing.assert_allclose(reactions, 0.0, rtol=0.0, atol=1.0e-16)


def test_nonzero_end_settlement_is_retained_and_generates_reactions() -> None:
    stiffness = cantilever_stiffness()
    supports = [
        Support(1, u=True, v=True, phi=True),
        Support(2, u=True, u_value=0.1),
    ]

    displacements = solve_displacements(stiffness, np.zeros(6), supports)
    reactions = calculate_reaction_vector(stiffness, displacements, np.zeros(6))

    np.testing.assert_allclose(displacements, [0.0, 0.0, 0.0, 0.1, 0.0, 0.0])
    np.testing.assert_allclose(reactions, [-0.2, 0.0, 0.0, 0.2, 0.0, 0.0])


def test_cantilever_displacements_match_closed_form_solution() -> None:
    stiffness = cantilever_stiffness()
    total_load = np.array([0.0, 0.0, 0.0, 4.0, -1.0, 0.0])
    supports = [Support(1, u=True, v=True, phi=True)]

    actual = solve_displacements(stiffness, total_load, supports)

    # u = Fx*L/(EA) = 2; v = Fy*L^3/(3EI) = -40/3;
    # phi = Fy*L^2/(2EI) = -10.
    expected = np.array([0.0, 0.0, 0.0, 2.0, -40.0 / 3.0, -10.0])
    np.testing.assert_allclose(actual, expected, rtol=0.0, atol=1.0e-12)


def test_cantilever_reactions_match_global_equilibrium() -> None:
    stiffness = cantilever_stiffness()
    total_load = np.array([0.0, 0.0, 0.0, 4.0, -1.0, 0.0])
    supports = [Support(1, u=True, v=True, phi=True)]
    displacements = solve_displacements(stiffness, total_load, supports)

    actual = calculate_reaction_vector(stiffness, displacements, total_load)

    expected = np.array([-4.0, 1.0, 2.0, 0.0, 0.0, 0.0])
    np.testing.assert_allclose(actual, expected, rtol=0.0, atol=1.0e-12)


def test_load_at_restrained_dof_is_included_in_reaction() -> None:
    stiffness = np.eye(3)
    total_load = np.array([1.0, -2.0, 3.0])
    supports = [Support(1, u=True, v=True, phi=True)]

    displacements = solve_displacements(stiffness, total_load, supports)
    reactions = calculate_reaction_vector(stiffness, displacements, total_load)

    np.testing.assert_allclose(displacements, 0.0)
    np.testing.assert_allclose(reactions, [-1.0, 2.0, -3.0])


@pytest.mark.parametrize(
    ("number_of_nodes", "supports", "exception"),
    [
        (0, [], ValueError),
        (2, [Support(3, u=True)], ValueError),
        (2, ["not a support"], TypeError),
        (
            2,
            [
                Support(1, u=True, u_value=0.1),
                Support(1, u=True, u_value=0.2),
            ],
            ValueError,
        ),
    ],
)
def test_invalid_dof_partition_input_is_rejected(
    number_of_nodes, supports, exception
) -> None:
    with pytest.raises(exception):
        partition_dofs(number_of_nodes, supports)


@pytest.mark.parametrize(
    ("stiffness", "total_load", "exception"),
    [
        (np.ones((3, 2)), np.zeros(3), ValueError),
        (np.eye(4), np.zeros(4), ValueError),
        (np.eye(6), np.zeros(5), ValueError),
        (np.full((6, 6), np.nan), np.zeros(6), ValueError),
        ("not a matrix", np.zeros(6), TypeError),
    ],
)
def test_invalid_displacement_solution_input_is_rejected(
    stiffness, total_load, exception
) -> None:
    with pytest.raises(exception):
        solve_displacements(
            stiffness,
            total_load,
            [Support(1, u=True, v=True, phi=True)],
        )


def test_singular_reduced_stiffness_is_reported() -> None:
    with pytest.raises(np.linalg.LinAlgError, match="K_ff is singular"):
        solve_displacements(
            np.zeros((6, 6)),
            np.zeros(6),
            [Support(1, u=True, v=True, phi=True)],
        )


@pytest.mark.parametrize(
    ("displacements", "total_load", "exception"),
    [
        (np.zeros(5), np.zeros(6), ValueError),
        (np.zeros(6), np.zeros(5), ValueError),
        (np.full(6, np.nan), np.zeros(6), ValueError),
        ("not a vector", np.zeros(6), TypeError),
    ],
)
def test_invalid_reaction_input_is_rejected(
    displacements, total_load, exception
) -> None:
    with pytest.raises(exception):
        calculate_reaction_vector(np.eye(6), displacements, total_load)
