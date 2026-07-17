import numpy as np
import pytest

from frame2d import (
    ElementGeometry,
    FrameElement,
    calculate_local_stiffness,
    calculate_transformation,
    extract_element_displacements,
    recover_element_end_response,
    recover_local_displacements,
    recover_local_end_forces,
)


def make_element() -> FrameElement:
    return FrameElement(1, 1, 2, E=200.0, A=0.02, I=0.001)


def test_element_displacements_are_extracted_in_fixed_dof_order() -> None:
    element = FrameElement(1, 2, 3, E=200.0, A=0.02, I=0.001)
    displacements = np.arange(9.0)

    actual = extract_element_displacements(element, displacements)

    np.testing.assert_array_equal(actual, [3.0, 4.0, 5.0, 6.0, 7.0, 8.0])


def test_vertical_element_displacements_are_rotated_to_local_axes() -> None:
    transformation = calculate_transformation(ElementGeometry(2.0, 0.0, 1.0))
    element_displacements = np.array([1.0, 2.0, 3.0, 4.0, 5.0, 6.0])

    actual = recover_local_displacements(element_displacements, transformation)

    expected = np.array([2.0, -1.0, 3.0, 5.0, -4.0, 6.0])
    np.testing.assert_allclose(actual, expected)


def test_local_end_force_recovery_subtracts_consistent_load() -> None:
    local_stiffness = np.eye(6)
    local_displacements = np.arange(1.0, 7.0)
    p0_local = np.full(6, 0.25)

    actual = recover_local_end_forces(
        local_stiffness,
        local_displacements,
        p0_local,
    )

    np.testing.assert_allclose(actual, local_displacements - p0_local)


def test_complete_cantilever_recovery_matches_hand_end_forces() -> None:
    element = make_element()
    transformation = calculate_transformation(ElementGeometry(2.0, 1.0, 0.0))
    local_stiffness = calculate_local_stiffness(element, length=2.0)
    # Closed-form Step 10 displacement for Fx=4 N and Fy=-1 N at the free end.
    displacements = np.array([0.0, 0.0, 0.0, 2.0, -40.0 / 3.0, -10.0])

    response = recover_element_end_response(
        element,
        displacements,
        local_stiffness,
        transformation,
    )

    np.testing.assert_allclose(response.global_displacements, displacements)
    np.testing.assert_allclose(response.local_displacements, displacements)
    # Element nodal end actions: fixed-end reaction and free-end applied load.
    np.testing.assert_allclose(
        response.local_end_forces,
        [-4.0, 1.0, 2.0, 4.0, -1.0, 0.0],
        rtol=0.0,
        atol=1.0e-14,
    )


@pytest.mark.parametrize(
    ("function", "args", "exception"),
    [
        (extract_element_displacements, (make_element(), np.zeros(5)), ValueError),
        (
            recover_local_displacements,
            (np.zeros(6), np.eye(5)),
            ValueError,
        ),
        (
            recover_local_end_forces,
            (np.eye(6), np.zeros(5)),
            ValueError,
        ),
        (
            recover_local_end_forces,
            (np.full((6, 6), np.nan), np.zeros(6)),
            ValueError,
        ),
    ],
)
def test_invalid_recovery_input_is_rejected(function, args, exception) -> None:
    with pytest.raises(exception):
        function(*args)
