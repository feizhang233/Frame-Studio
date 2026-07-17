import numpy as np
import pytest

from frame2d import DistributedLoad, FrameElement, NodalLoad, Node, Support


def test_small_cantilever_input_can_be_created() -> None:
    nodes = [Node(1, 0.0, 0.0), Node(2, 2.0, 0.0)]
    element = FrameElement(
        id=1,
        node_i=1,
        node_j=2,
        E=210.0e9,
        A=2.0e-3,
        I=8.0e-6,
    )
    support = Support(node_id=1, u=True, v=True, phi=True)
    nodal_load = NodalLoad(node_id=2, fy=-10.0e3)
    distributed_load = DistributedLoad(
        element_id=1,
        qy_i=-2.0e3,
        qy_j=-2.0e3,
    )

    assert nodes[1].x == pytest.approx(2.0)
    assert element.node_i == nodes[0].id
    assert element.node_j == nodes[1].id
    assert support.restraints == (True, True, True)
    assert nodal_load.fy == pytest.approx(-10_000.0)
    assert distributed_load.qy_i == distributed_load.qy_j == -2_000.0


def test_support_accepts_nonzero_prescribed_displacements() -> None:
    support = Support(
        node_id=2,
        u=True,
        phi=True,
        u_value=1.5e-3,
        phi_value=-2.0e-4,
    )

    assert support.restraints == (True, False, True)
    assert support.prescribed_values == pytest.approx((1.5e-3, 0.0, -2.0e-4))


def test_support_accepts_an_inclined_local_axis() -> None:
    support = Support(node_id=2, v=True, angle=37.5)

    assert support.angle == pytest.approx(37.5)


@pytest.mark.parametrize(
    ("factory", "exception"),
    [
        (lambda: Node(0, 0.0, 0.0), ValueError),
        (lambda: Node(1, np.nan, 0.0), ValueError),
        (lambda: FrameElement(1, 1, 1, 210e9, 1e-3, 1e-6), ValueError),
        (lambda: FrameElement(1, 1, 2, 0.0, 1e-3, 1e-6), ValueError),
        (lambda: FrameElement(1, 1, 2, 210e9, -1e-3, 1e-6), ValueError),
        (lambda: FrameElement(1, 1, 2, 210e9, 1e-3, np.inf), ValueError),
        (lambda: Support(1), ValueError),
        (lambda: Support(1, u=1), TypeError),
        (lambda: Support(1, u=True, u_value=np.nan), ValueError),
        (lambda: Support(1, u=True, u_value=True), TypeError),
        (lambda: Support(1, u=True, v_value=1.0e-3), ValueError),
        (lambda: Support(1, v=True, angle=np.inf), ValueError),
        (lambda: NodalLoad(1, fx=np.inf), ValueError),
        (lambda: DistributedLoad(1, qy_i=np.nan), ValueError),
    ],
)
def test_invalid_input_is_rejected(factory, exception) -> None:
    with pytest.raises(exception):
        factory()


def test_records_are_immutable() -> None:
    node = Node(1, 0.0, 0.0)

    with pytest.raises((AttributeError, TypeError)):
        node.x = 1.0
