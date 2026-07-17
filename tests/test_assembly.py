import numpy as np
import pytest

from frame2d import (
    FrameElement,
    assemble_global_stiffness,
    calculate_element_dof_map,
    calculate_node_dof_map,
)


def make_element(element_id: int, node_i: int, node_j: int) -> FrameElement:
    return FrameElement(element_id, node_i, node_j, E=200.0, A=0.02, I=0.001)


def test_node_dof_map_uses_fixed_u_v_phi_order() -> None:
    np.testing.assert_array_equal(calculate_node_dof_map(1), [0, 1, 2])
    np.testing.assert_array_equal(calculate_node_dof_map(3), [6, 7, 8])


def test_element_dof_map_uses_fixed_i_then_j_order() -> None:
    element = make_element(1, 2, 4)

    actual = calculate_element_dof_map(element)

    np.testing.assert_array_equal(actual, [3, 4, 5, 9, 10, 11])


def test_two_elements_are_assembled_and_shared_node_is_added() -> None:
    element_1 = make_element(1, 1, 2)
    element_2 = make_element(2, 2, 3)
    k_1 = np.arange(1.0, 37.0).reshape(6, 6)
    k_2 = 100.0 + np.arange(1.0, 37.0).reshape(6, 6)

    actual = assemble_global_stiffness(
        3,
        [(element_1, k_1), (element_2, k_2)],
    )

    expected = np.zeros((9, 9))
    expected[0:6, 0:6] += k_1
    expected[3:9, 3:9] += k_2
    np.testing.assert_allclose(actual, expected)
    np.testing.assert_allclose(actual[3:6, 3:6], k_1[3:6, 3:6] + k_2[0:3, 0:3])


def test_assembly_preserves_symmetry_of_element_matrices() -> None:
    element_1 = make_element(1, 1, 2)
    element_2 = make_element(2, 2, 3)
    base_1 = np.arange(36.0).reshape(6, 6)
    base_2 = np.arange(36.0, 72.0).reshape(6, 6)
    k_1 = base_1 + base_1.T
    k_2 = base_2 + base_2.T

    actual = assemble_global_stiffness(3, [(element_1, k_1), (element_2, k_2)])

    np.testing.assert_allclose(actual, actual.T)


@pytest.mark.parametrize("node_id", [0, -1])
def test_invalid_node_id_is_rejected(node_id: int) -> None:
    with pytest.raises(ValueError):
        calculate_node_dof_map(node_id)


@pytest.mark.parametrize("node_id", [True, 1.5])
def test_non_integer_node_id_is_rejected(node_id) -> None:
    with pytest.raises(TypeError):
        calculate_node_dof_map(node_id)


@pytest.mark.parametrize(
    ("number_of_nodes", "contributions", "exception"),
    [
        (0, [], ValueError),
        (2, [(make_element(1, 1, 3), np.eye(6))], ValueError),
        (2, [(make_element(1, 1, 2), np.eye(5))], ValueError),
        (2, [(make_element(1, 1, 2), np.full((6, 6), np.nan))], ValueError),
        (2, [("not an element", np.eye(6))], TypeError),
        (2, [(make_element(1, 1, 2), "not a matrix")], TypeError),
    ],
)
def test_invalid_assembly_input_is_rejected(
    number_of_nodes, contributions, exception
) -> None:
    with pytest.raises(exception):
        assemble_global_stiffness(number_of_nodes, contributions)
