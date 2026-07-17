import { Activity, CheckCircle2, ChevronsDown, ChevronsUp, CircleAlert, Play, Table2 } from 'lucide-react'
import type { SolveResponse } from '../api/contracts'
import type { FrameModel } from '../domain/frame'
import { formatEngineering, formatNumber } from '../utils/format'
import { SupportGlyph } from './SupportGlyph'

export type ResultTab = 'displacement' | 'reaction' | 'N' | 'V' | 'M'

interface ResultsPanelProps {
  model: FrameModel
  result: SolveResponse | null
  activeTab: ResultTab
  isRunning: boolean
  isExpanded: boolean
  error: string | null
  onTabChange: (tab: ResultTab) => void
  onToggleExpanded: () => void
  onRun: () => void
}

const tabs: Array<{ id: ResultTab; label: string; symbol: string }> = [
  { id: 'displacement', label: 'Displacement', symbol: 'δ' },
  { id: 'reaction', label: 'Reaction', symbol: 'R' },
  { id: 'N', label: 'Axial force', symbol: 'N' },
  { id: 'V', label: 'Shear force', symbol: 'V' },
  { id: 'M', label: 'Bending moment', symbol: 'M' },
]

const fieldKey = {
  N: 'axial_force',
  V: 'shear_force',
  M: 'bending_moment',
} as const

const fieldMeta = {
  N: { title: 'Axial force', symbol: 'N', unit: 'N' },
  V: { title: 'Shear force', symbol: 'V', unit: 'N' },
  M: { title: 'Bending moment', symbol: 'M', unit: 'N·m' },
} as const

function displayScale(values: number[], baseUnit: string) {
  const maximum = Math.max(0, ...values.map(Math.abs))
  if (maximum >= 1e6) return { divisor: 1e6, unit: `M${baseUnit}` }
  if (maximum >= 1e3) return { divisor: 1e3, unit: `k${baseUnit}` }
  return { divisor: 1, unit: baseUnit }
}

interface DiagramPoint {
  x: number
  y: number
  value: number
}

function splitDiagramSegments(points: DiagramPoint[]) {
  if (points.length < 2) return []
  const segments: Array<{ sign: 1 | -1; points: DiagramPoint[] }> = []
  let sign: 1 | -1 = (points.find((point) => point.value !== 0)?.value ?? 1) >= 0 ? 1 : -1
  let current: DiagramPoint[] = [points[0]]
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1]
    const point = points[index]
    if (previous.value * point.value < 0) {
      const ratio = Math.abs(previous.value) / (Math.abs(previous.value) + Math.abs(point.value))
      const zero = {
        x: previous.x + (point.x - previous.x) * ratio,
        y: previous.y + (point.y - previous.y) * ratio,
        value: 0,
      }
      current.push(zero)
      segments.push({ sign, points: current })
      sign = point.value >= 0 ? 1 : -1
      current = [zero, point]
    } else {
      current.push(point)
      if (previous.value === 0 && point.value !== 0) sign = point.value >= 0 ? 1 : -1
    }
  }
  if (current.length > 1) segments.push({ sign, points: current })
  return segments
}

function ResultChart({ result, tab, model }: { result: SolveResponse; tab: 'N' | 'V' | 'M'; model: FrameModel }) {
  const values = result.elements.flatMap((element) => element.fields[fieldKey[tab]])
  const maxAbs = Math.max(1e-12, ...values.map(Math.abs))
  const meta = fieldMeta[tab]
  const scale = displayScale(values, meta.unit)
  const chart = { width: 780, height: 320, marginX: 92, marginY: 66 }
  const allX = result.elements.flatMap((element) => element.fields.x_global)
  const allY = result.elements.flatMap((element) => element.fields.y_global)
  const minX = Math.min(...allX)
  const maxX = Math.max(...allX)
  const minY = Math.min(...allY)
  const maxY = Math.max(...allY)
  const geometryScale = Math.min(
    (chart.width - chart.marginX * 2) / Math.max(1, maxX - minX),
    (chart.height - chart.marginY * 2) / Math.max(1, maxY - minY),
  )
  const geometryWidth = (maxX - minX) * geometryScale
  const geometryHeight = (maxY - minY) * geometryScale
  const originX = (chart.width - geometryWidth) / 2 - minX * geometryScale
  const originY = (chart.height - geometryHeight) / 2 + maxY * geometryScale
  const point = (x: number, y: number) => ({ x: originX + x * geometryScale, y: originY - y * geometryScale })
  const diagramOffset = Math.min(60, Math.max(38, geometryScale * 0.42))

  return (
    <div className="result-chart-wrap">
      <div className="chart-heading">
        <div>
          <span>STRUCTURAL DIAGRAM</span>
          <strong>{meta.title} <i>{meta.symbol}</i></strong>
        </div>
        <div className="diagram-legend"><span><i className="positive" /> Positive</span><span><i className="negative" /> Negative</span><b>{scale.unit}</b></div>
      </div>
      <svg className="result-chart" viewBox={`0 0 ${chart.width} ${chart.height}`} preserveAspectRatio="xMidYMid meet" aria-label={`${meta.title} diagram`}>
        <defs>
          <filter id="diagram-soft-shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.12" /></filter>
        </defs>
        {result.elements.map((element) => {
          const field = element.fields[fieldKey[tab]]
          const basePoints = element.fields.x_global.map((x, index) => {
            const base = point(x, element.fields.y_global[index])
            return { ...base, value: field[index] }
          })
          const first = basePoints[0]
          const last = basePoints[basePoints.length - 1]
          const dx = last.x - first.x
          const dy = last.y - first.y
          const length = Math.hypot(dx, dy) || 1
          const normal = { x: -dy / length, y: dx / length }
          const segments = splitDiagramSegments(basePoints)
          return (
            <g key={element.element_id} className="frame-diagram-element">
              {segments.map((segment, segmentIndex) => {
                const offset = segment.points.map((diagramPoint) => ({
                  x: diagramPoint.x + normal.x * (diagramPoint.value / maxAbs) * diagramOffset,
                  y: diagramPoint.y + normal.y * (diagramPoint.value / maxAbs) * diagramOffset,
                  value: diagramPoint.value,
                }))
                const polygon = [
                  ...segment.points.map((diagramPoint) => `${diagramPoint.x},${diagramPoint.y}`),
                  ...offset.slice().reverse().map((diagramPoint) => `${diagramPoint.x},${diagramPoint.y}`),
                ].join(' ')
                const strongest = offset.reduce((current, item) => Math.abs(item.value) > Math.abs(current.value) ? item : current, offset[0])
                return <g key={segmentIndex}><polygon className={segment.sign > 0 ? 'diagram-area-positive' : 'diagram-area-negative'} points={polygon} filter="url(#diagram-soft-shadow)" /><polyline className={segment.sign > 0 ? 'diagram-line-positive' : 'diagram-line-negative'} points={offset.map((item) => `${item.x},${item.y}`).join(' ')} /><text className="diagram-sign" x={strongest.x} y={strongest.y + 4} textAnchor="middle">{segment.sign > 0 ? '+' : '−'}</text></g>
              })}
              <line className="diagram-frame-line" x1={first.x} y1={first.y} x2={last.x} y2={last.y} />
              <text className="diagram-element-name" x={(first.x + last.x) / 2} y={(first.y + last.y) / 2 - 8} textAnchor="middle">E{element.element_id}</text>
            </g>
          )
        })}
        {model.supports.map((support) => {
          const node = model.nodes.find((item) => item.id === support.node_id)
          if (!node) return null
          const base = point(node.x, node.y)
          return (
            <g
              key={support.node_id}
              className="diagram-support"
              transform={`translate(${base.x} ${base.y}) rotate(${-support.angle}) translate(0 9)`}
            >
              <SupportGlyph support={support} />
            </g>
          )
        })}
      </svg>
      <div className="chart-extremes">
        <span><small>MIN</small>{formatEngineering(Math.min(...values), meta.unit)}</span>
        <span><small>MAX</small>{formatEngineering(Math.max(...values), meta.unit)}</span>
        <span className="diagram-scale-note">Diagram scale is normalized for visibility</span>
      </div>
    </div>
  )
}

export function ResultsPanel({
  model,
  result,
  activeTab,
  isRunning,
  isExpanded,
  error,
  onTabChange,
  onToggleExpanded,
  onRun,
}: ResultsPanelProps) {
  return (
    <section className="results-panel" aria-label="分析結果">
      <div className="results-nav">
        <div className="results-title"><Table2 size={18} /><span>Results</span></div>
        <div className="result-tabs" role="tablist">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} className={activeTab === tab.id ? 'is-active' : ''} onClick={() => onTabChange(tab.id)}>
              <b>{tab.symbol}</b><span>{tab.label}</span>
            </button>
          ))}
        </div>
        {result && (
          <span className={`validation-chip ${result.validation.passed ? '' : 'validation-chip--warning'}`}>
            {result.validation.passed ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />}
            {result.validation.passed ? 'Checks passed' : 'Check model'}
          </span>
        )}
        <button
          className="collapse-results"
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? '缩小结果区域' : '放大结果区域'}
          title={isExpanded ? 'Compact results' : 'Expand results'}
        >
          <span>{isExpanded ? 'Compact' : 'Expand'}</span>
          {isExpanded ? <ChevronsDown size={19} /> : <ChevronsUp size={19} />}
        </button>
      </div>

      <div className="results-content">
        {!result && !error && (
          <div className="results-empty">
            <div className="results-empty-icon"><Activity size={22} /></div>
            <div><strong>{isRunning ? 'Solving the global system…' : 'Model ready for analysis'}</strong><span>{isRunning ? 'Assembling stiffness, loads and boundary conditions.' : 'Run the solver to inspect displacement, reaction and N / V / M fields.'}</span></div>
            {!isRunning && <button type="button" onClick={onRun}><Play size={16} fill="currentColor" /> Run now</button>}
            {isRunning && <span className="analysis-progress"><i /></span>}
          </div>
        )}

        {error && (
          <div className="results-error">
            <CircleAlert size={22} />
            <div><strong>Analysis could not be completed</strong><span>{error}</span></div>
            <button type="button" onClick={onRun}>Try again</button>
          </div>
        )}

        {result && activeTab === 'displacement' && (
          <div className="result-table-wrap">
            <table><thead><tr><th>Node</th><th>u <small>m</small></th><th>v <small>m</small></th><th>φ <small>rad</small></th><th>Resultant <small>m</small></th></tr></thead>
              <tbody>{result.nodal_displacements.map((row) => <tr key={row.node_id}><td><span className="table-entity">N{row.node_id}</span></td><td>{formatNumber(row.u, 5)}</td><td>{formatNumber(row.v, 5)}</td><td>{formatNumber(row.phi, 5)}</td><td>{formatNumber(Math.hypot(row.u, row.v), 5)}</td></tr>)}</tbody>
            </table>
          </div>
        )}

        {result && activeTab === 'reaction' && (
          <div className="result-table-wrap">
            <table><thead><tr><th>Node</th><th>Fx <small>N</small></th><th>Fy <small>N</small></th><th>Mz <small>N·m</small></th></tr></thead>
              <tbody>{result.nodal_reactions.map((row) => <tr key={row.node_id}><td><span className="table-entity">N{row.node_id}</span></td><td>{formatNumber(row.fx)}</td><td>{formatNumber(row.fy)}</td><td>{formatNumber(row.mz)}</td></tr>)}</tbody>
            </table>
          </div>
        )}

        {result && (activeTab === 'N' || activeTab === 'V' || activeTab === 'M') && (
          <div className={`field-results ${isExpanded ? 'field-results--expanded' : 'field-results--compact'}`}>
            {isExpanded && <ResultChart result={result} tab={activeTab} model={model} />}
            <div className="field-summary">
              {(() => {
                const meta = fieldMeta[activeTab]
                const values = result.elements.flatMap((element) => element.fields[fieldKey[activeTab]])
                const scale = displayScale(values, meta.unit)
                return (
                  <>
                    <div className="field-summary-heading">
                      <div><span>ELEMENT ENVELOPE</span><strong>{meta.symbol} result values</strong></div>
                      <span className="summary-unit">Values in {scale.unit}</span>
                    </div>
                    <table><thead><tr><th>Element</th><th>i-end</th><th>j-end</th><th>Min</th><th>Max</th></tr></thead>
                      <tbody>{result.elements.map((element) => {
                        const field = element.fields[fieldKey[activeTab]]
                        return <tr key={element.element_id}><td><span className="table-entity">E{element.element_id}</span></td><td>{formatNumber(field[0] / scale.divisor)}</td><td>{formatNumber(field[field.length - 1] / scale.divisor)}</td><td>{formatNumber(Math.min(...field) / scale.divisor)}</td><td>{formatNumber(Math.max(...field) / scale.divisor)}</td></tr>
                      })}</tbody>
                    </table>
                  </>
                )
              })()}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
