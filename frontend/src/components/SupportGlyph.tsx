import type { Support } from '../domain/frame'

type SupportGlyphProps = {
  support: Pick<Support, 'u' | 'v' | 'phi'>
}

/** Shared SVG geometry for supports on both the model canvas and result diagrams. */
export function SupportGlyph({ support }: SupportGlyphProps) {
  if (support.u && support.v && support.phi) {
    return (
      <>
        <rect x="-15" y="0" width="30" height="8" rx="2" />
        {[-12, -4, 4, 12].map((x) => <line key={x} x1={x} y1="9" x2={x - 7} y2="18" />)}
      </>
    )
  }

  if (support.u && support.v) {
    return <><path d="M 0 0 L -14 20 L 14 20 Z" /><line x1="-18" y1="22" x2="18" y2="22" /></>
  }

  if (support.v) {
    return <><path d="M 0 0 L -14 18 L 14 18 Z" /><circle cx="-8" cy="23" r="3" /><circle cx="8" cy="23" r="3" /><line x1="-18" y1="28" x2="18" y2="28" /></>
  }

  if (support.u) {
    return <g transform="rotate(-90)"><path d="M 0 0 L -14 18 L 14 18 Z" /><circle cx="-8" cy="23" r="3" /><circle cx="8" cy="23" r="3" /><line x1="-18" y1="28" x2="18" y2="28" /></g>
  }

  return <><circle r="11" fill="none" /><text x="0" y="4" textAnchor="middle">φ</text></>
}
