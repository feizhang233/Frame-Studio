import {
  DEFAULT_OPTIONS,
  createDefaultMaterials,
  createDefaultSections,
  type FrameModel,
} from '../domain/frame'

export interface ExampleModelDefinition {
  id: string
  name: string
  description: string
  model: FrameModel
}

const assignedElement = (id: number, node_i: number, node_j: number) => ({
  id,
  node_i,
  node_j,
  E: 210e9,
  A: 0.006,
  I: 8.5e-5,
  material_id: 'steel-s355',
  section_id: 'custom-frame',
})

export const exampleModel: FrameModel = {
  name: 'Portal frame 01',
  materials: createDefaultMaterials(),
  sections: createDefaultSections(),
  nodes: [
    { id: 1, x: 0, y: 0 },
    { id: 2, x: 0, y: 3 },
    { id: 3, x: 5, y: 3 },
    { id: 4, x: 5, y: 0 },
  ],
  elements: [
    assignedElement(1, 1, 2),
    assignedElement(2, 2, 3),
    assignedElement(3, 3, 4),
  ],
  supports: [
    { node_id: 1, u: true, v: true, phi: true, u_value: 0, v_value: 0, phi_value: 0, angle: 0 },
    { node_id: 4, u: true, v: true, phi: true, u_value: 0, v_value: 0, phi_value: 0, angle: 0 },
  ],
  nodal_loads: [{ node_id: 3, fx: 3500, fy: -12000, mz: 0 }],
  distributed_loads: [
    { element_id: 2, qx_i: 0, qy_i: -6500, qx_j: 0, qy_j: -6500 },
  ],
  options: { ...DEFAULT_OPTIONS },
}

const simplySupportedBeam: FrameModel = {
  name: 'Simply supported beam',
  materials: createDefaultMaterials(),
  sections: createDefaultSections(),
  nodes: [
    { id: 1, x: 0, y: 0 },
    { id: 2, x: 3, y: 0 },
    { id: 3, x: 6, y: 0 },
  ],
  elements: [assignedElement(1, 1, 2), assignedElement(2, 2, 3)],
  supports: [
    { node_id: 1, u: true, v: true, phi: false, u_value: 0, v_value: 0, phi_value: 0, angle: 0 },
    { node_id: 3, u: false, v: true, phi: false, u_value: 0, v_value: 0, phi_value: 0, angle: 0 },
  ],
  nodal_loads: [{ node_id: 2, fx: 0, fy: -15000, mz: 0 }],
  distributed_loads: [],
  options: { ...DEFAULT_OPTIONS },
}

const cantileverBeam: FrameModel = {
  name: 'Cantilever beam',
  materials: createDefaultMaterials(),
  sections: createDefaultSections(),
  nodes: [
    { id: 1, x: 0, y: 0 },
    { id: 2, x: 4, y: 0 },
  ],
  elements: [assignedElement(1, 1, 2)],
  supports: [
    { node_id: 1, u: true, v: true, phi: true, u_value: 0, v_value: 0, phi_value: 0, angle: 0 },
  ],
  nodal_loads: [{ node_id: 2, fx: 0, fy: -10000, mz: 0 }],
  distributed_loads: [],
  options: { ...DEFAULT_OPTIONS },
}

export const commonExampleModels: ExampleModelDefinition[] = [
  {
    id: 'portal-frame',
    name: 'Portal frame',
    description: 'Fixed-base frame with a distributed beam load.',
    model: exampleModel,
  },
  {
    id: 'simply-supported-beam',
    name: 'Simply supported beam',
    description: 'Pinned and roller supports with a center point load.',
    model: simplySupportedBeam,
  },
  {
    id: 'cantilever-beam',
    name: 'Cantilever beam',
    description: 'Fixed-end beam with a vertical tip load.',
    model: cantileverBeam,
  },
]

export const createBlankModel = (): FrameModel => ({
  name: 'Untitled frame',
  materials: createDefaultMaterials(),
  sections: createDefaultSections(),
  nodes: [],
  elements: [],
  supports: [],
  nodal_loads: [],
  distributed_loads: [],
  options: { ...DEFAULT_OPTIONS },
})
