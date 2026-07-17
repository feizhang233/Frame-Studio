import numpy as np
import pytest

from frame2d import FrameElement, calculate_local_stiffness


def make_element() -> FrameElement:
    # Deliberately small values make every matrix term easy to check by hand.
    return FrameElement(1, 1, 2, E=200.0, A=0.02, I=0.001)


def test_local_stiffness_matches_hand_calculation() -> None:
    # L=2 gives EA/L=2, 12EI/L^3=0.3, 6EI/L^2=0.3,
    # 4EI/L=0.4, and 2EI/L=0.2.
    actual = calculate_local_stiffness(make_element(), length=2.0)
    expected = np.array(
        [
            [2.0, 0.0, 0.0, -2.0, 0.0, 0.0],
            [0.0, 0.3, 0.3, 0.0, -0.3, 0.3],
            [0.0, 0.3, 0.4, 0.0, -0.3, 0.2],
            [-2.0, 0.0, 0.0, 2.0, 0.0, 0.0],
            [0.0, -0.3, -0.3, 0.0, 0.3, -0.3],
            [0.0, 0.3, 0.2, 0.0, -0.3, 0.4],
        ]
    )

    np.testing.assert_allclose(actual, expected, rtol=0.0, atol=1.0e-12)
    np.testing.assert_allclose(actual, actual.T, rtol=0.0, atol=1.0e-12)


def test_local_stiffness_has_three_rigid_body_modes() -> None:
    length = 2.0
    k_local = calculate_local_stiffness(make_element(), length)
    rigid_axial_translation = np.array([1.0, 0.0, 0.0, 1.0, 0.0, 0.0])
    rigid_transverse_translation = np.array([0.0, 1.0, 0.0, 0.0, 1.0, 0.0])
    rigid_rotation = np.array([0.0, 0.0, 1.0, 0.0, length, 1.0])

    for mode in (
        rigid_axial_translation,
        rigid_transverse_translation,
        rigid_rotation,
    ):
        np.testing.assert_allclose(k_local @ mode, 0.0, atol=1.0e-12)


@pytest.mark.parametrize("length", [0.0, -1.0, np.inf, np.nan])
def test_invalid_length_is_rejected(length: float) -> None:
    with pytest.raises(ValueError):
        calculate_local_stiffness(make_element(), length)


def test_non_numeric_length_is_rejected() -> None:
    with pytest.raises(TypeError):
        calculate_local_stiffness(make_element(), "2.0")

