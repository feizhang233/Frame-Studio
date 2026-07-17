import {
  ArrowDownToLine,
  CircleDot,
  History,
  Library,
  MousePointer2,
  PanelTop,
  Triangle,
  Waypoints,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { ToolMode } from '../domain/frame'

interface ToolRailProps {
  activeTool: ToolMode
  onToolChange: (tool: ToolMode) => void
}

interface ToolDefinition {
  id: ToolMode
  label: string
  shortcut: string
  icon: ComponentType<{ size?: number; strokeWidth?: number }>
}

const tools: ToolDefinition[] = [
  { id: 'select', label: 'Select', shortcut: 'V', icon: MousePointer2 },
  { id: 'node', label: 'Node', shortcut: 'N', icon: CircleDot },
  { id: 'material', label: 'Material', shortcut: 'M', icon: Library },
  { id: 'section', label: 'Section', shortcut: 'C', icon: PanelTop },
  { id: 'element', label: 'Element', shortcut: 'E', icon: Waypoints },
  { id: 'support', label: 'Support', shortcut: 'S', icon: Triangle },
  { id: 'load', label: 'Load', shortcut: 'L', icon: ArrowDownToLine },
]

const modelTool: ToolDefinition = {
  id: 'models',
  label: 'Models',
  shortcut: 'H',
  icon: History,
}

export function ToolRail({ activeTool, onToolChange }: ToolRailProps) {
  const ModelIcon = modelTool.icon
  return (
    <nav className="tool-rail" aria-label="建模工具">
      <div className="tool-rail-label">MODEL</div>
      <div className="tool-list">
        {tools.map((tool) => {
          const Icon = tool.icon
          return (
            <button
              key={tool.id}
              className={`tool-button ${activeTool === tool.id ? 'tool-button--active' : ''}`}
              type="button"
              onClick={() => onToolChange(tool.id)}
              aria-pressed={activeTool === tool.id}
              title={`${tool.label} (${tool.shortcut})`}
            >
              <span className="tool-icon"><Icon size={24} strokeWidth={1.85} /></span>
              <span className="tool-name">{tool.label}</span>
            </button>
          )
        })}
      </div>
      <button
        className={`tool-button tool-button--models ${activeTool === 'models' ? 'tool-button--active' : ''}`}
        type="button"
        onClick={() => onToolChange('models')}
        aria-pressed={activeTool === 'models'}
        title="Models (H)"
      >
        <span className="tool-icon"><ModelIcon size={24} strokeWidth={1.85} /></span>
        <span className="tool-name">Models</span>
      </button>
    </nav>
  )
}
