"""Complete cumulative example for Steps 1-11.

Model: a two-element L-shaped cantilever frame in the global X-Y plane.

                       node 3 (2, 1.5)
                         |
                         | element 2
                         |
    fixed node 1 ------ node 2 (2, 0)
       (0, 0)    element 1

Element 1 carries a uniform local downward load. Node 3 carries a global
concentrated load. The example stops after solving displacements and support
reactions; local element end-force recovery belongs to Step 12.
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
    calculate_geometry,
    calculate_global_equivalent_nodal_load,
    calculate_global_stiffness,
    calculate_local_equivalent_nodal_load,
    calculate_local_stiffness,
    calculate_reaction_vector,
    calculate_transformation,
    partition_dofs,
    solve_displacements,
)


# Step 1: model input in SI units.
nodes = [
    Node(1, 0.0, 0.0),
    Node(2, 2.0, 0.0),
    Node(3, 2.0, 1.5),
]
elements = [
    FrameElement(1, 1, 2, E=210.0e9, A=2.0e-3, I=8.0e-6),
    FrameElement(2, 2, 3, E=210.0e9, A=2.0e-3, I=8.0e-6),
]
supports = [Support(1, u=True, v=True, phi=True)]
nodal_loads = [NodalLoad(3, fx=5.0e3, fy=-10.0e3)]
distributed_loads = [DistributedLoad(1, qy_i=-2.0e3, qy_j=-2.0e3)]

nodes_by_id = {node.id: node for node in nodes}
elements_by_id = {element.id: element for element in elements}

# Steps 2-6: calculate and retain every element-level result.
geometries = {}
k_locals = {}
transformations = {}
k_globals = {}
dof_maps = {}

for element in elements:
    # Step 2: L, c and s.
    geometry = calculate_geometry(
        element,
        nodes_by_id[element.node_i],
        nodes_by_id[element.node_j],
    )
    geometries[element.id] = geometry

    # Step 3: k_local.
    k_locals[element.id] = calculate_local_stiffness(element, geometry.L)

    # Step 4: T, where d_local = T @ d_global.
    transformations[element.id] = calculate_transformation(geometry)

    # Step 5: k_global = T.T @ k_local @ T.
    k_globals[element.id] = calculate_global_stiffness(
        k_locals[element.id],
        transformations[element.id],
    )

    # Step 6: [u_i, v_i, phi_i, u_j, v_j, phi_j] global indices.
    dof_maps[element.id] = calculate_element_dof_map(element)

# Step 7: assemble the complete global stiffness matrix K.
K = assemble_global_stiffness(
    len(nodes),
    [(element, k_globals[element.id]) for element in elements],
)

# Step 8: assemble direct global nodal loads P.
P = assemble_nodal_load_vector(len(nodes), nodal_loads)

# Step 9: calculate p0_local, transform it, and assemble P0.
equivalent_load_records = []
equivalent_load_contributions = []
for distributed_load in distributed_loads:
    element = elements_by_id[distributed_load.element_id]
    p0_local = calculate_local_equivalent_nodal_load(
        element,
        distributed_load,
        geometries[element.id].L,
    )
    p0_global = calculate_global_equivalent_nodal_load(
        p0_local,
        transformations[element.id],
    )
    equivalent_load_records.append((element.id, p0_local, p0_global))
    equivalent_load_contributions.append((element, p0_global))

P0 = assemble_equivalent_nodal_load_vector(
    len(nodes),
    equivalent_load_contributions,
)
P_total = P + P0

# Step 10: apply zero-displacement supports and solve K_ff d_f = P_total_f.
free_dofs, restrained_dofs = partition_dofs(len(nodes), supports)
d = solve_displacements(K, P_total, supports)

# Step 11: calculate the full residual; support entries are the reactions.
R = calculate_reaction_vector(K, d, P_total)


def print_array(name: str, value: np.ndarray) -> None:
    print(name)
    print(np.array2string(value, precision=6, suppress_small=True))


if __name__ == "__main__":
    print("Step 1 - input")
    print("nodes:", nodes)
    print("elements:", elements)
    print("supports:", supports)
    print("nodal loads:", nodal_loads)
    print("distributed loads:", distributed_loads)

    print("\nStep 2 - L, c, s")
    for element in elements:
        geometry = geometries[element.id]
        print(
            f"element {element.id}: "
            f"L={geometry.L:.6g} m, c={geometry.c:.6g}, s={geometry.s:.6g}"
        )

    print("\nStep 3 - k_local")
    for element in elements:
        print_array(f"element {element.id} k_local:", k_locals[element.id])

    print("\nStep 4 - T")
    for element in elements:
        print_array(f"element {element.id} T:", transformations[element.id])

    print("\nStep 5 - k_global")
    for element in elements:
        print_array(f"element {element.id} k_global:", k_globals[element.id])

    print("\nStep 6 - DOF maps (zero-based)")
    for element in elements:
        print(f"element {element.id}: {dof_maps[element.id].tolist()}")

    print("\nStep 7 - assembled K")
    print_array("K:", K)
    print("K symmetric:", np.allclose(K, K.T))

    print("\nStep 8 - direct nodal load P")
    print_array("P:", P)

    print("\nStep 9 - equivalent element load P0")
    for element_id, p0_local, p0_global in equivalent_load_records:
        print_array(f"element {element_id} p0_local:", p0_local)
        print_array(f"element {element_id} p0_global:", p0_global)
    print_array("P0:", P0)
    print_array("P_total = P + P0:", P_total)

    print("\nStep 10 - boundary conditions and displacements")
    print("free DOFs:", free_dofs.tolist())
    print("restrained DOFs:", restrained_dofs.tolist())
    print_array("d:", d)
    for node in nodes:
        first = 3 * (node.id - 1)
        print(
            f"node {node.id}: "
            f"u={d[first]:.9e} m, "
            f"v={d[first + 1]:.9e} m, "
            f"phi={d[first + 2]:.9e} rad"
        )

    print("\nStep 11 - reactions")
    print_array("R:", R)
    print_array("support reaction R_c:", R[restrained_dofs])
    print("maximum free-DOF residual:", np.max(np.abs(R[free_dofs])))

    # Hand equilibrium check about fixed node 1:
    # Sum Fx = 5000 N; sum Fy = -10000 - 2000*2 = -14000 N.
    # Applied moment about node 1 is
    # 2*(-10000) - 1.5*(5000) + 1*(-4000) = -31500 N*m.
    expected_support_reaction = np.array([-5.0e3, 14.0e3, 31.5e3])
    print(
        "support reaction matches global equilibrium:",
        np.allclose(R[restrained_dofs], expected_support_reaction),
    )
