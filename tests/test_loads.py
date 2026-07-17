import numpy as np
import pytest

from frame2d import (
    DistributedLoad,
    ElementGeometry,
    FrameElement,
    NodalLoad,
    assemble_equivalent_nodal_load_vector,
    assemble_nodal_load_vector,
    calculate_global_equivalent_nodal_load,
    calculate_local_equivalent_nodal_load,
    calculate_transformation,
)


def make_element(
    element_id: int = 1,
    node_i: int = 1,
    node_j: int = 2,
) -> FrameElement:
    return FrameElement(element_id, node_i, node_j, E=200.0, A=0.02, I=0.001)


def test_nodal_loads_are_assembled_in_fx_fy_mz_order_and_added() -> None:
    loads = [
        NodalLoad(2, fx=10.0, fy=-20.0, mz=3.0),
        NodalLoad(2, fx=-2.0, fy=5.0, mz=1.0),
        NodalLoad(3, fy=-7.0),
    ]

    actual = assemble_nodal_load_vector(3, loads)

    expected = np.array([0.0, 0.0, 0.0, 8.0, -15.0, 4.0, 0.0, -7.0, 0.0])
    np.testing.assert_allclose(actual, expected)


def test_uniform_local_load_matches_hand_calculation() -> None:
    element = make_element()
    load = DistributedLoad(1, qx_i=6.0, qy_i=-12.0, qx_j=6.0, qy_j=-12.0)

    actual = calculate_local_equivalent_nodal_load(element, load, length=2.0)

    # Axial: qx*L/2 = 6 at both ends.
    # Transverse: qy*L/2 = -12; moments are qy*L^2/12 = -4 and +4.
    expected = np.array([6.0, -12.0, -4.0, 6.0, -12.0, 4.0])
    np.testing.assert_allclose(actual, expected)


def test_triangular_local_load_preserves_resultant_and_moment() -> None:
    element = make_element()
    load = DistributedLoad(1, qx_i=0.0, qy_i=0.0, qx_j=6.0, qy_j=10.0)

    actual = calculate_local_equivalent_nodal_load(element, load, length=2.0)

    expected = np.array([2.0, 3.0, 4.0 / 3.0, 4.0, 7.0, -2.0])
    np.testing.assert_allclose(actual, expected)
    assert actual[0] + actual[3] == pytest.approx(6.0)
    assert actual[1] + actual[4] == pytest.approx(10.0)
    # Moment about i: M_i + F_j*L + M_j = resultant*(2L/3).
    assert actual[2] + actual[4] * 2.0 + actual[5] == pytest.approx(40.0 / 3.0)


def test_vertical_element_load_is_transformed_to_global_coordinates() -> None:
    element = make_element()
    load = DistributedLoad(1, qy_i=-10.0, qy_j=-10.0)
    local = calculate_local_equivalent_nodal_load(element, load, length=2.0)
    transformation = calculate_transformation(ElementGeometry(2.0, 0.0, 1.0))

    actual = calculate_global_equivalent_nodal_load(local, transformation)

    expected = np.array([10.0, 0.0, -10.0 / 3.0, 10.0, 0.0, 10.0 / 3.0])
    np.testing.assert_allclose(actual, expected)


def test_element_equivalent_loads_are_assembled_and_shared_node_is_added() -> None:
    element_1 = make_element(1, 1, 2)
    element_2 = make_element(2, 2, 3)
    p0_1 = np.arange(1.0, 7.0)
    p0_2 = 10.0 + np.arange(1.0, 7.0)

    actual = assemble_equivalent_nodal_load_vector(
        3,
        [(element_1, p0_1), (element_2, p0_2)],
    )

    expected = np.array([1.0, 2.0, 3.0, 15.0, 17.0, 19.0, 14.0, 15.0, 16.0])
    np.testing.assert_allclose(actual, expected)


@pytest.mark.parametrize(
    ("number_of_nodes", "loads", "exception"),
    [
        (0, [], ValueError),
        (2, [NodalLoad(3, fx=1.0)], ValueError),
        (2, ["not a nodal load"], TypeError),
    ],
)
def test_invalid_nodal_load_assembly_is_rejected(
    number_of_nodes, loads, exception
) -> None:
    with pytest.raises(exception):
        assemble_nodal_load_vector(number_of_nodes, loads)


@pytest.mark.parametrize("length", [0.0, -1.0, np.inf, np.nan])
def test_invalid_equivalent_load_length_is_rejected(length: float) -> None:
    with pytest.raises(ValueError):
        calculate_local_equivalent_nodal_load(
            make_element(), DistributedLoad(1, qy_i=1.0), length
        )


def test_distributed_load_must_match_element() -> None:
    with pytest.raises(ValueError):
        calculate_local_equivalent_nodal_load(
            make_element(), DistributedLoad(2, qy_i=1.0), 2.0
        )


@pytest.mark.parametrize(
    ("local_load", "transformation", "exception"),
    [
        (np.ones(5), np.eye(6), ValueError),
        (np.ones(6), np.eye(5), ValueError),
        (np.full(6, np.nan), np.eye(6), ValueError),
        ("not a vector", np.eye(6), TypeError),
    ],
)
def test_invalid_load_transformation_input_is_rejected(
    local_load, transformation, exception
) -> None:
    with pytest.raises(exception):
        calculate_global_equivalent_nodal_load(local_load, transformation)


@pytest.mark.parametrize(
    ("number_of_nodes", "contributions", "exception"),
    [
        (0, [], ValueError),
        (2, [(make_element(1, 1, 3), np.ones(6))], ValueError),
        (2, [(make_element(), np.ones(5))], ValueError),
        (2, [("not an element", np.ones(6))], TypeError),
    ],
)
def test_invalid_equivalent_load_assembly_is_rejected(
    number_of_nodes, contributions, exception
) -> None:
    with pytest.raises(exception):
        assemble_equivalent_nodal_load_vector(number_of_nodes, contributions)
