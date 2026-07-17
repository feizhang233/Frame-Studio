"""Regression checks against examples in ``Relevant Document``.

The textbook values are reported with limited precision, so the rigid-frame
comparisons use tolerances consistent with the number of printed digits.  The
Example 4.6 cantilever check uses the symbolic closed-form result and therefore
uses a tight numerical tolerance.
"""

import numpy as np

from frame2d import (
    DistributedLoad,
    FrameElement,
    NodalLoad,
    Node,
    Support,
    solve_frame,
)


def _fixed(node_id: int) -> Support:
    return Support(node_id, u=True, v=True, phi=True)


def test_example_4_6_uniformly_loaded_cantilever_matches_closed_form() -> None:
    """Relevant Document/4.4.pdf, Example 4.6 and Eq. (4.4.14b)."""
    elastic_modulus = 210.0e9
    area = 0.01
    second_moment = 8.0e-6
    length = 4.0
    load_intensity = 12_000.0

    result = solve_frame(
        nodes=[Node(1, 0.0, 0.0), Node(2, length, 0.0)],
        elements=[
            FrameElement(
                1,
                1,
                2,
                E=elastic_modulus,
                A=area,
                I=second_moment,
            )
        ],
        supports=[_fixed(1)],
        distributed_loads=[
            DistributedLoad(
                1,
                qy_i=-load_intensity,
                qy_j=-load_intensity,
            )
        ],
    )

    expected_tip_displacement = -(load_intensity * length**4) / (
        8.0 * elastic_modulus * second_moment
    )
    expected_tip_rotation = -(load_intensity * length**3) / (
        6.0 * elastic_modulus * second_moment
    )

    np.testing.assert_allclose(
        result.nodal_displacements[1],
        [0.0, expected_tip_displacement, expected_tip_rotation],
        rtol=1.0e-12,
        atol=1.0e-12,
    )
    np.testing.assert_allclose(
        result.reactions[:3],
        [0.0, load_intensity * length, load_intensity * length**2 / 2.0],
        rtol=1.0e-12,
        atol=1.0e-8,
    )
    assert result.validation.passed
    assert result.elements[0].validation.passed


def test_example_5_1_rigid_plane_frame_matches_textbook() -> None:
    """Relevant Document/5.2.pdf, Example 5.1, Eqs. (5.2.7)-(5.2.12)."""
    result = solve_frame(
        # Native inch-pound units are retained to compare the printed values
        # directly.  The formulation is valid for any consistent unit system.
        nodes=[
            Node(1, -60.0, 0.0),
            Node(2, -60.0, 120.0),
            Node(3, 60.0, 120.0),
            Node(4, 60.0, 0.0),
        ],
        elements=[
            FrameElement(1, 1, 2, E=30.0e6, A=10.0, I=200.0),
            FrameElement(2, 2, 3, E=30.0e6, A=10.0, I=100.0),
            FrameElement(3, 3, 4, E=30.0e6, A=10.0, I=200.0),
        ],
        supports=[_fixed(1), _fixed(4)],
        nodal_loads=[
            NodalLoad(2, fx=10_000.0),
            NodalLoad(3, mz=5_000.0),
        ],
    )

    expected_displacements = np.array(
        [
            [0.211, 0.00148, -0.00153],
            [0.209, -0.00148, -0.00149],
        ]
    )
    expected_local_end_forces = np.array(
        [
            [-3_700.0, 4_990.0, 376_000.0, 3_700.0, -4_990.0, 223_000.0],
            [5_010.0, -3_700.0, -223_000.0, -5_010.0, 3_700.0, -221_000.0],
            [3_700.0, 5_010.0, 226_000.0, -3_700.0, -5_010.0, 375_000.0],
        ]
    )

    np.testing.assert_allclose(
        result.nodal_displacements[1:3],
        expected_displacements,
        rtol=3.0e-3,
        atol=1.0e-8,
    )
    np.testing.assert_allclose(
        np.vstack([element.local_end_forces for element in result.elements]),
        expected_local_end_forces,
        rtol=3.0e-3,
        atol=1.0,
    )
    assert result.validation.passed
    assert all(element.validation.passed for element in result.elements)


def test_example_5_2_distributed_load_frame_matches_textbook() -> None:
    """Relevant Document/5.2.pdf, Example 5.2, Eqs. (5.2.19)-(5.2.29)."""
    result = solve_frame(
        nodes=[
            Node(1, 0.0, 0.0),
            Node(2, 360.0, 360.0),
            Node(3, 840.0, 360.0),
        ],
        elements=[
            FrameElement(1, 1, 2, E=30.0e6, A=100.0, I=1_000.0),
            FrameElement(2, 2, 3, E=30.0e6, A=100.0, I=1_000.0),
        ],
        supports=[_fixed(1), _fixed(3)],
        distributed_loads=[
            # The source gives 1000 lb/ft; geometry is expressed in inches.
            DistributedLoad(2, qy_i=-1_000.0 / 12.0, qy_j=-1_000.0 / 12.0)
        ],
    )

    np.testing.assert_allclose(
        result.nodal_displacements[1],
        [0.0033, -0.0097, -0.0033],
        rtol=5.0e-3,
        atol=1.0e-8,
    )
    np.testing.assert_allclose(
        result.elements[0].local_end_forces / 1_000.0,
        [26.64, -2.268, -389.1, -26.64, 2.268, -778.2],
        rtol=2.1e-2,
        atol=1.0e-4,
    )
    np.testing.assert_allclose(
        result.elements[1].local_end_forces / 1_000.0,
        [20.63, 17.42, 767.4, -20.63, 22.58, -2_013.0],
        rtol=5.0e-3,
        atol=1.0e-4,
    )
    assert result.validation.passed
    assert all(element.validation.passed for element in result.elements)


def test_example_5_3_member_point_load_matches_when_split_at_load_point() -> None:
    """Relevant Document/5.2.pdf, Example 5.3, Eqs. (5.2.34)-(5.2.40)."""
    result = solve_frame(
        nodes=[
            Node(1, 0.0, 0.0),
            Node(2, 480.0, 0.0),
            Node(3, 840.0, 480.0),
            Node(4, 240.0, 480.0),
            # The API has no member point-load record, so the loaded member is
            # split at its midpoint and the 15-kip load is applied at node 5.
            Node(5, 120.0, 240.0),
        ],
        elements=[
            FrameElement(1, 1, 5, E=30.0e6, A=8.0, I=800.0),
            FrameElement(4, 5, 4, E=30.0e6, A=8.0, I=800.0),
            FrameElement(2, 2, 4, E=30.0e6, A=8.0, I=800.0),
            FrameElement(3, 4, 3, E=30.0e6, A=8.0, I=800.0),
        ],
        supports=[_fixed(1), _fixed(2), _fixed(3)],
        nodal_loads=[NodalLoad(5, fx=-15_000.0)],
    )

    np.testing.assert_allclose(
        result.nodal_displacements[3],
        [-0.0103, 0.000956, -0.00172],
        rtol=6.0e-3,
        atol=1.0e-8,
    )

    # External end forces for the original member 1 are taken from the i-end
    # of segment 1-5 and the j-end of segment 5-4.
    original_member_1_end_forces = np.concatenate(
        [result.elements[0].local_end_forces[:3], result.elements[1].local_end_forces[3:]]
    )
    np.testing.assert_allclose(
        original_member_1_end_forces / 1_000.0,
        [5.03, -7.59, -1_058.0, 1.68, -5.83, 589.0],
        rtol=6.0e-3,
        atol=1.0e-4,
    )
    assert result.validation.passed
    assert all(element.validation.passed for element in result.elements)
