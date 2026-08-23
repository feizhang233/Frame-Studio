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
import LinearScaleIcon from '@mui/icons-material/LinearScale'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import MenuBookIcon from '@mui/icons-material/MenuBook'
import SaveIcon from '@mui/icons-material/Save'
import ScheduleIcon from '@mui/icons-material/Schedule'
import SouthIcon from '@mui/icons-material/South'
import UndoIcon from '@mui/icons-material/Undo'
import { useEffect, useState, type Dispatch, type DragEvent, type ReactNode } from 'react'
import type { ExampleModelDefinition } from '../data/exampleModel'
import { SUPPORT_PRESETS } from '../data/supportPresets'
import {
  buildFrameElement,
  hasElementBetween,
  type ElementDefaults,
  type FrameModel,
  type MaterialDefinition,
  type ModelHistoryEntry,
  type NodalLoadDefaults,
  type SectionDefinition,
  type SectionShape,
  type Selection,
  type SupportDefaults,
  type ToolMode,
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

export type AssignmentOverlayKind = 'material' | 'section'

function AssignmentList({
  model,
  assignedId,
  kind,
  assignmentOverlay,
  onApply,
  onApplyAll,
  onToggleAssignmentOverlay,
}: {
  model: FrameModel
  assignedId: string
  kind: AssignmentOverlayKind
  assignmentOverlay: AssignmentOverlayKind | null
  onApply: (elementId: number) => void
  onApplyAll: () => void
  onToggleAssignmentOverlay: (kind: AssignmentOverlayKind) => void
}) {
  const resolveName = (id: string | null) => {
    if (!id) return null
    if (kind === 'material') return model.materials.find((item) => item.id === id)?.name ?? id
    return model.sections.find((item) => item.id === id)?.name ?? id
  }
  const overlayActive = assignmentOverlay === kind

  return (
    <section className="library-apply-section" data-assignment-overlay-keep>
      <div className="library-section-title">
        <div><span>ASSIGNMENT</span><strong>Apply to elements</strong></div>
        <button type="button" onClick={onApplyAll}><CheckIcon sx={{ fontSize: 16 }} /> Apply all</button>
      </div>
      <div className="element-assignment-list">
        {model.elements.length === 0 && <div className="library-empty-inline">Create an element before assigning properties.</div>}
        {model.elements.map((element) => {
          const currentId = kind === 'material' ? element.material_id : element.section_id
          const isAssignedHere = currentId === assignedId
          const isAssignedOther = currentId != null && currentId !== assignedId
          const otherName = isAssignedOther ? resolveName(currentId) : null
          const className = isAssignedHere ? 'is-assigned' : isAssignedOther ? 'is-assigned-other' : ''
          return (
            <button
              key={element.id}
              type="button"
              className={className}
              title={isAssignedOther ? `Currently ${otherName}. Click to reassign.` : isAssignedHere ? 'Already assigned' : 'Apply selected definition'}
              onClick={() => onApply(element.id)}
            >
              <span className="assignment-element">E{element.id}</span>
              <span>
                {isAssignedHere ? (
                  <><CheckIcon sx={{ fontSize: 14 }} /> Assigned</>
                ) : isAssignedOther ? (
                  otherName
                ) : (
                  'Apply'
                )}
              </span>
            </button>
          )
        })}
      </div>
      <button
        type="button"
        className={`assignment-details-footer ${overlayActive ? 'is-active' : ''}`}
        aria-pressed={overlayActive}
        onClick={() => onToggleAssignmentOverlay(kind)}
      >
        More details
      </button>
    </section>
  )
}

function LibrarySelectBar({
  items,
  selectedId,
  onSelect,
  onAdd,
  addLabel,
  ariaLabel,
}: {
  items: Array<{ id: string; name: string; color: string }>
  selectedId: string
  onSelect: (id: string) => void
  onAdd: () => void
  addLabel: string
  ariaLabel: string
}) {
  const selected = items.find((item) => item.id === selectedId)
  return (
    <div className="library-select-bar">
      <label className="library-select-field">
        <span className="library-select-swatch" style={{ background: selected?.color ?? '#9aa5b5' }} aria-hidden="true" />
        <select
          aria-label={ariaLabel}
          value={selectedId}
          onChange={(event) => onSelect(event.target.value)}
          disabled={items.length === 0}
        >
          {items.length === 0 && <option value="">No definitions yet</option>}
          {items.map((item) => (
            <option key={item.id} value={item.id}>{item.name}</option>
          ))}
        </select>
      </label>
      <button className="library-add-button" type="button" onClick={onAdd} aria-label={addLabel} title={addLabel}>
        <AddIcon fontSize="small" />
      </button>
    </div>
  )
}

interface LibraryPanelProps {
  model: FrameModel
  dispatch: Dispatch<ModelAction>
  elementDefaults: ElementDefaults
  assignmentOverlay: AssignmentOverlayKind | null
  onElementDefaultsChange: (value: ElementDefaults) => void
  onToggleAssignmentOverlay: (kind: AssignmentOverlayKind) => void
  onToggleCollapsed: () => void
}

export function MaterialLibraryPanel({
  model,
  dispatch,
  elementDefaults,
  assignmentOverlay,
  onElementDefaultsChange,
  onToggleAssignmentOverlay,
  onToggleCollapsed,
}: LibraryPanelProps) {
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
      <LibrarySelectBar
        items={model.materials}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAdd={addMaterial}
        addLabel="Add material"
        ariaLabel="Select material definition"
      />
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
          <AssignmentList
            model={model}
            assignedId={selected.id}
            kind="material"
            assignmentOverlay={assignmentOverlay}
            onApply={apply}
            onApplyAll={() => model.elements.forEach((element) => apply(element.id))}
            onToggleAssignmentOverlay={onToggleAssignmentOverlay}
          />
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

export function SectionLibraryPanel({
  model,
  dispatch,
  elementDefaults,
  assignmentOverlay,
  onElementDefaultsChange,
  onToggleAssignmentOverlay,
  onToggleCollapsed,
}: LibraryPanelProps) {
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
      <LibrarySelectBar
        items={model.sections}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onAdd={addSection}
        addLabel="Add section"
        ariaLabel="Select section definition"
      />
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
          <AssignmentList
            model={model}
            assignedId={selected.id}
            kind="section"
            assignmentOverlay={assignmentOverlay}
            onApply={apply}
            onApplyAll={() => model.elements.forEach((element) => apply(element.id))}
            onToggleAssignmentOverlay={onToggleAssignmentOverlay}
          />
        </>}
      </div>
    </aside>
  )
}

export function ModelsPanel({
  history,
  examples,
  isGuest,
  onRestore,
  onLoadExample,
  onDeleteHistory,
  onDeleteHistoryGroup,
  onDeleteExample,
  onDeleteAllExamples,
  onCreateExample,
  onSignIn,
  onToggleCollapsed,
}: {
  history: ModelHistoryEntry[]
  examples: ExampleModelDefinition[]
  isGuest: boolean
  onRestore: (entry: ModelHistoryEntry) => void
  onLoadExample: (example: ExampleModelDefinition) => void
  onDeleteHistory: (id: string) => void
  onDeleteHistoryGroup: (source: ModelHistoryEntry['source']) => void
  onDeleteExample: (id: string) => void
  onDeleteAllExamples: () => void
  onCreateExample: (entry: ModelHistoryEntry) => void
  onSignIn: () => void
  onToggleCollapsed: () => void
}) {
  const [examplesCollapsed, setExamplesCollapsed] = useState(true)
  const [savedCollapsed, setSavedCollapsed] = useState(false)
  const [historyCollapsed, setHistoryCollapsed] = useState(true)
  const [draggedHistoryId, setDraggedHistoryId] = useState<string | null>(null)
  const [exampleDropActive, setExampleDropActive] = useState(false)
  const savedModels = history.filter((entry) => entry.source === 'saved')
  const recentAnalyses = history.filter((entry) => entry.source === 'analyzed')

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
      <LibraryHeader icon={<HistoryIcon fontSize="small" />} eyebrow="MODEL BROWSER" title="Models" subtitle={isGuest ? 'Guest mode' : `${savedModels.length} saved`} onToggleCollapsed={onToggleCollapsed} />
      <div className="properties-scroll history-scroll">
        {isGuest && (
          <section className="model-auth-callout">
            <span><LockOutlinedIcon sx={{ fontSize: 18 }} /></span>
            <div>
              <strong>Guest work is not saved</strong>
              <p>Sign in or register to keep private models and recent analyses.</p>
              <button type="button" onClick={onSignIn}>Sign in to save</button>
            </div>
          </section>
        )}
        <section className="model-browser-section">
          <div className="model-section-header">
            <button className="model-section-toggle" type="button" onClick={() => setSavedCollapsed((value) => !value)} aria-expanded={!savedCollapsed}>
              {savedCollapsed ? <ChevronRightIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              <SaveIcon fontSize="small" />
              <span><strong>Saved models</strong><small>Models explicitly saved from the toolbar.</small></span>
              <b>{savedModels.length}</b>
            </button>
            <button className="model-batch-delete" type="button" onClick={() => onDeleteHistoryGroup('saved')} disabled={savedModels.length === 0} aria-label="Delete all saved models" title="Delete all saved models"><DeleteOutlineIcon sx={{ fontSize: 14 }} /><span>Delete all</span></button>
          </div>
          {!savedCollapsed && (
            <>
              {savedModels.length === 0 && <div className="library-empty model-list-empty">{isGuest ? 'Saved models are available after sign in.' : 'Use Save to add the current model here.'}</div>}
              <div className="history-list">
                {savedModels.map((entry) => <article key={entry.id} className={`history-card ${draggedHistoryId === entry.id ? 'is-dragging' : ''}`} draggable onDragStart={(event) => startHistoryDrag(event, entry)} onDragEnd={() => { setDraggedHistoryId(null); setExampleDropActive(false) }}>
                  <div className="history-card-top"><DragIndicatorIcon className="history-drag-handle" sx={{ fontSize: 16 }} /><div><span>SAVED</span><strong>{entry.name}</strong></div><div className="history-card-actions"><button type="button" onClick={() => onCreateExample(entry)} aria-label={`Add ${entry.name} to examples`} title="Add to Example models"><AddIcon sx={{ fontSize: 16 }} /></button><button type="button" onClick={() => onDeleteHistory(entry.id)} aria-label={`Delete ${entry.name}`} title="Delete saved model"><DeleteOutlineIcon sx={{ fontSize: 16 }} /></button></div></div>
                  <div className="history-meta"><span>{entry.model.nodes.length} nodes</span><span>{entry.model.elements.length} elements</span><time>{new Date(entry.savedAt).toLocaleString()}</time></div>
                  <button className="restore-button" type="button" onClick={() => onRestore(entry)}><UndoIcon sx={{ fontSize: 16 }} /> Open saved model</button>
                </article>)}
              </div>
            </>
          )}
        </section>

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
              {examples.length === 0 && <div className="library-empty model-list-empty">Drag a saved model or recent analysis here to create an Example.</div>}
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
              <span><strong>Recent analyses</strong><small>{isGuest ? 'Sign in to keep automatic snapshots.' : 'Automatic snapshots created after analysis.'}</small></span>
              <b>{recentAnalyses.length}</b>
            </button>
            <button className="model-batch-delete" type="button" onClick={() => onDeleteHistoryGroup('analyzed')} disabled={recentAnalyses.length === 0} aria-label="Delete all recent analyses" title="Delete all recent analyses"><DeleteOutlineIcon sx={{ fontSize: 14 }} /><span>Delete all</span></button>
          </div>
          {!historyCollapsed && (
            <>
              {recentAnalyses.length === 0 && <div className="library-empty model-list-empty">{isGuest ? 'Guest analyses are not stored.' : 'Run an analysis to create the first automatic snapshot.'}</div>}
              <div className="history-list">
                {recentAnalyses.map((entry) => <article key={entry.id} className={`history-card ${draggedHistoryId === entry.id ? 'is-dragging' : ''}`} draggable onDragStart={(event) => startHistoryDrag(event, entry)} onDragEnd={() => { setDraggedHistoryId(null); setExampleDropActive(false) }}>
                  <div className="history-card-top"><DragIndicatorIcon className="history-drag-handle" sx={{ fontSize: 16 }} /><div><span>ANALYZED</span><strong>{entry.name}</strong></div><div className="history-card-actions"><button type="button" onClick={() => onCreateExample(entry)} aria-label={`Add ${entry.name} to examples`} title="Add to Example models"><AddIcon sx={{ fontSize: 16 }} /></button><button type="button" onClick={() => onDeleteHistory(entry.id)} aria-label={`Delete ${entry.name}`} title="Delete recent analysis"><DeleteOutlineIcon sx={{ fontSize: 16 }} /></button></div></div>
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
  dispatch,
  onElementDefaultsChange,
  onSupportDefaultsChange,
  onNodalLoadDefaultsChange,
  onToolChange,
  onToggleCollapsed,
  onSelectionChange,
}: {
  tool: ToolMode
  model: FrameModel
  elementDefaults: ElementDefaults
  supportDefaults: SupportDefaults
  nodalLoadDefaults: NodalLoadDefaults
  dispatch: Dispatch<ModelAction>
  onElementDefaultsChange: (value: ElementDefaults) => void
  onSupportDefaultsChange: (value: SupportDefaults) => void
  onNodalLoadDefaultsChange: (value: NodalLoadDefaults) => void
  onToolChange: (tool: ToolMode) => void
  onToggleCollapsed: () => void
  onSelectionChange: (selection: Selection) => void
}) {
  const [nodeX, setNodeX] = useState('0')
  const [nodeY, setNodeY] = useState('0')
  const [connectI, setConnectI] = useState<number | ''>('')
  const [connectJ, setConnectJ] = useState<number | ''>('')
  const [connectError, setConnectError] = useState('')

  useEffect(() => {
    const ids = model.nodes.map((node) => node.id)
    setConnectI((current) => (current !== '' && ids.includes(current) ? current : ids[0] ?? ''))
    setConnectJ((current) => {
      if (current !== '' && ids.includes(current)) return current
      return ids.find((id) => id !== (ids[0] ?? -1)) ?? ''
    })
  }, [model.nodes])

  const definitions = {
    node: { icon: <FiberManualRecordIcon fontSize="small" />, eyebrow: 'CREATE TOOL', title: 'Node', description: 'Enter coordinates below, or click the grid to place a node. Coordinates snap to 0.25 m.' },
    'insert-node': { icon: <AccountTreeIcon fontSize="small" />, eyebrow: 'NODE TOOL', title: 'Insert node', description: 'Select an existing frame element, then choose the exact split position.' },
    element: { icon: <LinearScaleIcon fontSize="small" />, eyebrow: 'CREATE TOOL', title: 'Element', description: 'Click two nodes on the canvas to draw a member. Empty clicks place a node and use it as an endpoint. Keep clicking to chain members.' },
    support: { icon: <ChangeHistoryIcon fontSize="small" />, eyebrow: 'CREATE TOOL', title: 'Support', description: 'Choose a support type, then click a node to assign it.' },
    load: { icon: <SouthIcon fontSize="small" />, eyebrow: 'CREATE TOOL', title: 'Load', description: 'Click a node for a nodal load or an element for a distributed load.' },
  } as const
  if (!(tool in definitions)) return null
  const definition = definitions[tool as keyof typeof definitions]

  const snapCoord = (value: number, step = 0.25) => Math.round(value / step) * step

  const placeNodeAtCoordinates = () => {
    const x = Number(nodeX)
    const y = Number(nodeY)
    if (!Number.isFinite(x) || !Number.isFinite(y)) return
    const id = Math.max(0, ...model.nodes.map((node) => node.id)) + 1
    const node = { id, x: snapCoord(x), y: snapCoord(y) }
    dispatch({ type: 'addNode', node })
    onSelectionChange({ type: 'node', id: node.id })
    setNodeX(String(node.x))
    setNodeY(String(node.y))
  }

  return (
    <aside className="properties-panel tool-setup-panel">
      <LibraryHeader icon={definition.icon} eyebrow={definition.eyebrow} title={definition.title} subtitle="Defaults" onToggleCollapsed={onToggleCollapsed} />
      <div className="properties-scroll">
        <div className="tool-setup-intro"><strong>{definition.title} placement</strong><span>{definition.description}</span></div>
        {tool === 'node' && (
          <>
            <section className="tool-default-card">
              <span>PLACE BY COORDINATES</span>
              <div className="node-coord-fields">
                <label>
                  Global X
                  <span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={nodeX}
                      onChange={(event) => setNodeX(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') placeNodeAtCoordinates()
                      }}
                    />
                    <small>m</small>
                  </span>
                </label>
                <label>
                  Global Y
                  <span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={nodeY}
                      onChange={(event) => setNodeY(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') placeNodeAtCoordinates()
                      }}
                    />
                    <small>m</small>
                  </span>
                </label>
              </div>
              <button className="place-node-button" type="button" onClick={placeNodeAtCoordinates}>
                <AddIcon sx={{ fontSize: 16 }} /> Add node
              </button>
              <div className="tool-check"><CheckIcon sx={{ fontSize: 16 }} /> Snap 0.25 m · or click the canvas</div>
            </section>
            <section className="tool-default-card insert-node-entry">
              <span>INSERT ON ELEMENT</span>
              <strong>Split an existing member</strong>
              <p>Choose an element on the canvas, then place the node by fraction or distance.</p>
              <button
                className="insert-node-mode-button"
                type="button"
                onClick={() => onToolChange('insert-node')}
                disabled={model.elements.length === 0}
              >
                <AccountTreeIcon sx={{ fontSize: 17 }} />
                {model.elements.length === 0 ? 'Create an element first' : 'Choose element'}
              </button>
            </section>
          </>
        )}
        {tool === 'insert-node' && (
          <section className="tool-default-card insert-node-picker">
            <span>SELECT ELEMENT</span>
            <p>Click a member on the canvas, or choose one below. Its Insert node controls will open at the bottom of the element properties.</p>
            <div className="insert-node-element-list">
              {model.elements.map((element) => (
                <button
                  key={element.id}
                  type="button"
                  onClick={() => onSelectionChange({ type: 'element', id: element.id })}
                >
                  <b>E{element.id}</b>
                  <small>N{element.node_i} → N{element.node_j}</small>
                  <ChevronRightIcon sx={{ fontSize: 17 }} />
                </button>
              ))}
            </div>
            <button className="insert-node-cancel-button" type="button" onClick={() => onToolChange('node')}>
              Back to place node
            </button>
          </section>
        )}
        {tool === 'element' && (
          <>
            <section className="tool-default-card">
              <span>CONNECT NODES</span>
              <ol className="element-connect-steps">
                <li><b>1</b><span>Click the start node (or empty grid to place one).</span></li>
                <li><b>2</b><span>Click the end node. A new member appears between them.</span></li>
                <li><b>3</b><span>Keep clicking to chain the next member. Esc or right-click cancels.</span></li>
              </ol>
              {model.nodes.length < 2 ? (
                <>
                  <p>Place at least two nodes first, or click two points on the canvas in this tool.</p>
                  <button type="button" className="place-node-button" onClick={() => onToolChange('node')}>
                    <FiberManualRecordIcon sx={{ fontSize: 16 }} /> Place nodes
                  </button>
                </>
              ) : (
                <>
                  <label>
                    Start node
                    <select
                      value={connectI}
                      onChange={(event) => {
                        setConnectI(Number(event.target.value))
                        setConnectError('')
                      }}
                    >
                      {model.nodes.map((node) => (
                        <option key={node.id} value={node.id}>N{node.id}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    End node
                    <select
                      value={connectJ}
                      onChange={(event) => {
                        setConnectJ(Number(event.target.value))
                        setConnectError('')
                      }}
                    >
                      {model.nodes.map((node) => (
                        <option key={node.id} value={node.id}>N{node.id}</option>
                      ))}
                    </select>
                  </label>
                  {connectError && <p className="tool-connect-error">{connectError}</p>}
                  <button
                    className="place-node-button"
                    type="button"
                    disabled={connectI === '' || connectJ === '' || connectI === connectJ}
                    onClick={() => {
                      if (connectI === '' || connectJ === '' || connectI === connectJ) {
                        setConnectError('Choose two different nodes.')
                        return
                      }
                      if (hasElementBetween(model.elements, connectI, connectJ)) {
                        setConnectError(`N${connectI} and N${connectJ} are already connected.`)
                        return
                      }
                      const element = buildFrameElement(model, connectI, connectJ, elementDefaults)
                      dispatch({ type: 'addElement', element })
                      onSelectionChange({ type: 'element', id: element.id })
                      setConnectError('')
                    }}
                  >
                    <AddIcon sx={{ fontSize: 16 }} /> Create element
                  </button>
                  <div className="tool-check"><CheckIcon sx={{ fontSize: 16 }} /> Or click two nodes on the canvas</div>
                </>
              )}
            </section>
            <section className="tool-default-card">
              <span>NEW ELEMENT ASSIGNMENTS</span>
              <label>
                Material
                <select
                  value={elementDefaults.materialId ?? ''}
                  onChange={(event) => onElementDefaultsChange({ ...elementDefaults, materialId: event.target.value || null })}
                >
                  <option value="">Unassigned</option>
                  {model.materials.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Section
                <select
                  value={elementDefaults.sectionId ?? ''}
                  onChange={(event) => onElementDefaultsChange({ ...elementDefaults, sectionId: event.target.value || null })}
                >
                  <option value="">Unassigned</option>
                  {model.sections.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>
              <div className="tool-default-actions">
                <button type="button" onClick={() => onToolChange('material')}>Open Materials</button>
                <button type="button" onClick={() => onToolChange('section')}>Open Sections</button>
              </div>
            </section>
          </>
        )}
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
