import { getElementProperties, type FrameModel, type ToolMode } from '../domain/frame'

/** Modeling workflow stages shown in the progress stepper and onboarding. */
export interface WorkflowStep {
  id: string
  label: string
  shortLabel: string
  tool: ToolMode
  description: string
  howTo: string
  shortcut?: string
}

export const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: 'nodes',
    label: 'Place nodes',
    shortLabel: 'Nodes',
    tool: 'node',
    description: 'Define joint locations in the global XY plane.',
    howTo: 'Select Node (N), enter X/Y coordinates or click the canvas. Coordinates snap to 0.25 m.',
    shortcut: 'N',
  },
  {
    id: 'elements',
    label: 'Connect elements',
    shortLabel: 'Elements',
    tool: 'element',
    description: 'Create frame members by connecting two nodes.',
    howTo: 'Select Element (E), click a start node, then an end node. Keep clicking to chain members. Esc or right-click cancels.',
    shortcut: 'E',
  },
  {
    id: 'materials',
    label: 'Define materials',
    shortLabel: 'Material',
    tool: 'material',
    description: 'Create material cards with elastic modulus E.',
    howTo: 'Open Material (M), edit E, then assign to the members you just drew.',
    shortcut: 'M',
  },
  {
    id: 'supports',
    label: 'Add supports',
    shortLabel: 'Supports',
    tool: 'support',
    description: 'Restrain degrees of freedom at supports.',
    howTo: 'Select Support (S), pick a preset, then click a node.',
    shortcut: 'S',
  },
  {
    id: 'sections',
    label: 'Define sections',
    shortLabel: 'Section',
    tool: 'section',
    description: 'Create section cards with area A and inertia I.',
    howTo: 'Open Section (C), set A and I (or pick a shape), then assign to elements.',
    shortcut: 'C',
  },
  {
    id: 'loads',
    label: 'Apply loads',
    shortLabel: 'Loads',
    tool: 'load',
    description: 'Apply nodal forces/moments or distributed loads.',
    howTo: 'Select Load (L), set defaults, then click a node or element.',
    shortcut: 'L',
  },
  {
    id: 'analyze',
    label: 'Run analysis',
    shortLabel: 'Analyze',
    tool: 'select',
    description: 'Solve the model and inspect displacements, reactions, and N/V/M.',
    howTo: 'Assign material & section on every element, then click Run Analysis.',
  },
]

export interface ToolHint {
  title: string
  body: string
  tips: string[]
}

export const TOOL_HINTS: Record<ToolMode, ToolHint> = {
  select: {
    title: 'Select tool',
    body: 'Click nodes, elements, supports, or loads to edit properties on the right.',
    tips: [
      'Drag empty canvas to pan; use the zoom controls in the canvas toolbar.',
      'Press V to return to Select from any modeling tool.',
    ],
  },
  node: {
    title: 'Place nodes',
    body: 'Enter X/Y in the Properties panel or click the canvas to create joints. Coordinates snap to 0.25 m.',
    tips: [
      'Use Place by coordinates when you know exact positions.',
      'Edit X/Y later by selecting a node. Place at least two nodes, then switch to Element to connect them.',
    ],
  },
  'insert-node': {
    title: 'Insert node on element',
    body: 'Choose an existing element to open its split controls, then place the new node by fraction or distance.',
    tips: [
      'The original element is replaced by two connected elements.',
      'Material, section, and distributed-load data are preserved on both parts.',
    ],
  },
  material: {
    title: 'Material library',
    body: 'Materials are reusable resources (E). Assign them to elements before analysis.',
    tips: [
      'Create or edit material cards here, then apply to one or all elements.',
      'Missing material on an element blocks Save and Run Analysis.',
    ],
  },
  section: {
    title: 'Section library',
    body: 'Sections store A and I. Shape presets help estimate values.',
    tips: [
      'Assign sections the same way as materials—per element or all at once.',
      'Effective E, A, I appear on the element property sheet.',
    ],
  },
  element: {
    title: 'Draw elements',
    body: 'Click two points to draw a member. Existing nodes snap automatically; empty clicks place a new node.',
    tips: [
      'First click sets the start node, second click completes the segment. Continue clicking to chain members.',
      'Right-click or Esc cancels the current start. Duplicate members between the same nodes are ignored.',
      'Assign Material and Section afterwards — they are not required to draw the line.',
    ],
  },
  support: {
    title: 'Add supports',
    body: 'Choose a support preset, then click a node to attach restraints.',
    tips: [
      'Presets: fixed, pin, rollers. Fine-tune DOF and prescribed displacements after.',
      'Support orientation angle rotates the local u′ axis from global +X.',
    ],
  },
  load: {
    title: 'Apply loads',
    body: 'Set default Fx/Fy/Mz, then click a node for a nodal load or an element for distributed load.',
    tips: [
      'Positive moment is counter-clockwise about +Z (right-hand rule).',
      'Distributed loads follow each element’s local axes.',
    ],
  },
  models: {
    title: 'Models & examples',
    body: 'Restore recent snapshots or load example frames to learn the workflow.',
    tips: [
      'When signed in, private models and analysis snapshots are synced to MySQL.',
      'Signed-in users can drag a recent model into Examples for the current session.',
    ],
  },
}

function hasCompleteMaterialAssignments(model: FrameModel): boolean {
  return model.materials.length > 0 && model.elements.every((element) => {
    const { E } = getElementProperties(model, element)
    return E !== null && Number.isFinite(E) && E > 0
  })
}

function hasCompleteSectionAssignments(model: FrameModel): boolean {
  return model.sections.length > 0 && model.elements.every((element) => {
    const { A, I } = getElementProperties(model, element)
    return (
      A !== null
      && I !== null
      && Number.isFinite(A)
      && Number.isFinite(I)
      && A > 0
      && I > 0
    )
  })
}

/** Index of the first incomplete workflow step (0-based). Analyze is always last. */
export function getActiveWorkflowIndex(model: FrameModel): number {
  if (model.nodes.length === 0) return 0
  if (model.elements.length === 0) return 1
  if (!hasCompleteMaterialAssignments(model)) return 2
  if (model.supports.length === 0) return 3
  if (!hasCompleteSectionAssignments(model)) return 4
  const hasLoads =
    model.nodal_loads.length > 0 || model.distributed_loads.length > 0
  if (!hasLoads) return 5
  return 6
}

export function isWorkflowStepComplete(model: FrameModel, stepIndex: number): boolean {
  switch (stepIndex) {
    case 0:
      return model.nodes.length > 0
    case 1:
      return model.elements.length > 0
    case 2:
      return model.elements.length > 0 && hasCompleteMaterialAssignments(model)
    case 3:
      return model.supports.length > 0
    case 4:
      return model.elements.length > 0 && hasCompleteSectionAssignments(model)
    case 5:
      return model.nodal_loads.length > 0 || model.distributed_loads.length > 0
    case 6:
      return (
        model.nodes.length > 0
        && model.elements.length > 0
        && model.supports.length > 0
        && hasCompleteMaterialAssignments(model)
        && hasCompleteSectionAssignments(model)
      )
    default:
      return false
  }
}

export const ONBOARDING_KEY = 'frame-studio:onboarding-dismissed:v1'
export const GUIDANCE_VISIBLE_KEY = 'frame-studio:guidance-visible:v1'
