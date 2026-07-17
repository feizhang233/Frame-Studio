import numpy as np
import pytest

from frame2d import ElementGeometry, calculate_transformation


def test_horizontal_element_has_identity_transformation() -> None:
    transformation = calculate_transformation(ElementGeometry(L=2.0, c=1.0, s=0.0))

    np.testing.assert_allclose(transformation, np.eye(6), atol=0.0)


def test_vertical_element_transformation_matches_hand_calculation() -> None:
    transformation = calculate_transformation(ElementGeometry(L=2.0, c=0.0, s=1.0))
    expected = np.array(
        [
            [0.0, 1.0, 0.0, 0.0, 0.0, 0.0],
            [-1.0, 0.0, 0.0, 0.0, 0.0, 0.0],
            [0.0, 0.0, 1.0, 0.0, 0.0, 0.0],
            [0.0, 0.0, 0.0, 0.0, 1.0, 0.0],
            [0.0, 0.0, 0.0, -1.0, 0.0, 0.0],
            [0.0, 0.0, 0.0, 0.0, 0.0, 1.0],
        ]
    )

    np.testing.assert_allclose(transformation, expected, atol=0.0)


def test_transformation_is_orthogonal_for_three_four_five_element() -> None:
    transformation = calculate_transformation(ElementGeometry(L=5.0, c=0.6, s=0.8))

    np.testing.assert_allclose(
        transformation.T @ transformation,
        np.eye(6),
        rtol=0.0,
        atol=1.0e-12,
    )


@pytest.mark.parametrize(
    ("c", "s"),
    [(1.0, 1.0), (np.nan, 0.0), (np.inf, 0.0)],
)
def test_invalid_direction_cosines_are_rejected(c: float, s: float) -> None:
    with pytest.raises(ValueError):
        calculate_transformation(ElementGeometry(L=1.0, c=c, s=s))

