"""Complete cumulative example for Steps 1-13.

Small hand-checkable model: one horizontal cantilever of length 2 m.

    fixed node 1 ==================== node 2
       (0, 0)          element 1       (2, 0)
                         qy = -0.6 N/m
                                      Fx = 4 N, Fy = -1 N

The deliberately small stiffness values keep the arithmetic readable. All
quantities still use SI units: m, rad, N, Pa, m^2, m^4, and N/m.
"""

import numpy as np

from frame2d import (
    DistributedLoad,
    FrameElement,
    NodalLoad,
    Node,
    Support,
    assemble_equivalent_nodal_load_vector,
    assemble_global_stiffness,
    assemble_nodal_load_vector,
    calculate_element_dof_map,
    calculate_element_field_results,
    calculate_geometry,
    calculate_global_equivalent_nodal_load,
    calculate_global_stiffness,
    calculate_local_equivalent_nodal_load,
    calculate_local_stiffness,
    calculate_reaction_vector,
    calculate_transformation,
    partition_dofs,
    recover_element_end_response,
    reshape_nodal_displacements,
    solve_displacements,
    validate_element_equilibrium,
    validate_global_solution,
)


# Step 1 - input data in SI units.
nodes = [Node(1, 0.0, 0.0), Node(2, 2.0, 0.0)]
element = FrameElement(1, 1, 2, E=200.0, A=0.02, I=0.001)
elements = [element]
supports = [Support(1, u=True, v=True, phi=True)]
nodal_loads = [NodalLoad(2, fx=4.0, fy=-1.0)]
distributed_loads = [DistributedLoad(1, qy_i=-0.6, qy_j=-0.6)]

# Step 2 - L, c, s.
geometry = calculate_geometry(element, nodes[0], nodes[1])

# Step 3 - k_local.
k_local = calculate_local_stiffness(element, geometry.L)

# Step 4 - T, with d_local = T @ d_element_global.
T = calculate_transformation(geometry)

# Step 5 - k_global = T.T @ k_local @ T.
k_global = calculate_global_stiffness(k_local, T)

# Step 6 - global DOF map, zero-based for NumPy.
dof_map = calculate_element_dof_map(element)

# Step 7 - assemble K.
K = assemble_global_stiffness(len(nodes), [(element, k_global)])

# Step 8 - assemble direct global nodal load P.
P = assemble_nodal_load_vector(len(nodes), nodal_loads)

# Step 9 - calculate p0_local, transform it, assemble P0, then P_total.
p0_local = calculate_local_equivalent_nodal_load(
    element,
    distributed_loads[0],
    geometry.L,
)
p0_global = calculate_global_equivalent_nodal_load(p0_local, T)
P0 = assemble_equivalent_nodal_load_vector(
    len(nodes),
    [(element, p0_global)],
)
P_total = P + P0

# Step 10 - partition DOFs and solve without explicitly inverting K_ff.
free_dofs, restrained_dofs = partition_dofs(len(nodes), supports)
d = solve_displacements(K, P_total, supports)

# Step 11 - full residual; restrained entries are support reactions.
R = calculate_reaction_vector(K, d, P_total)

# Step 12 - recover d_local and q_local = k_local @ d_local - p0_local.
end_response = recover_element_end_response(
    element,
    d,
    k_local,
    T,
    p0_local,
)
d_local = end_response.local_displacements
q_local = end_response.local_end_forces

# Step 13 - nodal output, FE deformation, equilibrium N/V/M fields, checks.
nodal_displacements = reshape_nodal_displacements(d)
field = calculate_element_field_results(
    element,
    nodes[0],
    nodes[1],
    geometry,
    d_local,
    q_local,
    distributed_loads,
    number_of_points=5,
    deformation_scale=1.0,
)
global_check = validate_global_solution(K, d, P_total, free_dofs)
element_check = validate_element_equilibrium(
    element,
    q_local,
    geometry.L,
    distributed_loads,
)


def print_array(name: str, value: np.ndarray) -> None:
    print(f"{name} = {np.array2string(value, precision=6, suppress_small=True)}")


if __name__ == "__main__":
    print("Step 1 - input")
    print("nodes:", nodes)
    print("element:", element)
    print("support:", supports[0])
    print("nodal load:", nodal_loads[0])
    print("distributed load:", distributed_loads[0])

    print("\nStep 2 - L, c, s")
    print(f"L={geometry.L:g} m, c={geometry.c:g}, s={geometry.s:g}")

    print("\nStep 3 - k_local")
    print_array("k_local", k_local)

    print("\nStep 4 - T")
    print_array("T", T)

    print("\nStep 5 - k_global")
    print_array("k_global", k_global)

    print("\nStep 6 - DOF map")
    print("zero-based DOFs:", dof_map.tolist())

    print("\nStep 7 - assembled K")
    print_array("K", K)

    print("\nStep 8 - P")
    print_array("P", P)

    print("\nStep 9 - P0 and P_total")
    print_array("p0_local", p0_local)
    print_array("P0", P0)
    print_array("P_total", P_total)

    print("\nStep 10 - boundary conditions and d")
    print("free DOFs:", free_dofs.tolist())
    print("restrained DOFs:", restrained_dofs.tolist())
    print_array("d", d)
    print_array("nodal [u, v, phi]", nodal_displacements)

    print("\nStep 11 - R")
    print_array("R", R)
    print_array("support reaction", R[restrained_dofs])

    print("\nStep 12 - d_local and q_local")
    print_array("d_local", d_local)
    print_array("q_local = [fx_i, fy_i, m_i, fx_j, fy_j, m_j]", q_local)

    print("\nStep 13 - element fields")
    print(" x [m]      u' [m]       v' [m]      N [N]      V [N]      M [N*m]")
    for index in range(field.x_local.size):
        print(
            f"{field.x_local[index]:6.3f}  "
            f"{field.axial_displacement[index]:11.6f}  "
            f"{field.transverse_displacement[index]:11.6f}  "
            f"{field.axial_force[index]:9.6f}  "
            f"{field.shear_force[index]:9.6f}  "
            f"{field.bending_moment[index]:10.6f}"
        )
    print_array("deformed x", field.x_deformed)
    print_array("deformed y", field.y_deformed)
    print("global validation:", global_check)
    print("element equilibrium validation:", element_check)

    # Hand checks:
    # EA=4 N, EI=0.2 N*m^2, L=2 m, tip loads Fx=4 N, Fy=-1 N,
    # and qy=-0.6 N/m.
    # u_L = Fx*L/(EA) = 2 m.
    # v_L = Fy*L^3/(3EI) + qy*L^4/(8EI) = -58/3 m.
    # phi_L = Fy*L^2/(2EI) + qy*L^3/(6EI) = -14 rad.
    expected_d = np.array([0.0, 0.0, 0.0, 2.0, -58.0 / 3.0, -14.0])
    # Reactions: [-Fx, -(Fy+qy*L), -(Fy*L+qy*L^2/2)].
    expected_reaction = np.array([-4.0, 2.2, 3.2])
    expected_q_local = np.array([-4.0, 2.2, 3.2, 4.0, -1.0, 0.0])

    print("\nHand checks")
    print("d matches closed form:", np.allclose(d, expected_d))
    print(
        "reaction matches equilibrium:",
        np.allclose(R[restrained_dofs], expected_reaction),
    )
    print("q_local matches end equilibrium:", np.allclose(q_local, expected_q_local))
    print("all numerical validations pass:", global_check.passed and element_check.passed)
