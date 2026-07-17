import numpy as np
import pytest

from frame2d import (
    DistributedLoad,
    ElementGeometry,
    FrameElement,
    Node,
    calculate_element_field_results,
    reshape_nodal_displacements,
    validate_element_equilibrium,
    validate_global_solution,
)


def make_element() -> FrameElement:
    return FrameElement(1, 1, 2, E=200.0, A=0.02, I=0.001)


def test_nodal_displacements_are_reshaped_in_u_v_phi_order() -> None:
    displacements = np.arange(6.0)

    actual = reshape_nodal_displacements(displacements)

    np.testing.assert_array_equal(actual, [[0.0, 1.0, 2.0], [3.0, 4.0, 5.0]])


def test_cantilever_displacement_and_internal_force_fields_match_hand_values() -> None:
    element = make_element()
    node_i = Node(1, 0.0, 0.0)
    node_j = Node(2, 2.0, 0.0)
    geometry = ElementGeometry(2.0, 1.0, 0.0)
    d_local = np.array([0.0, 0.0, 0.0, 2.0, -40.0 / 3.0, -10.0])
    q_local = np.array([-4.0, 1.0, 2.0, 4.0, -1.0, 0.0])

    result = calculate_element_field_results(
        element,
        node_i,
        node_j,
        geometry,
        d_local,
        q_local,
        number_of_points=3,
    )

    np.testing.assert_allclose(result.x_local, [0.0, 1.0, 2.0])
    np.testing.assert_allclose(result.axial_displacement, [0.0, 1.0, 2.0])
    np.testing.assert_allclose(
        result.transverse_displacement,
        [0.0, -25.0 / 6.0, -40.0 / 3.0],
    )
    np.testing.assert_allclose(result.rotation, [0.0, -7.5, -10.0])
    np.testing.assert_allclose(result.axial_force, 4.0)
    np.testing.assert_allclose(result.shear_force, 1.0)
    np.testing.assert_allclose(result.bending_moment, [-2.0, -1.0, 0.0])
    np.testing.assert_allclose(result.x_deformed, [0.0, 2.0, 4.0])
    np.testing.assert_allclose(
        result.y_deformed,
        [0.0, -25.0 / 6.0, -40.0 / 3.0],
    )


def test_uniform_member_load_is_retained_in_shear_and_moment_fields() -> None:
    element = make_element()
    load = DistributedLoad(1, qy_i=-12.0, qy_j=-12.0)
    # Fixed-fixed member: d_local=0 and q_local=-p0_local.
    q_local = np.array([0.0, 12.0, 4.0, 0.0, 12.0, -4.0])

    result = calculate_element_field_results(
        element,
        Node(1, 0.0, 0.0),
        Node(2, 2.0, 0.0),
        ElementGeometry(2.0, 1.0, 0.0),
        np.zeros(6),
        q_local,
        [load],
        number_of_points=3,
    )

    np.testing.assert_allclose(result.shear_force, [12.0, 0.0, -12.0])
    np.testing.assert_allclose(result.bending_moment, [-4.0, 2.0, -4.0])
    np.testing.assert_allclose(result.transverse_displacement, 0.0)


def test_global_validation_checks_symmetry_and_free_dof_equilibrium() -> None:
    stiffness = np.eye(6)
    displacements = np.array([0.0, 0.0, 0.0, 1.0, -2.0, 3.0])
    total_load = np.array([4.0, 5.0, 6.0, 1.0, -2.0, 3.0])

    actual = validate_global_solution(
        stiffness,
        displacements,
        total_load,
        np.array([3, 4, 5]),
    )

    assert actual.stiffness_symmetry_ratio == pytest.approx(0.0)
    assert actual.free_dof_residual_ratio == pytest.approx(0.0)
    assert actual.passed


def test_element_equilibrium_includes_distributed_load_resultants() -> None:
    element = make_element()
    load = DistributedLoad(1, qy_i=-12.0, qy_j=-12.0)
    q_local = np.array([0.0, 12.0, 4.0, 0.0, 12.0, -4.0])

    actual = validate_element_equilibrium(element, q_local, 2.0, [load])

    assert actual.axial_residual == pytest.approx(0.0)
    assert actual.shear_residual == pytest.approx(0.0)
    assert actual.moment_residual == pytest.approx(0.0)
    assert actual.maximum_normalized_residual == pytest.approx(0.0)
    assert actual.passed


def test_validation_reports_failed_equilibrium() -> None:
    actual = validate_element_equilibrium(
        make_element(),
        np.array([0.0, 12.0, 4.0, 0.0, 11.0, -4.0]),
        2.0,
        [DistributedLoad(1, qy_i=-12.0, qy_j=-12.0)],
        tolerance=1.0e-12,
    )

    assert not actual.passed
    assert actual.shear_residual == pytest.approx(-1.0)


@pytest.mark.parametrize(
    ("function", "args", "exception"),
    [
        (reshape_nodal_displacements, (np.zeros(5),), ValueError),
        (
            validate_global_solution,
            (np.eye(6), np.zeros(5), np.zeros(6), np.array([3, 4, 5])),
            ValueError,
        ),
        (
            validate_element_equilibrium,
            (make_element(), np.zeros(5), 2.0),
            ValueError,
        ),
        (
            validate_element_equilibrium,
            (
                make_element(),
                np.zeros(6),
                2.0,
                [DistributedLoad(2, qy_i=1.0)],
            ),
            ValueError,
        ),
    ],
)
def test_invalid_postprocessing_input_is_rejected(function, args, exception) -> None:
    with pytest.raises(exception):
        function(*args)
