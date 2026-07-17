import pytest

from frame2d import FrameElement, Node, calculate_geometry


def make_element() -> FrameElement:
    return FrameElement(1, 1, 2, E=200.0, A=0.02, I=0.001)


def test_geometry_for_three_four_five_triangle() -> None:
    geometry = calculate_geometry(
        make_element(),
        Node(1, 1.0, 2.0),
        Node(2, 4.0, 6.0),
    )

    assert geometry.L == pytest.approx(5.0)
    assert geometry.c == pytest.approx(3.0 / 5.0)
    assert geometry.s == pytest.approx(4.0 / 5.0)
    assert geometry.c**2 + geometry.s**2 == pytest.approx(1.0)


def test_geometry_preserves_i_to_j_direction() -> None:
    geometry = calculate_geometry(
        make_element(),
        Node(1, 4.0, 6.0),
        Node(2, 1.0, 2.0),
    )

    assert geometry.L == pytest.approx(5.0)
    assert geometry.c == pytest.approx(-3.0 / 5.0)
    assert geometry.s == pytest.approx(-4.0 / 5.0)


def test_zero_length_element_is_rejected() -> None:
    with pytest.raises(ValueError, match="zero length"):
        calculate_geometry(
            make_element(),
            Node(1, 2.0, 3.0),
            Node(2, 2.0, 3.0),
        )


@pytest.mark.parametrize(
    ("node_i", "node_j"),
    [
        (Node(3, 0.0, 0.0), Node(2, 1.0, 0.0)),
        (Node(1, 0.0, 0.0), Node(3, 1.0, 0.0)),
    ],
)
def test_connectivity_mismatch_is_rejected(node_i: Node, node_j: Node) -> None:
    with pytest.raises(ValueError, match="does not match"):
        calculate_geometry(make_element(), node_i, node_j)

