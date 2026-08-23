import AddIcon from '@mui/icons-material/Add'
import FitScreenIcon from '@mui/icons-material/FitScreen'
import GridOnIcon from '@mui/icons-material/GridOn'
import NearMeIcon from '@mui/icons-material/NearMe'
import RemoveIcon from '@mui/icons-material/Remove'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent,
} from 'react'
import type { SolveResponse } from '../api/contracts'
import {
  buildFrameElement,
  hasElementBetween,
  nextNumericId,
  type ElementDefaults,
  type FrameModel,
  type FrameNode,
  type NodalLoadDefaults,
  type Selection,
  type SupportDefaults,
  type ToolMode,
} from '../domain/frame'
import type { ModelAction } from '../state/modelReducer'
import { formatNumber } from '../utils/format'
import type { AssignmentOverlayKind } from './LibraryPanels'
import { SupportGlyph } from './SupportGlyph'

const CANVAS_WIDTH = 1100
const CANVAS_HEIGHT = 660
const MIN_ZOOM = 34
const MAX_ZOOM = 230
const DEFAULT_VIEW: ViewTransform = { x: 250, y: 530, scale: 92 }

interface ViewTransform {
  x: number
  y: number
  scale: number
}

type DragState =
  | { mode: 'pan'; pointerX: number; pointerY: number; originX: number; originY: number }
  | { mode: 'node'; nodeId: number }
  | null

interface ModelCanvasProps {
  model: FrameModel
  tool: ToolMode
  selection: Selection
  result: SolveResponse | null
  activeResult: string
  elementDefaults: ElementDefaults
  supportDefaults: SupportDefaults
  nodalLoadDefaults: NodalLoadDefaults
  assignmentOverlay: AssignmentOverlayKind | null
  dispatch: Dispatch<ModelAction>
  onSelectionChange: (selection: Selection) => void
  onRename: (name: string) => void
  onMessage: (message: string) => void
  onCloseAssignmentOverlay: () => void
}

const snap = (value: number, step = 0.25) => Math.round(value / step) * step
const NODE_PICK_RADIUS_PX = 20

function fittedView(model: FrameModel): ViewTransform {
  if (model.nodes.length === 0) return DEFAULT_VIEW
  const xs = model.nodes.map((node) => node.x)
  const ys = model.nodes.map((node) => node.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const spanX = Math.max(maxX - minX, 2)
  const spanY = Math.max(maxY - minY, 2)
  const scale = Math.min(150, (CANVAS_WIDTH - 260) / spanX, (CANVAS_HEIGHT - 180) / spanY)
  return {
    x: CANVAS_WIDTH / 2 - ((minX + maxX) / 2) * scale,
    y: CANVAS_HEIGHT / 2 + ((minY + maxY) / 2) * scale,
    scale,
  }
}

export function ModelCanvas({
  model,
  tool,
  selection,
  result,
  activeResult,
  elementDefaults,
  supportDefaults,
  nodalLoadDefaults,
  assignmentOverlay,
  dispatch,
  onSelectionChange,
  onRename,
  onMessage,
  onCloseAssignmentOverlay,
}: ModelCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [view, setView] = useState<ViewTransform>(() => fittedView(model))
  const [drag, setDrag] = useState<DragState>(null)
  const [elementStart, setElementStart] = useState<number | null>(null)
  const [hoverNodeId, setHoverNodeId] = useState<number | null>(null)
  const [cursor, setCursor] = useState({ x: 0, y: 0 })

  const nodeById = useMemo(
    () => new Map(model.nodes.map((node) => [node.id, node])),
    [model.nodes],
  )

  const screenPoint = (x: number, y: number) => ({
    x: view.x + x * view.scale,
    y: view.y - y * view.scale,
  })

  const svgPoint = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: ((clientX - rect.left) / rect.width) * CANVAS_WIDTH,
      y: ((clientY - rect.top) / rect.height) * CANVAS_HEIGHT,
    }
  }

  const worldPoint = (clientX: number, clientY: number) => {
    const point = svgPoint(clientX, clientY)
    return {
      x: (point.x - view.x) / view.scale,
      y: (view.y - point.y) / view.scale,
    }
  }

  const pickNodeAtClient = (clientX: number, clientY: number): FrameNode | null => {
    const point = svgPoint(clientX, clientY)
    let best: FrameNode | null = null
    let bestDist = NODE_PICK_RADIUS_PX
    for (const node of model.nodes) {
      const screen = screenPoint(node.x, node.y)
      const distance = Math.hypot(screen.x - point.x, screen.y - point.y)
      if (distance < bestDist) {
        best = node
        bestDist = distance
      }
    }
    return best
  }

  const pickOrCreateNode = (clientX: number, clientY: number): number => {
    const nearby = pickNodeAtClient(clientX, clientY)
    if (nearby) return nearby.id
    const world = worldPoint(clientX, clientY)
    const x = snap(world.x)
    const y = snap(world.y)
    const coincident = model.nodes.find((node) => node.x === x && node.y === y)
    if (coincident) return coincident.id
    const node = { id: nextNumericId(model.nodes), x, y }
    dispatch({ type: 'addNode', node })
    return node.id
  }

  const commitElementNode = (nodeId: number) => {
    if (elementStart === null) {
      setElementStart(nodeId)
      onMessage(`起點 N${nodeId} · 再點擊另一個節點完成線段`)
      return
    }
    if (elementStart === nodeId) {
      setElementStart(null)
      onMessage('已取消線段起點')
      return
    }
    if (hasElementBetween(model.elements, elementStart, nodeId)) {
      onMessage(`N${elementStart} 與 N${nodeId} 之間已有構件`)
      return
    }
    const element = buildFrameElement(model, elementStart, nodeId, elementDefaults)
    dispatch({ type: 'addElement', element })
    setElementStart(nodeId)
    onMessage(`已新增構件 E${element.id}（N${elementStart}–N${nodeId}）· 繼續點擊可連接下一節點`)
  }

  useEffect(() => {
    if (tool !== 'element') setElementStart(null)
  }, [tool])

  useEffect(() => {
    if (tool !== 'element') return
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return
      if (event.key !== 'Escape') return
      setElementStart(null)
      onMessage('已取消線段繪製')
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onMessage, tool])

  const fitModel = () => {
    setView(fittedView(model))
  }

  const zoom = (factor: number) => {
    const center = { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2 }
    setView((current) => {
      const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.scale * factor))
      const worldX = (center.x - current.x) / current.scale
      const worldY = (current.y - center.y) / current.scale
      return { x: center.x - worldX * scale, y: center.y + worldY * scale, scale }
    })
  }

  const onWheel = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault()
    const point = svgPoint(event.clientX, event.clientY)
    setView((current) => {
      const factor = event.deltaY > 0 ? 0.9 : 1.1
      const scale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.scale * factor))
      const worldX = (point.x - current.x) / current.scale
      const worldY = (current.y - point.y) / current.scale
      return { x: point.x - worldX * scale, y: point.y + worldY * scale, scale }
    })
  }

  const onCanvasPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    const point = svgPoint(event.clientX, event.clientY)
    if (tool === 'element' && event.button === 2) {
      setElementStart(null)
      onMessage('已取消線段起點')
      return
    }
    if (tool === 'element' && event.button === 0) {
      commitElementNode(pickOrCreateNode(event.clientX, event.clientY))
      return
    }
    if (tool === 'node' && event.button === 0) {
      const world = worldPoint(event.clientX, event.clientY)
      const node = { id: nextNumericId(model.nodes), x: snap(world.x), y: snap(world.y) }
      dispatch({ type: 'addNode', node })
      onSelectionChange({ type: 'node', id: node.id })
      onMessage(`已新增節點 N${node.id}`)
      return
    }
    if (tool === 'select' || tool === 'insert-node' || event.button === 1 || event.button === 2) {
      svgRef.current?.setPointerCapture(event.pointerId)
      setDrag({
        mode: 'pan',
        pointerX: point.x,
        pointerY: point.y,
        originX: view.x,
        originY: view.y,
      })
      onSelectionChange(null)
    }
  }

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const world = worldPoint(event.clientX, event.clientY)
    setCursor({ x: world.x, y: world.y })
    setHoverNodeId(tool === 'element' ? pickNodeAtClient(event.clientX, event.clientY)?.id ?? null : null)
    if (!drag) return
    if (drag.mode === 'pan') {
      const point = svgPoint(event.clientX, event.clientY)
      setView((current) => ({
        ...current,
        x: drag.originX + point.x - drag.pointerX,
        y: drag.originY + point.y - drag.pointerY,
      }))
      return
    }
    dispatch({
      type: 'updateNode',
      id: drag.nodeId,
      patch: { x: snap(world.x, 0.05), y: snap(world.y, 0.05) },
    })
  }

  const endDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (svgRef.current?.hasPointerCapture(event.pointerId)) {
      svgRef.current.releasePointerCapture(event.pointerId)
    }
    setDrag(null)
  }

  const onNodePointerDown = (event: ReactPointerEvent<SVGCircleElement>, nodeId: number) => {
    event.stopPropagation()
    if (tool === 'insert-node') {
      onMessage('Choose a frame element to insert a node')
      return
    }
    if (tool === 'element') {
      commitElementNode(nodeId)
      return
    }
    if (tool === 'support') {
      dispatch({
        type: 'upsertSupport',
        support: { node_id: nodeId, ...supportDefaults, u_value: 0, v_value: 0, phi_value: 0 },
      })
      onSelectionChange({ type: 'support', id: nodeId })
      onMessage(`已在 N${nodeId} 設定支座`)
      return
    }
    if (tool === 'load') {
      dispatch({
        type: 'upsertNodalLoad',
        load: { node_id: nodeId, ...nodalLoadDefaults },
      })
      onSelectionChange({ type: 'nodalLoad', id: nodeId })
      onMessage(`已在 N${nodeId} 加入${nodalLoadDefaults.mz !== 0 ? '節點力矩' : '節點荷載'}`)
      return
    }
    onSelectionChange({ type: 'node', id: nodeId })
    if (tool !== 'select') return
    svgRef.current?.setPointerCapture(event.pointerId)
    setDrag({ mode: 'node', nodeId })
  }

  const onElementPointerDown = (
    event: ReactPointerEvent<SVGLineElement>,
    elementId: number,
  ) => {
    event.stopPropagation()
    if (tool === 'element') {
      const nearby = pickNodeAtClient(event.clientX, event.clientY)
      if (nearby) commitElementNode(nearby.id)
      return
    }
    if (tool === 'load') {
      dispatch({
        type: 'upsertDistributedLoad',
        load: { element_id: elementId, qx_i: 0, qy_i: -1000, qx_j: 0, qy_j: -1000 },
      })
      onSelectionChange({ type: 'distributedLoad', id: elementId })
      onMessage(`已在 E${elementId} 加入分布荷載`)
      return
    }
    onSelectionChange({ type: 'element', id: elementId })
    if (tool === 'insert-node') {
      onMessage(`E${elementId} selected · set the split position in Properties`)
    }
  }

  const displacedPaths = useMemo(() => {
    if (!result || activeResult !== 'displacement') return []
    const allDeltas = result.elements.flatMap((element) =>
      element.fields.x_global.map((x, index) =>
        Math.hypot(element.fields.x_deformed[index] - x, element.fields.y_deformed[index] - element.fields.y_global[index]),
      ),
    )
    const maxDelta = Math.max(0, ...allDeltas)
    const magnification = maxDelta > 0 ? Math.min(5000, 0.55 / maxDelta) : 1
    return result.elements.map((element) => {
      const points = element.fields.x_global.map((x, index) => {
        const dx = element.fields.x_deformed[index] - x
        const dy = element.fields.y_deformed[index] - element.fields.y_global[index]
        return screenPoint(x + dx * magnification, element.fields.y_global[index] + dy * magnification)
      })
      return {
        id: element.element_id,
        d: points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' '),
      }
    })
  }, [activeResult, result, view])

  const toolHint = assignmentOverlay
    ? `Showing ${assignmentOverlay} assignments · click elsewhere to close`
    : tool === 'node'
      ? 'Click canvas or enter coordinates to place a node'
      : tool === 'insert-node'
        ? 'Select an element to insert a node and split it'
      : tool === 'element'
        ? elementStart
          ? `Click end node to finish E · start N${elementStart} · Esc cancels`
          : 'Click two nodes to draw a member · empty clicks place nodes'
        : tool === 'support'
          ? 'Click a node to add a support'
          : tool === 'load'
            ? 'Click a node or element to add a load'
            : tool === 'material'
              ? 'Manage materials and apply them from the Properties panel'
              : tool === 'section'
                ? 'Manage sections and assign them to frame elements'
                : tool === 'models'
                  ? 'Open a saved model from model history'
                  : 'Drag nodes to edit · drag canvas to pan'

  const assignmentLegend = useMemo(() => {
    if (!assignmentOverlay) return []
    if (assignmentOverlay === 'material') {
      return model.materials.map((item) => ({ id: item.id, name: item.name, color: item.color }))
    }
    return model.sections.map((item) => ({ id: item.id, name: item.name, color: item.color }))
  }, [assignmentOverlay, model.materials, model.sections])

  const resolveAssignment = (elementId: number) => {
    const element = model.elements.find((item) => item.id === elementId)
    if (!element || !assignmentOverlay) return null
    if (assignmentOverlay === 'material') {
      const material = model.materials.find((item) => item.id === element.material_id)
      return material
        ? { name: material.name, color: material.color, assigned: true as const }
        : { name: 'Unassigned', color: '#9aa5b5', assigned: false as const }
    }
    const section = model.sections.find((item) => item.id === element.section_id)
    return section
      ? { name: section.name, color: section.color, assigned: true as const }
      : { name: 'Unassigned', color: '#9aa5b5', assigned: false as const }
  }

  return (
    <section className="canvas-panel" aria-label="Structural model canvas" style={{ height: '100%', display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)' }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={1}
        sx={{ px: 1.5, py: 0.75, borderBottom: 1, borderColor: 'divider', minHeight: 52, bgcolor: 'background.paper' }}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: { xs: 'none', sm: 'inline' } }}>
            MODEL SPACE
          </Typography>
          <InputBase
            value={model.name}
            onChange={(event) => onRename(event.target.value)}
            onFocus={(event) => event.currentTarget.select()}
            inputProps={{ 'aria-label': 'Model name' }}
            sx={{
              width: 'clamp(120px, 18vw, 240px)',
              px: 0.75,
              py: 0.25,
              borderRadius: 1,
              typography: 'body2',
              fontWeight: 600,
              '&:hover': { bgcolor: 'grey.100' },
              '&.Mui-focused': {
                bgcolor: 'background.paper',
                boxShadow: (theme) => `inset 0 0 0 1px ${theme.palette.primary.main}`,
              },
            }}
          />
          <Chip size="small" label={`${model.nodes.length} nodes`} variant="outlined" />
          <Chip size="small" label={`${model.elements.length} elements`} variant="outlined" sx={{ display: { xs: 'none', md: 'inline-flex' } }} />
        </Stack>
        <Paper variant="outlined" sx={{ display: 'flex', alignItems: 'center', px: 0.5 }} aria-label="Canvas view controls">
          <IconButton size="small" onClick={() => zoom(0.85)} aria-label="Zoom out"><RemoveIcon fontSize="small" /></IconButton>
          <Typography variant="caption" sx={{ minWidth: 40, textAlign: 'center', fontWeight: 600 }}>
            {Math.round((view.scale / 92) * 100)}%
          </Typography>
          <IconButton size="small" onClick={() => zoom(1.18)} aria-label="Zoom in"><AddIcon fontSize="small" /></IconButton>
          <IconButton size="small" onClick={fitModel} aria-label="Fit to view"><FitScreenIcon fontSize="small" /></IconButton>
        </Paper>
      </Stack>

      <div className={`canvas-stage canvas-stage--${tool}`}>
        <svg
          ref={svgRef}
          className="model-svg"
          viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
          role="img"
          aria-label="2D frame model editor"
          onPointerDown={onCanvasPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onWheel={onWheel}
          onContextMenu={(event) => event.preventDefault()}
        >
          <defs>
            <pattern id="minor-grid" width={view.scale / 4} height={view.scale / 4} patternUnits="userSpaceOnUse" patternTransform={`translate(${view.x % (view.scale / 4)} ${view.y % (view.scale / 4)})`}>
              <path d={`M ${view.scale / 4} 0 L 0 0 0 ${view.scale / 4}`} fill="none" stroke="#dce3ec" strokeWidth="0.7" />
            </pattern>
            <pattern id="major-grid" width={view.scale} height={view.scale} patternUnits="userSpaceOnUse" patternTransform={`translate(${view.x % view.scale} ${view.y % view.scale})`}>
              <rect width={view.scale} height={view.scale} fill="url(#minor-grid)" />
              <path d={`M ${view.scale} 0 L 0 0 0 ${view.scale}`} fill="none" stroke="#c8d2df" strokeWidth="1" />
            </pattern>
            <marker id="load-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M 0 0 L 8 4 L 0 8 z" fill="#d34f61" />
            </marker>
          </defs>
          <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="#f8fafc" />
          <rect width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="url(#major-grid)" opacity="0.72" />

          <g className="global-axes" pointerEvents="none">
            <line x1={view.x - 42} y1={view.y} x2={view.x + 72} y2={view.y} />
            <line x1={view.x} y1={view.y + 42} x2={view.x} y2={view.y - 72} />
            <path d={`M ${view.x + 72} ${view.y} l -9 -5 l 0 10 z`} />
            <path d={`M ${view.x} ${view.y - 72} l -5 9 l 10 0 z`} />
            <text x={view.x + 78} y={view.y + 5}>X</text>
            <text x={view.x - 5} y={view.y - 80}>Y</text>
          </g>

          <g className="elements-layer">
            {model.elements.map((element) => {
              const nodeI = nodeById.get(element.node_i)
              const nodeJ = nodeById.get(element.node_j)
              if (!nodeI || !nodeJ) return null
              const start = screenPoint(nodeI.x, nodeI.y)
              const end = screenPoint(nodeJ.x, nodeJ.y)
              const selected = selection?.type === 'element' && selection.id === element.id
              const midpoint = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }
              const assignment = resolveAssignment(element.id)
              const stroke = assignment ? assignment.color : undefined
              return (
                <g key={element.id}>
                  <line role="button" aria-label={`Element E${element.id}`} className="element-hitarea" x1={start.x} y1={start.y} x2={end.x} y2={end.y} onPointerDown={(event) => onElementPointerDown(event, element.id)} />
                  <line
                    className={`frame-element ${selected ? 'is-selected' : ''} ${assignment && !assignment.assigned ? 'is-unassigned' : ''}`}
                    x1={start.x}
                    y1={start.y}
                    x2={end.x}
                    y2={end.y}
                    style={stroke ? { stroke } : undefined}
                    pointerEvents="none"
                  />
                  {assignment ? (
                    (() => {
                      const label = `E${element.id} · ${assignment.name}`
                      const width = Math.min(190, Math.max(90, label.length * 7.1))
                      return (
                        <g className="assignment-badge" pointerEvents="none">
                          <rect
                            x={midpoint.x - width / 2}
                            y={midpoint.y - 28}
                            width={width}
                            height="22"
                            rx="7"
                            fill={assignment.assigned ? assignment.color : '#8b95a4'}
                            opacity="0.92"
                          />
                          <text className="assignment-badge-text" x={midpoint.x} y={midpoint.y - 13} textAnchor="middle">
                            {label}
                          </text>
                        </g>
                      )
                    })()
                  ) : (
                    <text className="element-label" x={midpoint.x + 8} y={midpoint.y - 10}>E{element.id}</text>
                  )}
                </g>
              )
            })}
          </g>

          {displacedPaths.length > 0 && (
            <g className="deformed-layer" pointerEvents="none">
              {displacedPaths.map((path) => <path key={path.id} d={path.d} />)}
            </g>
          )}

          <g className="distributed-loads-layer">
            {model.distributed_loads.map((load) => {
              const element = model.elements.find((item) => item.id === load.element_id)
              if (!element) return null
              const nodeI = nodeById.get(element.node_i)
              const nodeJ = nodeById.get(element.node_j)
              if (!nodeI || !nodeJ) return null
              const start = screenPoint(nodeI.x, nodeI.y)
              const end = screenPoint(nodeJ.x, nodeJ.y)
              const dx = end.x - start.x
              const dy = end.y - start.y
              const length = Math.hypot(dx, dy) || 1
              const normal = { x: dy / length, y: -dx / length }
              const maxMagnitude = Math.max(Math.abs(load.qy_i), Math.abs(load.qy_j))
              const isUniform = Math.abs(load.qy_i - load.qy_j) <= Math.max(1, maxMagnitude) * 1e-9
              const dominantQ = Math.abs(load.qy_i) >= Math.abs(load.qy_j) ? load.qy_i : load.qy_j
              const labelSign = dominantQ >= 0 ? 1 : -1
              const selected = selection?.type === 'distributedLoad' && selection.id === load.element_id
              const arrows = [0, 0.2, 0.4, 0.6, 0.8, 1]
              const maxOffset = 38
              const sourcePoint = (ratio: number) => {
                const q = load.qy_i + (load.qy_j - load.qy_i) * ratio
                const scale = maxMagnitude > 0 ? q / maxMagnitude : 0
                return {
                  x: start.x + dx * ratio - normal.x * maxOffset * scale,
                  y: start.y + dy * ratio - normal.y * maxOffset * scale,
                  q,
                }
              }
              const sourceI = sourcePoint(0)
              const sourceJ = sourcePoint(1)
              const label = isUniform
                ? `${formatNumber(load.qy_i / 1000)} kN/m`
                : `${formatNumber(load.qy_i / 1000)} → ${formatNumber(load.qy_j / 1000)} kN/m`
              return (
                <g
                  key={load.element_id}
                  role="button"
                  aria-label={`Distributed load on E${load.element_id}: ${label}`}
                  className={`distributed-load ${selected ? 'is-selected' : ''}`}
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    if (tool === 'element') {
                      const nearby = pickNodeAtClient(event.clientX, event.clientY)
                      if (nearby) commitElementNode(nearby.id)
                      return
                    }
                    onSelectionChange({ type: 'distributedLoad', id: load.element_id })
                  }}
                >
                  {maxMagnitude > 0 && (
                    <line x1={sourceI.x} y1={sourceI.y} x2={sourceJ.x} y2={sourceJ.y} />
                  )}
                  {arrows.map((ratio) => {
                    const x = start.x + dx * ratio
                    const y = start.y + dy * ratio
                    const source = sourcePoint(ratio)
                    if (Math.abs(source.q) <= Math.max(1, maxMagnitude) * 1e-12) return null
                    return <line key={ratio} x1={source.x} y1={source.y} x2={x} y2={y} markerEnd="url(#load-arrow)" />
                  })}
                  <text
                    x={(start.x + end.x) / 2 - labelSign * normal.x * 54}
                    y={(start.y + end.y) / 2 - labelSign * normal.y * 54}
                    textAnchor="middle"
                  >
                    {label}
                  </text>
                </g>
              )
            })}
          </g>

          <g className="supports-layer">
            {model.supports.map((support) => {
              const node = nodeById.get(support.node_id)
              if (!node) return null
              const point = screenPoint(node.x, node.y)
              const selected = selection?.type === 'support' && selection.id === support.node_id
              return (
                <g
                  key={support.node_id}
                  role="button"
                  aria-label={`Support at N${support.node_id}`}
                  className={`support-symbol ${selected ? 'is-selected' : ''}`}
                  transform={`translate(${point.x} ${point.y}) rotate(${-support.angle}) translate(0 9)`}
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    if (tool === 'element') {
                      commitElementNode(support.node_id)
                      return
                    }
                    onSelectionChange({ type: 'support', id: support.node_id })
                  }}
                >
                  <SupportGlyph support={support} />
                </g>
              )
            })}
          </g>

          <g className="nodal-loads-layer">
            {model.nodal_loads.map((load) => {
              const node = nodeById.get(load.node_id)
              if (!node) return null
              const point = screenPoint(node.x, node.y)
              const selected = selection?.type === 'nodalLoad' && selection.id === load.node_id
              const fxSign = load.fx >= 0 ? 1 : -1
              const fySign = load.fy >= 0 ? 1 : -1
              return (
                <g
                  key={load.node_id}
                  role="button"
                  aria-label={`Nodal load at N${load.node_id}`}
                  className={`nodal-load ${selected ? 'is-selected' : ''}`}
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    if (tool === 'element') {
                      commitElementNode(load.node_id)
                      return
                    }
                    onSelectionChange({ type: 'nodalLoad', id: load.node_id })
                  }}
                >
                  {load.fx !== 0 && <line x1={point.x - fxSign * 55} y1={point.y} x2={point.x - fxSign * 8} y2={point.y} markerEnd="url(#load-arrow)" />}
                  {load.fy !== 0 && <line x1={point.x} y1={point.y + fySign * 55} x2={point.x} y2={point.y + fySign * 8} markerEnd="url(#load-arrow)" />}
                  {load.mz !== 0 && (
                    <>
                      <path d={`M ${point.x + 27} ${point.y - 8} A 28 28 0 1 ${load.mz > 0 ? 0 : 1} ${point.x - 23} ${point.y - 18}`} markerEnd="url(#load-arrow)" fill="none" />
                      <text x={point.x + 34} y={point.y - 28}>M</text>
                    </>
                  )}
                </g>
              )
            })}
          </g>

          {tool === 'element' && elementStart !== null && (() => {
            const startNode = nodeById.get(elementStart)
            if (!startNode) return null
            const start = screenPoint(startNode.x, startNode.y)
            const hover = hoverNodeId != null && hoverNodeId !== elementStart ? nodeById.get(hoverNodeId) : null
            const end = hover ? screenPoint(hover.x, hover.y) : screenPoint(cursor.x, cursor.y)
            return (
              <line
                className="element-preview"
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
              />
            )
          })()}

          <g className="nodes-layer">
            {model.nodes.map((node) => {
              const point = screenPoint(node.x, node.y)
              const selected = selection?.type === 'node' && selection.id === node.id
              const isStart = elementStart === node.id
              const isHover = tool === 'element' && hoverNodeId === node.id
              return (
                <g key={node.id}>
                  {(selected || isStart || isHover) && <circle className={`node-halo ${isStart ? 'is-connect-start' : ''}`} cx={point.x} cy={point.y} r="16" />}
                  <circle
                    className="node-hitarea"
                    cx={point.x}
                    cy={point.y}
                    r="16"
                    onPointerDown={(event) => onNodePointerDown(event, node.id)}
                  />
                  <circle
                    role="button"
                    aria-label={`Node N${node.id}`}
                    className={`frame-node ${selected || isStart ? 'is-selected' : ''} ${isHover ? 'is-connect-hover' : ''}`}
                    cx={point.x}
                    cy={point.y}
                    r="6.5"
                    onPointerDown={(event) => onNodePointerDown(event, node.id)}
                  />
                  <text className="node-label" x={point.x + 11} y={point.y + 20}>N{node.id}</text>
                </g>
              )
            })}
          </g>
        </svg>

        {model.nodes.length === 0 && (
          <div className="empty-canvas">
            <div className="empty-canvas-icon"><NearMeIcon fontSize="medium" /></div>
            {tool === 'element' ? (
              <>
                <strong>Draw a member</strong>
                <span>Click two points on the grid. Each click places a node; the second click creates the element.</span>
              </>
            ) : (
              <>
                <strong>Start with a node</strong>
                <span>Choose Node, then click anywhere on the grid. Press ? for the guide.</span>
              </>
            )}
          </div>
        )}

        {assignmentOverlay && (
          <div className="assignment-map-panel" role="status" aria-live="polite">
            <div className="assignment-map-header">
              <strong>{assignmentOverlay === 'material' ? 'Material' : 'Section'} assignment map</strong>
              <button type="button" onClick={onCloseAssignmentOverlay} aria-label="Close assignment map">Close</button>
            </div>
            <p>Click anywhere outside Assignment to dismiss.</p>
            <div className="assignment-map-legend">
              {assignmentLegend.map((item) => (
                <span key={item.id}><i style={{ background: item.color }} />{item.name}</span>
              ))}
              <span><i style={{ background: '#9aa5b5' }} />Unassigned</span>
            </div>
          </div>
        )}

        <div className="canvas-hint"><GridOnIcon sx={{ fontSize: 16 }} /> {toolHint}</div>
        <div className="cursor-position">X {formatNumber(cursor.x, 2)} m&nbsp;&nbsp; Y {formatNumber(cursor.y, 2)} m</div>
      </div>
    </section>
  )
}
