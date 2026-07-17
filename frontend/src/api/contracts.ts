import type { FrameElement } from '../domain/frame'

export interface NodalDisplacementResult {
  node_id: number
  u: number
  v: number
  phi: number
}

export interface NodalReactionResult {
  node_id: number
  fx: number
  fy: number
  mz: number
}

export interface ElementFieldsResult {
  x_local: number[]
  axial_displacement: number[]
  transverse_displacement: number[]
  rotation: number[]
  axial_force: number[]
  shear_force: number[]
  bending_moment: number[]
  x_global: number[]
  y_global: number[]
  x_deformed: number[]
  y_deformed: number[]
}

export interface ElementAnalysisResult {
  element_id: FrameElement['id']
  length: number
  direction_cosine_x: number
  direction_cosine_y: number
  local_displacements: number[]
  local_end_forces: number[]
  fields: ElementFieldsResult
  validation: {
    axial_residual: number
    shear_residual: number
    moment_residual: number
    maximum_normalized_residual: number
    passed: boolean
  }
}

export interface SolveResponse {
  displacement_dof_order: string
  force_dof_order: string
  free_dofs: number[]
  restrained_dofs: number[]
  nodal_displacements: NodalDisplacementResult[]
  nodal_reactions: NodalReactionResult[]
  elements: ElementAnalysisResult[]
  validation: {
    stiffness_symmetry_ratio: number
    free_dof_residual_ratio: number
    passed: boolean
  }
  plots: null | {
    shear_force_v: { filename: string; media_type: string; data_uri: string }
    bending_moment_m: { filename: string; media_type: string; data_uri: string }
  }
}
