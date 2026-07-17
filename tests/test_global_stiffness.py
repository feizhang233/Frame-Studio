import numpy as np
import pytest

from frame2d import (
    ElementGeometry,
    FrameElement,
    calculate_global_stiffness,
    calculate_local_stiffness,
    calculate_transformation,
)


def make_element() -> FrameElement:
    return FrameElement(1, 1, 2, E=200.0, A=0.02, I=0.001)


def test_horizontal_global_stiffness_equals_local_stiffness() -> None:
    k_local = calculate_local_stiffness(make_element(), length=2.0)
    transformation = calculate_transformation(ElementGeometry(2.0, 1.0, 0.0))

    k_global = calculate_global_stiffness(k_local, transformation)

    np.testing.assert_allclose(k_global, k_local, rtol=0.0, atol=0.0)


def test_vertical_global_stiffness_matches_hand_calculation() -> None:
    k_local = calculate_local_stiffness(make_element(), length=2.0)
    transformation = calculate_transformation(ElementGeometry(2.0, 0.0, 1.0))
    actual = calculate_global_stiffness(k_local, transformation)
    expected = np.array(
        [
            [0.3, 0.0, -0.3, -0.3, 0.0, -0.3],
            [0.0, 2.0, 0.0, 0.0, -2.0, 0.0],
            [-0.3, 0.0, 0.4, 0.3, 0.0, 0.2],
            [-0.3, 0.0, 0.3, 0.3, 0.0, 0.3],
            [0.0, -2.0, 0.0, 0.0, 2.0, 0.0],
            [-0.3, 0.0, 0.2, 0.3, 0.0, 0.4],
        ]
    )

    np.testing.assert_allclose(actual, expected, rtol=0.0, atol=1.0e-12)
    np.testing.assert_allclose(actual, actual.T, rtol=0.0, atol=1.0e-12)


def test_coordinate_transformation_preserves_strain_energy() -> None:
    k_local = calculate_local_stiffness(make_element(), length=5.0)
    transformation = calculate_transformation(ElementGeometry(5.0, 0.6, 0.8))
    k_global = calculate_global_stiffness(k_local, transformation)
    d_global = np.array([0.01, -0.02, 0.003, 0.04, 0.01, -0.002])
    d_local = transformation @ d_global

    global_energy = 0.5 * d_global @ k_global @ d_global
    local_energy = 0.5 * d_local @ k_local @ d_local

    assert global_energy == pytest.approx(local_energy)


@pytest.mark.parametrize(
    ("k_local", "transformation", "exception"),
    [
        (np.eye(5), np.eye(6), ValueError),
        (np.eye(6), np.eye(5), ValueError),
        (np.full((6, 6), np.nan), np.eye(6), ValueError),
        (np.eye(6), "not a matrix", TypeError),
    ],
)
def test_invalid_matrices_are_rejected(k_local, transformation, exception) -> None:
    with pytest.raises(exception):
        calculate_global_stiffness(k_local, transformation)

