import type { ElementFieldsResult } from '../api/contracts'

export type ResultTab = 'displacement' | 'reaction' | FieldResultTab
export type FieldResultTab = 'N' | 'V' | 'M'
export type FieldResultKey = keyof Pick<ElementFieldsResult, 'axial_force' | 'shear_force' | 'bending_moment'>

export const resultTabs: Array<{ id: ResultTab; label: string; symbol: string }> = [
  { id: 'displacement', label: 'Displacement', symbol: 'δ' },
  { id: 'reaction', label: 'Reaction', symbol: 'R' },
  { id: 'N', label: 'Axial force', symbol: 'N' },
  { id: 'V', label: 'Shear force', symbol: 'V' },
  { id: 'M', label: 'Bending moment', symbol: 'M' },
]

export const fieldKey: Record<FieldResultTab, FieldResultKey> = {
  N: 'axial_force',
  V: 'shear_force',
  M: 'bending_moment',
}

export const fieldMeta: Record<FieldResultTab, { title: string; symbol: string; unit: string }> = {
  N: { title: 'Axial force', symbol: 'N', unit: 'N' },
  V: { title: 'Shear force', symbol: 'V', unit: 'N' },
  M: { title: 'Bending moment', symbol: 'M', unit: 'N·m' },
}

export function isFieldResultTab(tab: ResultTab): tab is FieldResultTab {
  return tab === 'N' || tab === 'V' || tab === 'M'
}

export function displayScale(values: number[], baseUnit: string) {
  const maximum = Math.max(0, ...values.map(Math.abs))
  if (maximum >= 1e6) return { divisor: 1e6, unit: `M${baseUnit}` }
  if (maximum >= 1e3) return { divisor: 1e3, unit: `k${baseUnit}` }
  return { divisor: 1, unit: baseUnit }
}
