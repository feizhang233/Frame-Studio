export type Id = number

export interface FrameNode {
  id: Id
  x: number
  y: number
}

export interface FrameElement {
  id: Id
  node_i: Id
  node_j: Id
  E: number | null
  A: number | null
  I: number | null
  material_id: string | null
  section_id: string | null
}

export interface MaterialDefinition {
  id: string
  name: string
  E: number
  poisson: number
  density: number
  color: string
}

export type SectionShape = 'custom' | 'rectangle' | 'circle' | 'i-section' | 'tube'

export interface SectionDefinition {
  id: string
  name: string
  shape: SectionShape
  A: number
  I: number
  description: string
  color: string
}

export interface Support {
  node_id: Id
  u: boolean
  v: boolean
  phi: boolean
  u_value: number
  v_value: number
  phi_value: number
  angle: number
}

export interface NodalLoad {
  node_id: Id
  fx: number
  fy: number
  mz: number
}

export interface DistributedLoad {
  element_id: Id
  qx_i: number
  qy_i: number
  qx_j: number
  qy_j: number
}

export interface AnalysisOptions {
  number_of_points: number
  deformation_scale: number
  include_plots: boolean
  plot_dpi: number
}

export interface FrameModel {
  name: string
  materials: MaterialDefinition[]
  sections: SectionDefinition[]
  nodes: FrameNode[]
  elements: FrameElement[]
  supports: Support[]
  nodal_loads: NodalLoad[]
  distributed_loads: DistributedLoad[]
  options: AnalysisOptions
}

export interface ElementDefaults {
  materialId: string | null
  sectionId: string | null
}

export type SupportDefaults = Pick<Support, 'u' | 'v' | 'phi' | 'angle'>

export type NodalLoadDefaults = Pick<NodalLoad, 'fx' | 'fy' | 'mz'>

export interface ModelHistoryEntry {
  id: string
  name: string
  savedAt: string
  source: 'saved' | 'analyzed'
  model: FrameModel
}

export type ToolMode =
  | 'select'
  | 'node'
  | 'insert-node'
  | 'material'
  | 'section'
  | 'element'
  | 'support'
  | 'load'
  | 'models'

export type Selection =
  | { type: 'node'; id: Id }
  | { type: 'element'; id: Id }
  | { type: 'support'; id: Id }
  | { type: 'nodalLoad'; id: Id }
  | { type: 'distributedLoad'; id: Id }
  | null

export const DEFAULT_ELEMENT_PROPERTIES = {
  E: null,
  A: null,
  I: null,
  material_id: null,
  section_id: null,
} as const

export const createDefaultMaterials = (): MaterialDefinition[] => [
  { id: 'steel-s355', name: 'Structural Steel S355', E: 210e9, poisson: 0.3, density: 7850, color: '#405aa6' },
  { id: 'concrete-c30', name: 'Concrete C30/37', E: 30e9, poisson: 0.2, density: 2400, color: '#8a8178' },
  { id: 'aluminium-6061', name: 'Aluminium 6061-T6', E: 69e9, poisson: 0.33, density: 2700, color: '#6f8595' },
  { id: 'timber-gl28', name: 'Glulam GL28', E: 11.6e9, poisson: 0.35, density: 480, color: '#a96f42' },
]

export const createDefaultSections = (): SectionDefinition[] => [
  { id: 'custom-frame', name: 'Frame custom', shape: 'custom', A: 0.006, I: 8.5e-5, description: 'User-defined A / I', color: '#58677a' },
  { id: 'rect-200x300', name: 'Rect. 200 × 300', shape: 'rectangle', A: 0.06, I: 4.5e-4, description: 'Solid rectangle', color: '#7c6fb1' },
  { id: 'ipe-200', name: 'IPE 200', shape: 'i-section', A: 2.85e-3, I: 1.943e-5, description: 'European I section', color: '#397e8d' },
  { id: 'chs-168', name: 'CHS 168.3 × 8', shape: 'tube', A: 4.03e-3, I: 1.30e-5, description: 'Circular hollow section', color: '#9b7046' },
]

export const DEFAULT_OPTIONS: AnalysisOptions = {
  number_of_points: 101,
  deformation_scale: 1,
  // Keep false by default for faster API responses; N/V/M still render from field data.
  include_plots: false,
  plot_dpi: 140,
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

export function parseFrameModel(value: unknown): FrameModel {
  if (!value || typeof value !== 'object') {
    throw new Error('檔案內容必須是 JSON 物件。')
  }

  const source = value as Record<string, unknown>
  const nodes = source.nodes
  const elements = source.elements
  if (!Array.isArray(nodes) || !Array.isArray(elements)) {
    throw new Error('模型必須包含 nodes 與 elements 陣列。')
  }

  const parsedNodes = nodes.map((item, index) => {
    const node = item as Partial<FrameNode>
    if (!Number.isInteger(node.id) || !isFiniteNumber(node.x) || !isFiniteNumber(node.y)) {
      throw new Error(`節點 ${index + 1} 的 id、x 或 y 無效。`)
    }
    return { id: node.id as number, x: node.x, y: node.y }
  })

  const parsedElements = elements.map((item, index) => {
    const element = item as Partial<FrameElement>
    if (
      !Number.isInteger(element.id) ||
      !Number.isInteger(element.node_i) ||
      !Number.isInteger(element.node_j) ||
      !isFiniteNumber(element.E) ||
      !isFiniteNumber(element.A) ||
      !isFiniteNumber(element.I)
    ) {
      throw new Error(`構件 ${index + 1} 的欄位無效。`)
    }
    return {
      id: element.id as number,
      node_i: element.node_i as number,
      node_j: element.node_j as number,
      E: element.E,
      A: element.A,
      I: element.I,
      material_id: typeof element.material_id === 'string' ? element.material_id : null,
      section_id: typeof element.section_id === 'string' ? element.section_id : null,
    }
  })

  const supports = Array.isArray(source.supports)
    ? source.supports.map((item) => {
        const support = item as Partial<Support>
        return {
          node_id: Number(support.node_id),
          u: support.u ?? false,
          v: support.v ?? false,
          phi: support.phi ?? false,
          u_value: support.u_value ?? 0,
          v_value: support.v_value ?? 0,
          phi_value: support.phi_value ?? 0,
          angle: support.angle ?? 0,
        }
      })
    : []

  const nodalLoads = Array.isArray(source.nodal_loads)
    ? source.nodal_loads.map((item) => {
        const load = item as Partial<NodalLoad>
        return {
          node_id: Number(load.node_id),
          fx: load.fx ?? 0,
          fy: load.fy ?? 0,
          mz: load.mz ?? 0,
        }
      })
    : []

  const distributedLoads = Array.isArray(source.distributed_loads)
    ? source.distributed_loads.map((item) => {
        const load = item as Partial<DistributedLoad>
        return {
          element_id: Number(load.element_id),
          qx_i: load.qx_i ?? 0,
          qy_i: load.qy_i ?? 0,
          qx_j: load.qx_j ?? 0,
          qy_j: load.qy_j ?? 0,
        }
      })
    : []

  return {
    name: typeof source.name === 'string' ? source.name : 'Imported frame',
    materials: Array.isArray(source.materials)
      ? (source.materials as MaterialDefinition[])
      : createDefaultMaterials(),
    sections: Array.isArray(source.sections)
      ? (source.sections as SectionDefinition[])
      : createDefaultSections(),
    nodes: parsedNodes,
    elements: parsedElements,
    supports,
    nodal_loads: nodalLoads,
    distributed_loads: distributedLoads,
    options: {
      ...DEFAULT_OPTIONS,
      ...(source.options && typeof source.options === 'object' ? source.options : {}),
      number_of_points:
        typeof source.number_of_points === 'number'
          ? source.number_of_points
          : ((source.options as Partial<AnalysisOptions> | undefined)?.number_of_points ??
            DEFAULT_OPTIONS.number_of_points),
      deformation_scale:
        typeof source.deformation_scale === 'number'
          ? source.deformation_scale
          : ((source.options as Partial<AnalysisOptions> | undefined)?.deformation_scale ??
            DEFAULT_OPTIONS.deformation_scale),
      include_plots:
        typeof source.include_plots === 'boolean'
          ? source.include_plots
          : ((source.options as Partial<AnalysisOptions> | undefined)?.include_plots ?? false),
      plot_dpi:
        typeof source.plot_dpi === 'number'
          ? source.plot_dpi
          : ((source.options as Partial<AnalysisOptions> | undefined)?.plot_dpi ??
            DEFAULT_OPTIONS.plot_dpi),
    },
  }
}

export function getElementProperties(model: FrameModel, element: FrameElement) {
  const material = model.materials.find((item) => item.id === element.material_id)
  const section = model.sections.find((item) => item.id === element.section_id)
  const E = material?.E ?? element.E
  const A = section?.A ?? element.A
  const I = section?.I ?? element.I
  return { E, A, I, material, section }
}

export function findFirstAssignmentIssue(model: FrameModel) {
  for (const element of model.elements) {
    const properties = getElementProperties(model, element)
    if (properties.E === null || !Number.isFinite(properties.E) || properties.E <= 0) {
      return { type: 'material' as const, elementId: element.id }
    }
    if (
      properties.A === null ||
      properties.I === null ||
      !Number.isFinite(properties.A) ||
      !Number.isFinite(properties.I) ||
      properties.A <= 0 ||
      properties.I <= 0
    ) {
      return { type: 'section' as const, elementId: element.id }
    }
  }
  return null
}

export function toSolverPayload(model: FrameModel) {
  const elements = model.elements.map((element) => {
    const { E, A, I } = getElementProperties(model, element)
    if (E === null || A === null || I === null || E <= 0 || A <= 0 || I <= 0) {
      throw new Error(`Element E${element.id} is missing material or section properties.`)
    }
    return {
      id: element.id,
      node_i: element.node_i,
      node_j: element.node_j,
      E,
      A,
      I,
    }
  })
  return {
    nodes: model.nodes,
    elements,
    supports: model.supports,
    nodal_loads: model.nodal_loads,
    distributed_loads: model.distributed_loads,
    ...model.options,
  }
}
