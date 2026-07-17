"""Hand-checkable example for a non-zero prescribed displacement.

A horizontal cantilever has no applied load, but its free-end transverse DOF
is prescribed to settle by 0.01 m. The free-end rotation remains unknown and
is solved from ``K_ff d_f = P_f - K_fc d_c``.
"""

import numpy as np

from frame2d import (
    FrameElement,
    Node,
    Support,
    assemble_global_stiffness,
    assemble_prescribed_displacement_vector,
    calculate_geometry,
    calculate_global_stiffness,
    calculate_local_stiffness,
    calculate_reaction_vector,
    calculate_transformation,
    partition_dofs,
    solve_displacements,
)


nodes = [Node(1, 0.0, 0.0), Node(2, 2.0, 0.0)]
element = FrameElement(1, 1, 2, E=200.0, A=0.02, I=0.001)
supports = [
    Support(1, u=True, v=True, phi=True),
    Support(2, v=True, v_value=-0.01),
]

geometry = calculate_geometry(element, nodes[0], nodes[1])
k_local = calculate_local_stiffness(element, geometry.L)
transformation = calculate_transformation(geometry)
k_global = calculate_global_stiffness(k_local, transformation)
K = assemble_global_stiffness(len(nodes), [(element, k_global)])
P_total = np.zeros(6)

free_dofs, restrained_dofs = partition_dofs(len(nodes), supports)
d_prescribed = assemble_prescribed_displacement_vector(len(nodes), supports)
d = solve_displacements(K, P_total, supports)
R = calculate_reaction_vector(K, d, P_total)


if __name__ == "__main__":
    print("free DOFs:", free_dofs.tolist())
    print("restrained DOFs:", restrained_dofs.tolist())
    print("prescribed vector:", d_prescribed)
    print("solved d:", d)
    print("reaction R:", R)

    # EI=0.2 N*m^2, L=2 m and prescribed tip displacement delta=-0.01 m.
    # A cantilever with zero tip moment has:
    # phi_L = 3*delta/(2L) = -0.0075 rad
    # P = 3EI*delta/L^3 = -0.00075 N
    # fixed-end moment reaction = -P*L = 0.0015 N*m.
    expected_d = np.array([0.0, 0.0, 0.0, 0.0, -0.01, -0.0075])
    expected_R = np.array([0.0, 0.00075, 0.0015, 0.0, -0.00075, 0.0])
    print("displacement matches hand solution:", np.allclose(d, expected_d))
    print("reaction matches hand solution:", np.allclose(R, expected_R))
