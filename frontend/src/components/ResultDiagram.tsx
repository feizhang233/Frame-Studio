import { useEffect, useState } from 'react'
import type { SolveResponse } from '../api/contracts'
import type { FrameModel } from '../domain/frame'
import { formatEngineering, formatNumber } from '../utils/format'
import { SupportGlyph } from './SupportGlyph'
import { displayScale, fieldKey, fieldMeta, type FieldResultTab } from './resultFields'

interface DiagramPoint {
  x: number
  y: number
  value: number
}

interface DiagramHoverValue extends DiagramPoint {
  baseX: number
  baseY: number
  elementId: number
  length: number
  xLocal: number
}

function criticalPointIndexes(values: number[]) {
  if (values.length === 0) return []
  const indexes = new Set([0, values.length - 1])
  if (values.length < 3) return [...indexes]

  const maximum = Math.max(...values)
  const minimum = Math.min(...values)
  const tolerance = Math.max(1, Math.abs(maximum), Math.abs(minimum)) * 1e-9
  if (maximum - minimum <= tolerance) return [...indexes]

  values.forEach((value, index) => {
    if (index === 0 || index === values.length - 1) return
    const incoming = value - values[index - 1]
    const outgoing = values[index + 1] - value
    const isPeak = incoming > tolerance && outgoing < -tolerance
    const isValley = incoming < -tolerance && outgoing > tolerance
    if (isPeak || isValley) indexes.add(index)
  })

  indexes.add(values.indexOf(maximum))
  indexes.add(values.indexOf(minimum))
  return [...indexes].sort((left, right) => left - right)
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

interface ResultDiagramProps {
  result: SolveResponse
  tab: FieldResultTab
  model: FrameModel
}

export function ResultDiagram({ result, tab, model }: ResultDiagramProps) {
  const [hovered, setHovered] = useState<DiagramHoverValue | null>(null)
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

  useEffect(() => setHovered(null), [result, tab])

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const svg = event.currentTarget
    const transform = svg.getScreenCTM()
    if (!transform) return
    const svgPoint = svg.createSVGPoint()
    svgPoint.x = event.clientX
    svgPoint.y = event.clientY
    const cursor = svgPoint.matrixTransform(transform.inverse())
    let closest: (DiagramHoverValue & { distance: number }) | null = null

    for (const element of result.elements) {
      const xGlobal = element.fields.x_global
      const yGlobal = element.fields.y_global
      if (xGlobal.length < 2 || yGlobal.length < 2) continue
      const first = point(xGlobal[0], yGlobal[0])
      const last = point(xGlobal[xGlobal.length - 1], yGlobal[yGlobal.length - 1])
      const dx = last.x - first.x
      const dy = last.y - first.y
      const squaredLength = dx * dx + dy * dy
      if (squaredLength === 0) continue
      const ratio = Math.max(0, Math.min(1, ((cursor.x - first.x) * dx + (cursor.y - first.y) * dy) / squaredLength))
      const baseX = first.x + dx * ratio
      const baseY = first.y + dy * ratio
      const distance = Math.hypot(cursor.x - baseX, cursor.y - baseY)
      if (closest && distance >= closest.distance) continue

      const stations = element.fields.x_local
      const field = element.fields[fieldKey[tab]]
      const length = stations[stations.length - 1] ?? element.length
      const xLocal = length * ratio
      let upperIndex = stations.findIndex((station) => station >= xLocal)
      if (upperIndex < 0) upperIndex = stations.length - 1
      const lowerIndex = Math.max(0, upperIndex - 1)
      const lowerStation = stations[lowerIndex]
      const upperStation = stations[upperIndex]
      const interval = upperStation - lowerStation
      const intervalRatio = interval === 0 ? 0 : (xLocal - lowerStation) / interval
      const value = field[lowerIndex] + (field[upperIndex] - field[lowerIndex]) * intervalRatio
      const normal = { x: -dy / Math.sqrt(squaredLength), y: dx / Math.sqrt(squaredLength) }
      closest = {
        x: baseX + normal.x * (value / maxAbs) * diagramOffset,
        y: baseY + normal.y * (value / maxAbs) * diagramOffset,
        baseX,
        baseY,
        distance,
        elementId: element.element_id,
        length,
        value,
        xLocal,
      }
    }

    setHovered(closest && closest.distance <= diagramOffset + 22 ? closest : null)
  }

  const hoverValueText = hovered ? `${meta.symbol} = ${formatNumber(hovered.value / scale.divisor)} ${scale.unit}` : ''
  const hoverStationText = hovered ? `E${hovered.elementId}  ·  x = ${formatNumber(hovered.xLocal)} m  ·  ${formatNumber((hovered.xLocal / hovered.length) * 100, 1)}%` : ''
  const hoverCardWidth = Math.max(146, hoverValueText.length * 6.3 + 20, hoverStationText.length * 5.2 + 20)
  const hoverCardX = hovered
    ? (hovered.x + 14 + hoverCardWidth > chart.width - 8 ? hovered.x - hoverCardWidth - 14 : hovered.x + 14)
    : 0
  const hoverCardY = hovered ? (hovered.y - 52 < 8 ? hovered.y + 14 : hovered.y - 52) : 0

  return (
    <div className="result-chart-wrap">
      <div className="chart-heading">
        <div>
          <span>STRUCTURAL DIAGRAM</span>
          <strong>{meta.title} <i>{meta.symbol}</i></strong>
        </div>
        <div className="diagram-legend"><span><i className="positive" /> Positive</span><span><i className="negative" /> Negative</span><b>{scale.unit}</b></div>
      </div>
      <svg
        className="result-chart"
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        preserveAspectRatio="xMidYMid meet"
        aria-label={`${meta.title} diagram. Move the pointer over an element to inspect values.`}
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHovered(null)}
      >
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
          const criticalIndexes = criticalPointIndexes(field)
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
              {criticalIndexes.map((index) => {
                const diagramPoint = {
                  x: basePoints[index].x + normal.x * (field[index] / maxAbs) * diagramOffset,
                  y: basePoints[index].y + normal.y * (field[index] / maxAbs) * diagramOffset,
                }
                const nearbyValue = field[index] === 0
                  ? (field[Math.min(field.length - 1, index + 1)] || field[Math.max(0, index - 1)] || 1)
                  : field[index]
                const direction = nearbyValue >= 0 ? 1 : -1
                const label = formatNumber(field[index] / scale.divisor)
                const labelWidth = Math.max(34, label.length * 6.2 + 12)
                const labelX = Math.max(labelWidth / 2 + 4, Math.min(chart.width - labelWidth / 2 - 4, diagramPoint.x + normal.x * direction * 15))
                const labelY = Math.max(11, Math.min(chart.height - 11, diagramPoint.y + normal.y * direction * 15))
                return (
                  <g key={index} className="diagram-key-value" pointerEvents="none">
                    <line x1={diagramPoint.x} y1={diagramPoint.y} x2={labelX} y2={labelY} />
                    <circle cx={diagramPoint.x} cy={diagramPoint.y} r="3" />
                    <rect x={labelX - labelWidth / 2} y={labelY - 9} width={labelWidth} height="18" rx="5" />
                    <text x={labelX} y={labelY + 3.5} textAnchor="middle">{label}</text>
                  </g>
                )
              })}
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
        {hovered && (
          <g className="diagram-hover" pointerEvents="none">
            <line className="diagram-hover-ordinate" x1={hovered.baseX} y1={hovered.baseY} x2={hovered.x} y2={hovered.y} />
            <circle className="diagram-hover-base" cx={hovered.baseX} cy={hovered.baseY} r="3.5" />
            <circle className="diagram-hover-point" cx={hovered.x} cy={hovered.y} r="5" />
            <g transform={`translate(${hoverCardX} ${hoverCardY})`}>
              <rect className="diagram-hover-card" width={hoverCardWidth} height="42" rx="7" />
              <text className="diagram-hover-value" x="10" y="16">{hoverValueText}</text>
              <text className="diagram-hover-station" x="10" y="32">{hoverStationText}</text>
            </g>
          </g>
        )}
      </svg>
      <div className="chart-extremes">
        <span><small>MIN</small>{formatEngineering(Math.min(...values), meta.unit)}</span>
        <span><small>MAX</small>{formatEngineering(Math.max(...values), meta.unit)}</span>
        <span className="diagram-scale-note">Diagram scale is normalized for visibility</span>
      </div>
    </div>
  )
}
