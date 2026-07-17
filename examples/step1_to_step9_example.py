"""Complete cumulative example for Steps 1-9.

Model: a two-element L-shaped frame in the global X-Y plane.

                       node 3 (2, 1.5)
                         |
                         | element 2
                         |
    node 1 (0, 0) ---- node 2 (2, 0)
             element 1

Element 1 carries a uniform local transverse load. The example stops after
constructing K, P, P0 and P_total; it does not apply boundary conditions or
solve for displacements.
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
    calculate_node_dof_map,
    calculate_transformation,
)


# Step 1: input data in SI units.
# Coordinates [m], E [Pa], A [m^2], I [m^4], concentrated loads [N],
# concentrated moments [N*m], and distributed loads [N/m].
nodes = [
    Node(id=1, x=0.0, y=0.0),
    Node(id=2, x=2.0, y=0.0),
    Node(id=3, x=2.0, y=1.5),
]

elements = [
    FrameElement(
        id=1,
        node_i=1,
        node_j=2,
        E=210.0e9,
        A=2.0e-3,
        I=8.0e-6,
    ),
    FrameElement(
        id=2,
        node_i=2,
        node_j=3,
        E=210.0e9,
        A=2.0e-3,
        I=8.0e-6,
    ),
]

supports = [Support(node_id=1, u=True, v=True, phi=True)]
nodal_loads = [NodalLoad(node_id=3, fx=5.0e3, fy=-10.0e3)]
distributed_loads = [
    DistributedLoad(element_id=1, qy_i=-2.0e3, qy_j=-2.0e3)
]

nodes_by_id = {node.id: node for node in nodes}
elements_by_id = {element.id: element for element in elements}

# Store per-element results so each calculation step remains inspectable.
geometries = {}
k_locals = {}
transformations = {}
k_globals = {}
dof_maps = {}

for element in elements:
    node_i = nodes_by_id[element.node_i]
    node_j = nodes_by_id[element.node_j]

    # Step 2: directed element geometry L, c and s.
    geometry = calculate_geometry(element, node_i, node_j)
    geometries[element.id] = geometry

    # Step 3: local stiffness in
    # [u_i, v_i, phi_i, u_j, v_j, phi_j] order.
    k_local = calculate_local_stiffness(element, geometry.L)
    k_locals[element.id] = k_local

    # Step 4: displacement transformation d_local = T @ d_global.
    transformation = calculate_transformation(geometry)
    transformations[element.id] = transformation

    # Step 5: element stiffness in global coordinates.
    k_global = calculate_global_stiffness(k_local, transformation)
    k_globals[element.id] = k_global

    # Step 6: zero-based global DOF map for NumPy indexing.
    dof_maps[element.id] = calculate_element_dof_map(element)

# Step 7: assemble K[I_e, I_e] += k_global.
stiffness_contributions = [
    (element, k_globals[element.id]) for element in elements
]
K = assemble_global_stiffness(len(nodes), stiffness_contributions)

# Step 8: assemble direct concentrated nodal loads in global coordinates.
P = assemble_nodal_load_vector(len(nodes), nodal_loads)

# Step 9: calculate local and global consistent element loads, then assemble P0.
equivalent_load_records = []
equivalent_load_contributions = []
for distributed_load in distributed_loads:
    element = elements_by_id[distributed_load.element_id]
    geometry = geometries[element.id]
    transformation = transformations[element.id]

    p0_local = calculate_local_equivalent_nodal_load(
        element,
        distributed_load,
        geometry.L,
    )
    p0_global = calculate_global_equivalent_nodal_load(
        p0_local,
        transformation,
    )
    equivalent_load_records.append(
        (distributed_load, element, p0_local, p0_global)
    )
    equivalent_load_contributions.append((element, p0_global))

P0 = assemble_equivalent_nodal_load_vector(
    len(nodes),
    equivalent_load_contributions,
)
P_total = P + P0


def print_matrix(name: str, matrix: np.ndarray) -> None:
    print(name)
    print(np.array2string(matrix, precision=3, suppress_small=True))


def print_vector(name: str, vector: np.ndarray) -> None:
    print(f"{name} = {np.array2string(vector, precision=3, suppress_small=True)}")


if __name__ == "__main__":
    print("Step 1 - input data")
    print("nodes:", nodes)
    print("elements:", elements)
    print("supports:", supports)
    print("nodal loads:", nodal_loads)
    print("distributed loads:", distributed_loads)

    print("\nStep 2 - element geometry")
    for element in elements:
        geometry = geometries[element.id]
        print(
            f"element {element.id}: "
            f"L={geometry.L:.6g} m, c={geometry.c:.6g}, s={geometry.s:.6g}"
        )

    print("\nStep 3 - local stiffness matrices")
    for element in elements:
        print_matrix(f"element {element.id} k_local:", k_locals[element.id])

    print("\nStep 4 - transformation matrices")
    for element in elements:
        print_matrix(f"element {element.id} T:", transformations[element.id])

    print("\nStep 5 - element stiffness matrices in global coordinates")
    for element in elements:
        print_matrix(f"element {element.id} k_global:", k_globals[element.id])

    print("\nStep 6 - global DOF maps (zero-based NumPy indices)")
    for node in nodes:
        print(f"node {node.id}: {calculate_node_dof_map(node.id).tolist()}")
    for element in elements:
        print(f"element {element.id}: {dof_maps[element.id].tolist()}")

    print("\nStep 7 - assembled global stiffness matrix")
    print_matrix("K:", K)
    print("K shape:", K.shape)
    print("K is symmetric:", np.allclose(K, K.T))
    expected_shared_block = (
        k_globals[1][3:6, 3:6] + k_globals[2][0:3, 0:3]
    )
    print(
        "shared node 2 block matches element-end sum:",
        np.allclose(K[3:6, 3:6], expected_shared_block),
    )

    print("\nStep 8 - direct nodal load vector")
    print_vector("P", P)

    print("\nStep 9 - consistent equivalent nodal loads")
    for distributed_load, element, p0_local, p0_global in equivalent_load_records:
        print(f"element {element.id}, load {distributed_load}")
        print_vector("p0_local", p0_local)
        print_vector("p0_global", p0_global)
    print_vector("P0", P0)
    print_vector("P_total = P + P0", P_total)

    # Hand checks for the selected horizontal uniform-load example.
    expected_P = np.array(
        [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 5.0e3, -10.0e3, 0.0]
    )
    expected_P0 = np.array(
        [
            0.0,
            -2.0e3,
            -2.0e3 / 3.0,
            0.0,
            -2.0e3,
            2.0e3 / 3.0,
            0.0,
            0.0,
            0.0,
        ]
    )
    print("P matches hand calculation:", np.allclose(P, expected_P))
    print("P0 matches hand calculation:", np.allclose(P0, expected_P0))
    print(
        "P_total matches P + P0:",
        np.allclose(P_total, expected_P + expected_P0),
    )
