import AccountTreeIcon from '@mui/icons-material/AccountTree'
import AddIcon from '@mui/icons-material/Add'
import CategoryIcon from '@mui/icons-material/Category'
import ChangeHistoryIcon from '@mui/icons-material/ChangeHistory'
import CheckIcon from '@mui/icons-material/Check'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import HistoryIcon from '@mui/icons-material/History'
import LibraryBooksIcon from '@mui/icons-material/LibraryBooks'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import ScheduleIcon from '@mui/icons-material/Schedule'
import SouthIcon from '@mui/icons-material/South'
import UndoIcon from '@mui/icons-material/Undo'
import { useEffect, useState, type Dispatch, type DragEvent, type ReactNode } from 'react'
import type { ExampleModelDefinition } from '../data/exampleModel'
import { SUPPORT_PRESETS } from '../data/supportPresets'
import type {
  ElementDefaults,
  FrameModel,
  MaterialDefinition,
  ModelHistoryEntry,
  NodalLoadDefaults,
  SectionDefinition,
  SectionShape,
  SupportDefaults,
  ToolMode,
} from '../domain/frame'
import type { ModelAction } from '../state/modelReducer'

function scientific(value: number) {
  return value.toExponential(3)
}

function LibraryNumberField({
  label,
  value,
  unit,
  onChange,
}: {
  label: string
  value: number
  unit: string
  onChange: (value: number) => void
}) {
  const [draft, setDraft] = useState(scientific(value))
  useEffect(() => setDraft(scientific(value)), [value])
  const commit = () => {
    const parsed = Number(draft)
    if (Number.isFinite(parsed) && parsed > 0) onChange(parsed)
    else setDraft(scientific(value))
  }
  return (
    <label className="library-field">
      <span>{label}</span>
      <span><input value={draft} inputMode="decimal" onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()} /><small>{unit}</small></span>
    </label>
  )
}

function LibraryHeader({
  icon,
  eyebrow,
  title,
  subtitle,
  onToggleCollapsed,
}: {
  icon: ReactNode
  eyebrow: string
  title: string
  subtitle: string
  onToggleCollapsed: () => void
}) {
  return (
    <div className="properties-header library-panel-header" onDoubleClick={onToggleCollapsed} title="Double-click to collapse Properties">
      <div className="properties-identity">
        <span className="properties-icon">{icon}</span>
        <div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>
      </div>
      <span className="library-count">{subtitle}</span>
    </div>
  )
}

function AssignmentList({
  model,
  assignedId,
  kind,
  onApply,
  onApplyAll,
}: {
  model: FrameModel
  assignedId: string
  kind: 'material' | 'section'
  onApply: (elementId: number) => void
  onApplyAll: () => void
}) {
  return (
    <section className="library-apply-section">
      <div className="library-section-title"><div><span>ASSIGNMENT</span><strong>Apply to elements</strong></div><button type="button" onClick={onApplyAll}><CheckIcon sx={{ fontSize: 16 }} /> Apply all</button></div>
      <div className="element-assignment-list">
        {model.elements.length === 0 && <div className="library-empty-inline">Create an element before assigning properties.</div>}
        {model.elements.map((element) => {
          const isAssigned = (kind === 'material' ? element.material_id : element.section_id) === assignedId
          return (
            <button key={element.id} type="button" className={isAssigned ? 'is-assigned' : ''} onClick={() => onApply(element.id)}>
              <span className="assignment-element">E{element.id}</span>
              <span>{isAssigned ? <><CheckIcon sx={{ fontSize: 14 }} /> Assigned</> : 'Apply'}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

interface LibraryPanelProps {
  model: FrameModel
  dispatch: Dispatch<ModelAction>
  elementDefaults: ElementDefaults
  onElementDefaultsChange: (value: ElementDefaults) => void
  onToggleCollapsed: () => void
}

export function MaterialLibraryPanel({ model, dispatch, elementDefaults, onElementDefaultsChange, onToggleCollapsed }: LibraryPanelProps) {
  const [selectedId, setSelectedId] = useState(model.materials[0]?.id ?? '')
  useEffect(() => {
    if (!model.materials.some((item) => item.id === selectedId)) setSelectedId(model.materials[0]?.id ?? '')
  }, [model.materials, selectedId])
  const selected = model.materials.find((item) => item.id === selectedId)

  const addMaterial = () => {
    const id = `material-${Date.now().toString(36)}`
    const material: MaterialDefinition = { id, name: 'New material', E: 210e9, poisson: 0.3, density: 7850, color: '#6c78a8' }
    dispatch({ type: 'addMaterial', material })
    setSelectedId(id)
  }

  const apply = (elementId: number) => {
    if (!selected) return
    dispatch({ type: 'updateElement', id: elementId, patch: { material_id: selected.id, E: selected.E } })
  }

  const deleteSelected = () => {
    if (!selected) return
    if (elementDefaults.materialId === selected.id) {
      onElementDefaultsChange({ ...elementDefaults, materialId: null })
    }
    dispatch({ type: 'deleteMaterial', id: selected.id })
  }

  return (
    <aside className="properties-panel library-panel">
      <LibraryHeader icon={<LibraryBooksIcon fontSize="small" />} eyebrow="PROPERTY LIBRARY" title="Materials" subtitle={`${model.materials.length} defined`} onToggleCollapsed={onToggleCollapsed} />
      <div className="library-tabs" role="tablist" aria-label="Material definitions">
        {model.materials.map((material) => <button key={material.id} type="button" role="tab" aria-selected={material.id === selectedId} className={material.id === selectedId ? 'is-active' : ''} onClick={() => setSelectedId(material.id)}><i style={{ background: material.color }} />{material.name}</button>)}
        <button className="library-add-tab" type="button" onClick={addMaterial} aria-label="Add material" title="Add material"><AddIcon fontSize="small" /></button>
      </div>
      <div className="properties-scroll library-scroll">
        {!selected ? <div className="library-empty">Add a material to begin.</div> : <>
          <section className="library-editor-card">
            <div className="library-card-title"><div><span>MATERIAL DEFINITION</span><strong>{selected.name}</strong></div><button className="resource-delete-button" type="button" aria-label="Delete material" onClick={deleteSelected}><DeleteOutlineIcon sx={{ fontSize: 16 }} /><span>Delete</span></button></div>
            <label className="library-name-field"><span>Name</span><input value={selected.name} onChange={(event) => dispatch({ type: 'updateMaterial', id: selected.id, patch: { name: event.target.value } })} /></label>
            <LibraryNumberField label="Elastic modulus E" value={selected.E} unit="Pa" onChange={(E) => dispatch({ type: 'updateMaterial', id: selected.id, patch: { E } })} />
            <LibraryNumberField label="Density ρ" value={selected.density} unit="kg/m³" onChange={(density) => dispatch({ type: 'updateMaterial', id: selected.id, patch: { density } })} />
            <label className="library-field"><span>Poisson ratio ν</span><span><input type="number" step="0.01" value={selected.poisson} onChange={(event) => dispatch({ type: 'updateMaterial', id: selected.id, patch: { poisson: Number(event.target.value) } })} /><small>—</small></span></label>
            <button className={`use-default-button ${elementDefaults.materialId === selected.id ? 'is-active' : ''}`} type="button" onClick={() => onElementDefaultsChange({ ...elementDefaults, materialId: selected.id })}><CheckIcon sx={{ fontSize: 16 }} /> {elementDefaults.materialId === selected.id ? 'Default for new elements' : 'Use for new elements'}</button>
          </section>
          <AssignmentList model={model} assignedId={selected.id} kind="material" onApply={apply} onApplyAll={() => model.elements.forEach((element) => apply(element.id))} />
        </>}
      </div>
    </aside>
  )
}

const sectionShapes: Array<{ id: SectionShape; label: string }> = [
  { id: 'custom', label: 'Custom' },
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'circle', label: 'Circle' },
  { id: 'i-section', label: 'I section' },
  { id: 'tube', label: 'Tube' },
]

export function SectionLibraryPanel({ model, dispatch, elementDefaults, onElementDefaultsChange, onToggleCollapsed }: LibraryPanelProps) {
  const [selectedId, setSelectedId] = useState(model.sections[0]?.id ?? '')
  useEffect(() => {
    if (!model.sections.some((item) => item.id === selectedId)) setSelectedId(model.sections[0]?.id ?? '')
  }, [model.sections, selectedId])
  const selected = model.sections.find((item) => item.id === selectedId)

  const addSection = () => {
    const id = `section-${Date.now().toString(36)}`
    const section: SectionDefinition = { id, name: 'New section', shape: 'custom', A: 0.006, I: 8.5e-5, description: 'User-defined A / I', color: '#7c6fb1' }
    dispatch({ type: 'addSection', section })
    setSelectedId(id)
  }

  const apply = (elementId: number) => {
    if (!selected) return
    dispatch({ type: 'updateElement', id: elementId, patch: { section_id: selected.id, A: selected.A, I: selected.I } })
  }

  const deleteSelected = () => {
    if (!selected) return
    if (elementDefaults.sectionId === selected.id) {
      onElementDefaultsChange({ ...elementDefaults, sectionId: null })
    }
    dispatch({ type: 'deleteSection', id: selected.id })
  }

  return (
    <aside className="properties-panel library-panel">
      <LibraryHeader icon={<CategoryIcon fontSize="small" />} eyebrow="PROPERTY LIBRARY" title="Sections" subtitle={`${model.sections.length} defined`} onToggleCollapsed={onToggleCollapsed} />
      <div className="library-tabs" role="tablist" aria-label="Section definitions">
        {model.sections.map((section) => <button key={section.id} type="button" role="tab" aria-selected={section.id === selectedId} className={section.id === selectedId ? 'is-active' : ''} onClick={() => setSelectedId(section.id)}><i style={{ background: section.color }} />{section.name}</button>)}
        <button className="library-add-tab" type="button" onClick={addSection} aria-label="Add section" title="Add section"><AddIcon fontSize="small" /></button>
      </div>
      <div className="properties-scroll library-scroll">
        {!selected ? <div className="library-empty">Add a section to begin.</div> : <>
          <section className="library-editor-card">
            <div className="library-card-title"><div><span>SECTION DEFINITION</span><strong>{selected.name}</strong></div><button className="resource-delete-button" type="button" aria-label="Delete section" onClick={deleteSelected}><DeleteOutlineIcon sx={{ fontSize: 16 }} /><span>Delete</span></button></div>
            <label className="library-name-field"><span>Name</span><input value={selected.name} onChange={(event) => dispatch({ type: 'updateSection', id: selected.id, patch: { name: event.target.value } })} /></label>
            <div className="shape-picker">{sectionShapes.map((shape) => <button key={shape.id} type="button" className={selected.shape === shape.id ? 'is-active' : ''} onClick={() => dispatch({ type: 'updateSection', id: selected.id, patch: { shape: shape.id, description: shape.label } })}><span className={`section-shape section-shape--${shape.id}`} />{shape.label}</button>)}</div>
            <LibraryNumberField label="Cross-sectional area A" value={selected.A} unit="m²" onChange={(A) => dispatch({ type: 'updateSection', id: selected.id, patch: { A } })} />
            <LibraryNumberField label="Second moment I" value={selected.I} unit="m⁴" onChange={(I) => dispatch({ type: 'updateSection', id: selected.id, patch: { I } })} />
            <button className={`use-default-button ${elementDefaults.sectionId === selected.id ? 'is-active' : ''}`} type="button" onClick={() => onElementDefaultsChange({ ...elementDefaults, sectionId: selected.id })}><CheckIcon sx={{ fontSize: 16 }} /> {elementDefaults.sectionId === selected.id ? 'Default for new elements' : 'Use for new elements'}</button>
          </section>
          <AssignmentList model={model} assignedId={selected.id} kind="section" onApply={apply} onApplyAll={() => model.elements.forEach((element) => apply(element.id))} />
        </>}
      </div>
    </aside>
  )
}

export function ModelsPanel({
  history,
  examples,
  onRestore,
  onLoadExample,
  onDeleteHistory,
  onDeleteAllHistory,
  onDeleteExample,
  onDeleteAllExamples,
  onCreateExample,
  onToggleCollapsed,
}: {
  history: ModelHistoryEntry[]
  examples: ExampleModelDefinition[]
  onRestore: (entry: ModelHistoryEntry) => void
  onLoadExample: (example: ExampleModelDefinition) => void
  onDeleteHistory: (id: string) => void
  onDeleteAllHistory: () => void
  onDeleteExample: (id: string) => void
  onDeleteAllExamples: () => void
  onCreateExample: (entry: ModelHistoryEntry) => void
  onToggleCollapsed: () => void
}) {
  const [examplesCollapsed, setExamplesCollapsed] = useState(false)
  const [historyCollapsed, setHistoryCollapsed] = useState(false)
  const [draggedHistoryId, setDraggedHistoryId] = useState<string | null>(null)
  const [exampleDropActive, setExampleDropActive] = useState(false)

  const startHistoryDrag = (event: DragEvent<HTMLElement>, entry: ModelHistoryEntry) => {
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData('application/x-frame-history-id', entry.id)
    event.dataTransfer.setData('text/plain', entry.id)
    setDraggedHistoryId(entry.id)
  }

  const dropIntoExamples = (event: DragEvent<HTMLElement>) => {
    event.preventDefault()
    const entryId = event.dataTransfer.getData('application/x-frame-history-id')
      || event.dataTransfer.getData('text/plain')
    const entry = history.find((item) => item.id === entryId)
    setExampleDropActive(false)
    setDraggedHistoryId(null)
    if (!entry) return
    setExamplesCollapsed(false)
    onCreateExample(entry)
  }

  return (
    <aside className="properties-panel library-panel">
      <LibraryHeader icon={<HistoryIcon fontSize="small" />} eyebrow="MODEL BROWSER" title="Models" subtitle={`${history.length} saved`} onToggleCollapsed={onToggleCollapsed} />
      <div className="properties-scroll history-scroll">
        <section
          className={`model-browser-section ${exampleDropActive ? 'is-drop-target' : ''}`}
          onDragEnter={(event) => {
            event.preventDefault()
            setExampleDropActive(true)
          }}
          onDragOver={(event) => {
            event.preventDefault()
            event.dataTransfer.dropEffect = 'copy'
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setExampleDropActive(false)
          }}
          onDrop={dropIntoExamples}
        >
          <div className="model-section-header">
            <button className="model-section-toggle" type="button" onClick={() => setExamplesCollapsed((value) => !value)} aria-expanded={!examplesCollapsed}>
              {examplesCollapsed ? <ChevronRightIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              <MenuBookIcon fontSize="small" />
              <span><strong>Example models</strong><small>{exampleDropActive ? 'Drop here to create an example.' : 'Load a ready-to-run structural model.'}</small></span>
              <b>{examples.length}</b>
            </button>
            <button className="model-batch-delete" type="button" onClick={onDeleteAllExamples} disabled={examples.length === 0} aria-label="Delete all examples" title="Delete all examples"><DeleteOutlineIcon sx={{ fontSize: 14 }} /><span>Delete all</span></button>
          </div>
          {!examplesCollapsed && (
            <div className="example-model-list">
              {examples.length === 0 && <div className="library-empty model-list-empty">Drag a Recent model here to create an Example.</div>}
              {examples.map((example) => (
                <article key={example.id} className="example-model-card">
                  <div className="example-card-heading"><div><strong>{example.name}</strong><span>{example.description}</span></div><button type="button" onClick={() => onDeleteExample(example.id)} aria-label={`Delete example ${example.name}`} title="Delete example"><DeleteOutlineIcon sx={{ fontSize: 16 }} /></button></div>
                  <div className="example-model-meta"><span>{example.model.nodes.length} nodes</span><span>{example.model.elements.length} elements</span></div>
                  <button type="button" onClick={() => onLoadExample(example)}>Load example</button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="model-browser-section">
          <div className="model-section-header">
            <button className="model-section-toggle" type="button" onClick={() => setHistoryCollapsed((value) => !value)} aria-expanded={!historyCollapsed}>
              {historyCollapsed ? <ChevronRightIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              <ScheduleIcon fontSize="small" />
              <span><strong>Recent models</strong><small>Drag a card into Example models to reuse it.</small></span>
              <b>{history.length}</b>
            </button>
            <button className="model-batch-delete" type="button" onClick={onDeleteAllHistory} disabled={history.length === 0} aria-label="Delete all recent models" title="Delete all recent models"><DeleteOutlineIcon sx={{ fontSize: 14 }} /><span>Delete all</span></button>
          </div>
          {!historyCollapsed && (
            <>
              {history.length === 0 && <div className="library-empty model-list-empty">Save or analyze a model to create the first snapshot.</div>}
              <div className="history-list">
                {history.map((entry) => <article key={entry.id} className={`history-card ${draggedHistoryId === entry.id ? 'is-dragging' : ''}`} draggable onDragStart={(event) => startHistoryDrag(event, entry)} onDragEnd={() => { setDraggedHistoryId(null); setExampleDropActive(false) }}>
                  <div className="history-card-top"><DragIndicatorIcon className="history-drag-handle" sx={{ fontSize: 16 }} /><div><span>{entry.source === 'saved' ? 'SAVED' : 'ANALYZED'}</span><strong>{entry.name}</strong></div><div className="history-card-actions"><button type="button" onClick={() => onCreateExample(entry)} aria-label={`Add ${entry.name} to examples`} title="Add to Example models"><AddIcon sx={{ fontSize: 16 }} /></button><button type="button" onClick={() => onDeleteHistory(entry.id)} aria-label={`Delete ${entry.name}`} title="Delete recent model"><DeleteOutlineIcon sx={{ fontSize: 16 }} /></button></div></div>
                  <div className="history-meta"><span>{entry.model.nodes.length} nodes</span><span>{entry.model.elements.length} elements</span><time>{new Date(entry.savedAt).toLocaleString()}</time></div>
                  <button className="restore-button" type="button" onClick={() => onRestore(entry)}><UndoIcon sx={{ fontSize: 16 }} /> Restore model</button>
                </article>)}
              </div>
            </>
          )}
        </section>
      </div>
    </aside>
  )
}

export function ToolSetupPanel({
  tool,
  model,
  elementDefaults,
  supportDefaults,
  nodalLoadDefaults,
  onElementDefaultsChange,
  onSupportDefaultsChange,
  onNodalLoadDefaultsChange,
  onToolChange,
  onToggleCollapsed,
}: {
  tool: ToolMode
  model: FrameModel
  elementDefaults: ElementDefaults
  supportDefaults: SupportDefaults
  nodalLoadDefaults: NodalLoadDefaults
  onElementDefaultsChange: (value: ElementDefaults) => void
  onSupportDefaultsChange: (value: SupportDefaults) => void
  onNodalLoadDefaultsChange: (value: NodalLoadDefaults) => void
  onToolChange: (tool: ToolMode) => void
  onToggleCollapsed: () => void
}) {
  const definitions = {
    node: { icon: <FiberManualRecordIcon fontSize="small" />, eyebrow: 'CREATE TOOL', title: 'Node', description: 'Click on the grid to place a node. Coordinates snap to 0.25 m.' },
    element: { icon: <AccountTreeIcon fontSize="small" />, eyebrow: 'CREATE TOOL', title: 'Element', description: 'Select an i-node and j-node to create a frame element.' },
    support: { icon: <ChangeHistoryIcon fontSize="small" />, eyebrow: 'CREATE TOOL', title: 'Support', description: 'Choose a support type, then click a node to assign it.' },
    load: { icon: <SouthIcon fontSize="small" />, eyebrow: 'CREATE TOOL', title: 'Load', description: 'Click a node for a nodal load or an element for a distributed load.' },
  } as const
  if (!(tool in definitions)) return null
  const definition = definitions[tool as keyof typeof definitions]
  return (
    <aside className="properties-panel tool-setup-panel">
      <LibraryHeader icon={definition.icon} eyebrow={definition.eyebrow} title={definition.title} subtitle="Defaults" onToggleCollapsed={onToggleCollapsed} />
      <div className="properties-scroll">
        <div className="tool-setup-intro"><strong>{definition.title} placement</strong><span>{definition.description}</span></div>
        {tool === 'node' && <section className="tool-default-card"><span>GRID & SNAP</span><div className="tool-readout"><b>0.25</b><small>m increment</small></div><div className="tool-check"><CheckIcon sx={{ fontSize: 16 }} /> Global X / Y coordinates</div></section>}
        {tool === 'element' && <section className="tool-default-card"><span>NEW ELEMENT ASSIGNMENTS</span><label>Material<select value={elementDefaults.materialId ?? ''} onChange={(event) => onElementDefaultsChange({ ...elementDefaults, materialId: event.target.value || null })}><option value="">Unassigned</option>{model.materials.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Section<select value={elementDefaults.sectionId ?? ''} onChange={(event) => onElementDefaultsChange({ ...elementDefaults, sectionId: event.target.value || null })}><option value="">Unassigned</option>{model.sections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className="tool-default-actions"><button type="button" onClick={() => onToolChange('material')}>Open Materials</button><button type="button" onClick={() => onToolChange('section')}>Open Sections</button></div></section>}
        {tool === 'support' && (
          <section className="tool-default-card">
            <span>DEFAULT SUPPORT TYPE</span>
            <div className="support-default-list">
              {SUPPORT_PRESETS.map((preset) => {
                const active = preset.restraints.u === supportDefaults.u && preset.restraints.v === supportDefaults.v && preset.restraints.phi === supportDefaults.phi
                return <button key={preset.label} type="button" className={active ? 'is-active' : ''} onClick={() => onSupportDefaultsChange({ ...supportDefaults, ...preset.restraints })}><span className={`mini-support mini-support--${preset.symbol}`} /><span><b>{preset.label}</b><small>{preset.detail}</small></span></button>
              })}
            </div>
            <label>Support angle (deg)<input type="number" value={supportDefaults.angle} onChange={(event) => onSupportDefaultsChange({ ...supportDefaults, angle: Number(event.target.value) || 0 })} /></label>
            <p>Angle rotates the support-local u′ axis counter-clockwise from global +X.</p>
          </section>
        )}
        {tool === 'load' && (
          <section className="tool-default-card">
            <span>NODE CLICK ACTION</span>
            <div className="support-default-list load-default-list">
              <button type="button" className={nodalLoadDefaults.fy !== 0 && nodalLoadDefaults.fx === 0 && nodalLoadDefaults.mz === 0 ? 'is-active' : ''} onClick={() => onNodalLoadDefaultsChange({ fx: 0, fy: -1000, mz: 0 })}><SouthIcon fontSize="small" /><span><b>Force Y</b><small>Fy = −1.000 kN</small></span></button>
              <button type="button" className={nodalLoadDefaults.fx !== 0 && nodalLoadDefaults.fy === 0 && nodalLoadDefaults.mz === 0 ? 'is-active' : ''} onClick={() => onNodalLoadDefaultsChange({ fx: 1000, fy: 0, mz: 0 })}><FiberManualRecordIcon fontSize="small" /><span><b>Force X</b><small>Fx = +1.000 kN</small></span></button>
              <button type="button" className={nodalLoadDefaults.mz !== 0 && nodalLoadDefaults.fx === 0 && nodalLoadDefaults.fy === 0 ? 'is-active' : ''} onClick={() => onNodalLoadDefaultsChange({ fx: 0, fy: 0, mz: 1000 })}><UndoIcon fontSize="small" /><span><b>Moment</b><small>Mz = +1.000 kN·m</small></span></button>
            </div>
            <p>Select Moment, then click a node to apply Mz directly. Components can be edited after placement.</p>
          </section>
        )}
      </div>
    </aside>
  )
}
