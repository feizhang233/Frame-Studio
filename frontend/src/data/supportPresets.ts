import type { Support } from '../domain/frame'

export interface SupportPreset {
  symbol: 'fixed' | 'pinned' | 'roller-y' | 'roller-x'
  label: string
  detail: string
  restraints: Pick<Support, 'u' | 'v' | 'phi'>
}

export const SUPPORT_PRESETS: SupportPreset[] = [
  { symbol: 'fixed', label: 'Fixed', detail: 'u′ · v′ · φ', restraints: { u: true, v: true, phi: true } },
  { symbol: 'pinned', label: 'Pinned', detail: 'u′ · v′', restraints: { u: true, v: true, phi: false } },
  { symbol: 'roller-y', label: 'Roller v′', detail: 'normal v′', restraints: { u: false, v: true, phi: false } },
  { symbol: 'roller-x', label: 'Roller u′', detail: 'normal u′', restraints: { u: true, v: false, phi: false } },
]
