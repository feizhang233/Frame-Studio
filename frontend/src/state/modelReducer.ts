import type {
  AnalysisOptions,
  DistributedLoad,
  FrameElement,
  FrameModel,
  FrameNode,
  MaterialDefinition,
  NodalLoad,
  SectionDefinition,
  Support,
} from '../domain/frame'

export type ModelAction =
  | { type: 'replace'; model: FrameModel }
  | { type: 'rename'; name: string }
  | { type: 'addNode'; node: FrameNode }
  | { type: 'updateNode'; id: number; patch: Partial<FrameNode> }
  | { type: 'addElement'; element: FrameElement }
  | { type: 'updateElement'; id: number; patch: Partial<FrameElement> }
  | { type: 'addMaterial'; material: MaterialDefinition }
  | { type: 'updateMaterial'; id: string; patch: Partial<MaterialDefinition> }
  | { type: 'deleteMaterial'; id: string }
  | { type: 'addSection'; section: SectionDefinition }
  | { type: 'updateSection'; id: string; patch: Partial<SectionDefinition> }
  | { type: 'deleteSection'; id: string }
  | { type: 'upsertSupport'; support: Support }
  | { type: 'updateSupport'; nodeId: number; patch: Partial<Support> }
  | { type: 'upsertNodalLoad'; load: NodalLoad }
  | { type: 'updateNodalLoad'; nodeId: number; patch: Partial<NodalLoad> }
  | { type: 'upsertDistributedLoad'; load: DistributedLoad }
  | { type: 'updateDistributedLoad'; elementId: number; patch: Partial<DistributedLoad> }
  | { type: 'updateOptions'; patch: Partial<AnalysisOptions> }
  | { type: 'delete'; entity: 'node' | 'element' | 'support' | 'nodalLoad' | 'distributedLoad'; id: number }

export function modelReducer(model: FrameModel, action: ModelAction): FrameModel {
  switch (action.type) {
    case 'replace':
      return action.model
    case 'rename':
      return { ...model, name: action.name }
    case 'addNode':
      return { ...model, nodes: [...model.nodes, action.node] }
    case 'updateNode':
      return {
        ...model,
        nodes: model.nodes.map((node) => (node.id === action.id ? { ...node, ...action.patch } : node)),
      }
    case 'addElement':
      return { ...model, elements: [...model.elements, action.element] }
    case 'updateElement':
      return {
        ...model,
        elements: model.elements.map((item) =>
          item.id === action.id ? { ...item, ...action.patch } : item,
        ),
      }
    case 'addMaterial':
      return { ...model, materials: [...model.materials, action.material] }
    case 'updateMaterial': {
      const updated = model.materials.find((item) => item.id === action.id)
      const nextE = action.patch.E ?? updated?.E ?? null
      return {
        ...model,
        materials: model.materials.map((item) =>
          item.id === action.id ? { ...item, ...action.patch } : item,
        ),
        elements: model.elements.map((element) =>
          element.material_id === action.id ? { ...element, E: nextE } : element,
        ),
      }
    }
    case 'deleteMaterial':
      return {
        ...model,
        materials: model.materials.filter((item) => item.id !== action.id),
        elements: model.elements.map((element) =>
          element.material_id === action.id
            ? { ...element, material_id: null, E: null }
            : element,
        ),
      }
    case 'addSection':
      return { ...model, sections: [...model.sections, action.section] }
    case 'updateSection': {
      const updated = model.sections.find((item) => item.id === action.id)
      const nextA = action.patch.A ?? updated?.A ?? null
      const nextI = action.patch.I ?? updated?.I ?? null
      return {
        ...model,
        sections: model.sections.map((item) =>
          item.id === action.id ? { ...item, ...action.patch } : item,
        ),
        elements: model.elements.map((element) =>
          element.section_id === action.id
            ? { ...element, A: nextA, I: nextI }
            : element,
        ),
      }
    }
    case 'deleteSection':
      return {
        ...model,
        sections: model.sections.filter((item) => item.id !== action.id),
        elements: model.elements.map((element) =>
          element.section_id === action.id
            ? { ...element, section_id: null, A: null, I: null }
            : element,
        ),
      }
    case 'upsertSupport':
      return {
        ...model,
        supports: model.supports.some((item) => item.node_id === action.support.node_id)
          ? model.supports.map((item) =>
              item.node_id === action.support.node_id ? action.support : item,
            )
          : [...model.supports, action.support],
      }
    case 'updateSupport':
      return {
        ...model,
        supports: model.supports.map((item) =>
          item.node_id === action.nodeId ? { ...item, ...action.patch } : item,
        ),
      }
    case 'upsertNodalLoad':
      return {
        ...model,
        nodal_loads: model.nodal_loads.some((item) => item.node_id === action.load.node_id)
          ? model.nodal_loads.map((item) =>
              item.node_id === action.load.node_id ? action.load : item,
            )
          : [...model.nodal_loads, action.load],
      }
    case 'updateNodalLoad':
      return {
        ...model,
        nodal_loads: model.nodal_loads.map((item) =>
          item.node_id === action.nodeId ? { ...item, ...action.patch } : item,
        ),
      }
    case 'upsertDistributedLoad':
      return {
        ...model,
        distributed_loads: model.distributed_loads.some(
          (item) => item.element_id === action.load.element_id,
        )
          ? model.distributed_loads.map((item) =>
              item.element_id === action.load.element_id ? action.load : item,
            )
          : [...model.distributed_loads, action.load],
      }
    case 'updateDistributedLoad':
      return {
        ...model,
        distributed_loads: model.distributed_loads.map((item) =>
          item.element_id === action.elementId ? { ...item, ...action.patch } : item,
        ),
      }
    case 'updateOptions':
      return { ...model, options: { ...model.options, ...action.patch } }
    case 'delete': {
      if (action.entity === 'node') {
        const elementIds = model.elements
          .filter((item) => item.node_i === action.id || item.node_j === action.id)
          .map((item) => item.id)
        const remainingNodes = model.nodes
          .filter((item) => item.id !== action.id)
          .sort((a, b) => a.id - b.id)
        const idMap = new Map(remainingNodes.map((item, index) => [item.id, index + 1]))
        return {
          ...model,
          nodes: remainingNodes.map((item) => ({ ...item, id: idMap.get(item.id)! })),
          elements: model.elements
            .filter((item) => !elementIds.includes(item.id))
            .map((item) => ({
              ...item,
              node_i: idMap.get(item.node_i)!,
              node_j: idMap.get(item.node_j)!,
            })),
          supports: model.supports
            .filter((item) => item.node_id !== action.id)
            .map((item) => ({ ...item, node_id: idMap.get(item.node_id)! })),
          nodal_loads: model.nodal_loads
            .filter((item) => item.node_id !== action.id)
            .map((item) => ({ ...item, node_id: idMap.get(item.node_id)! })),
          distributed_loads: model.distributed_loads.filter(
            (item) => !elementIds.includes(item.element_id),
          ),
        }
      }
      if (action.entity === 'element') {
        return {
          ...model,
          elements: model.elements.filter((item) => item.id !== action.id),
          distributed_loads: model.distributed_loads.filter((item) => item.element_id !== action.id),
        }
      }
      if (action.entity === 'support') {
        return { ...model, supports: model.supports.filter((item) => item.node_id !== action.id) }
      }
      if (action.entity === 'nodalLoad') {
        return { ...model, nodal_loads: model.nodal_loads.filter((item) => item.node_id !== action.id) }
      }
      return {
        ...model,
        distributed_loads: model.distributed_loads.filter((item) => item.element_id !== action.id),
      }
    }
  }
}
