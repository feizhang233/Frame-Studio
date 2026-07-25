import AddIcon from '@mui/icons-material/Add'
import FitScreenIcon from '@mui/icons-material/FitScreen'
import GridOnIcon from '@mui/icons-material/GridOn'
import NearMeIcon from '@mui/icons-material/NearMe'
import RemoveIcon from '@mui/icons-material/Remove'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import {
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent,
} from 'react'
import type { SolveResponse } from '../api/contracts'
import {
  DEFAULT_ELEMENT_PROPERTIES,
  type ElementDefaults,
  type FrameModel,
  type NodalLoadDefaults,
  type Selection,
  type SupportDefaults,
  type ToolMode,
} from '../domain/frame'
import type { ModelAction } from '../state/modelReducer'
import { formatNumber } from '../utils/format'
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
  dispatch: Dispatch<ModelAction>
  onSelectionChange: (selection: Selection) => void
  onMessage: (message: string) => void
}

const snap = (value: number, step = 0.25) => Math.round(value / step) * step
const nextId = (items: Array<{ id: number }>) => Math.max(0, ...items.map((item) => item.id)) + 1

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
  dispatch,
  onSelectionChange,
  onMessage,
}: ModelCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [view, setView] = useState<ViewTransform>(() => fittedView(model))
  const [drag, setDrag] = useState<DragState>(null)
  const [elementStart, setElementStart] = useState<number | null>(null)
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
    if (tool === 'node' && event.button === 0) {
      const world = worldPoint(event.clientX, event.clientY)
      const node = { id: nextId(model.nodes), x: snap(world.x), y: snap(world.y) }
      dispatch({ type: 'addNode', node })
      onSelectionChange({ type: 'node', id: node.id })
      onMessage(`已新增節點 N${node.id}`)
      return
    }
    if (tool === 'select' || event.button === 1 || event.button === 2) {
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
    if (tool === 'element') {
      if (elementStart === null) {
        setElementStart(nodeId)
        onMessage(`選擇構件終點（起點 N${nodeId}）`)
      } else if (elementStart !== nodeId) {
        const element = {
          id: nextId(model.elements),
          node_i: elementStart,
          node_j: nodeId,
          ...DEFAULT_ELEMENT_PROPERTIES,
          material_id: elementDefaults.materialId,
          section_id: elementDefaults.sectionId,
          E: model.materials.find((item) => item.id === elementDefaults.materialId)?.E ?? null,
          A: model.sections.find((item) => item.id === elementDefaults.sectionId)?.A ?? null,
          I: model.sections.find((item) => item.id === elementDefaults.sectionId)?.I ?? null,
        }
        dispatch({ type: 'addElement', element })
        onSelectionChange({ type: 'element', id: element.id })
        setElementStart(null)
        onMessage(`已新增構件 E${element.id}`)
      }
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

  const toolHint =
    tool === 'node'
      ? 'Click canvas to place a node'
      : tool === 'element'
        ? elementStart
          ? `Select end node · start N${elementStart}`
          : 'Select two nodes to create an element'
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
          <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 200 }}>
            {model.name}
          </Typography>
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
              return (
                <g key={element.id}>
                  <line role="button" aria-label={`Element E${element.id}`} className="element-hitarea" x1={start.x} y1={start.y} x2={end.x} y2={end.y} onPointerDown={(event) => onElementPointerDown(event, element.id)} />
                  <line className={`frame-element ${selected ? 'is-selected' : ''}`} x1={start.x} y1={start.y} x2={end.x} y2={end.y} pointerEvents="none" />
                  <text className="element-label" x={midpoint.x + 8} y={midpoint.y - 10}>E{element.id}</text>
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
              const meanQ = (load.qy_i + load.qy_j) / 2
              const sign = meanQ >= 0 ? 1 : -1
              const selected = selection?.type === 'distributedLoad' && selection.id === load.element_id
              // Draw arrows at both ends to close the distributed-load boundary.
              const arrows = [0, 0.2, 0.4, 0.6, 0.8, 1]
              const offset = 34
              return (
                <g
                  key={load.element_id}
                  role="button"
                  aria-label={`Distributed load on E${load.element_id}`}
                  className={`distributed-load ${selected ? 'is-selected' : ''}`}
                  onPointerDown={(event) => {
                    event.stopPropagation()
                    onSelectionChange({ type: 'distributedLoad', id: load.element_id })
                  }}
                >
                  <line x1={start.x - sign * normal.x * offset} y1={start.y - sign * normal.y * offset} x2={end.x - sign * normal.x * offset} y2={end.y - sign * normal.y * offset} />
                  {arrows.map((ratio) => {
                    const x = start.x + dx * ratio
                    const y = start.y + dy * ratio
                    return <line key={ratio} x1={x - sign * normal.x * offset} y1={y - sign * normal.y * offset} x2={x} y2={y} markerEnd="url(#load-arrow)" />
                  })}
                  <text x={(start.x + end.x) / 2 - sign * normal.x * 48} y={(start.y + end.y) / 2 - sign * normal.y * 48}>{formatNumber(meanQ / 1000)} kN/m</text>
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

          <g className="nodes-layer">
            {model.nodes.map((node) => {
              const point = screenPoint(node.x, node.y)
              const selected = selection?.type === 'node' && selection.id === node.id
              const isStart = elementStart === node.id
              return (
                <g key={node.id}>
                  {(selected || isStart) && <circle className="node-halo" cx={point.x} cy={point.y} r="15" />}
                  <circle
                    role="button"
                    aria-label={`Node N${node.id}`}
                    className={`frame-node ${selected || isStart ? 'is-selected' : ''}`}
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
            <strong>Start with a node</strong>
            <span>Choose Node, then click anywhere on the grid. Press ? for the guide.</span>
          </div>
        )}

        <div className="canvas-hint"><GridOnIcon sx={{ fontSize: 16 }} /> {toolHint}</div>
        <div className="cursor-position">X {formatNumber(cursor.x, 2)} m&nbsp;&nbsp; Y {formatNumber(cursor.y, 2)} m</div>
      </div>
    </section>
  )
}
