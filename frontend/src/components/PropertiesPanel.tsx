import AccountTreeIcon from '@mui/icons-material/AccountTree'
import ChangeHistoryIcon from '@mui/icons-material/ChangeHistory'
import CloseIcon from '@mui/icons-material/Close'
import DataObjectIcon from '@mui/icons-material/DataObject'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import SouthIcon from '@mui/icons-material/South'
import TuneIcon from '@mui/icons-material/Tune'
import { useEffect, useState, type Dispatch, type ReactNode } from 'react'
import type { ExampleModelDefinition } from '../data/exampleModel'
import { SUPPORT_PRESETS } from '../data/supportPresets'
import {
  getElementProperties,
  type ElementDefaults,
  type FrameModel,
  type ModelHistoryEntry,
  type NodalLoadDefaults,
  type Selection,
  type SupportDefaults,
  type ToolMode,
} from '../domain/frame'
import type { ModelAction } from '../state/modelReducer'
import {
  MaterialLibraryPanel,
  ModelsPanel,
  SectionLibraryPanel,
  ToolSetupPanel,
  type AssignmentOverlayKind,
} from './LibraryPanels'

interface PropertiesPanelProps {
  model: FrameModel
  activeTool: ToolMode
  selection: Selection
  elementDefaults: ElementDefaults
  supportDefaults: SupportDefaults
  nodalLoadDefaults: NodalLoadDefaults
  modelHistory: ModelHistoryEntry[]
  exampleModels: ExampleModelDefinition[]
  isCollapsed: boolean
  assignmentOverlay: AssignmentOverlayKind | null
  dispatch: Dispatch<ModelAction>
  onToolChange: (tool: ToolMode) => void
  onElementDefaultsChange: (value: ElementDefaults) => void
  onSupportDefaultsChange: (value: SupportDefaults) => void
  onNodalLoadDefaultsChange: (value: NodalLoadDefaults) => void
  onRestoreModel: (entry: ModelHistoryEntry) => void
  onDeleteHistory: (id: string) => void
  onDeleteAllHistory: () => void
  onDeleteExample: (id: string) => void
  onDeleteAllExamples: () => void
  onCreateExample: (entry: ModelHistoryEntry) => void
  onLoadExample: (example: ExampleModelDefinition) => void
  onSelectionChange: (selection: Selection) => void
  onToggleAssignmentOverlay: (kind: AssignmentOverlayKind) => void
  onToggleCollapsed: () => void
}

function NumberField({
  label,
  value,
  unit,
  onChange,
  min,
  scientific = false,
}: {
  label: string
  value: number
  unit?: string
  onChange: (value: number) => void
  min?: number
  scientific?: boolean
}) {
  const formatDraft = (number: number) => scientific ? number.toExponential(3) : String(number)
  const [draft, setDraft] = useState(() => formatDraft(value))

  useEffect(() => {
    setDraft(formatDraft(value))
  }, [scientific, value])

  const commit = () => {
    const parsed = Number(draft.trim())
    if (!Number.isFinite(parsed) || (min !== undefined && parsed < min)) {
      setDraft(formatDraft(value))
      return
    }
    onChange(parsed)
    setDraft(formatDraft(parsed))
  }

  return (
    <label className="property-field">
      <span>{label}</span>
      <span className="field-input-wrap">
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur()
            if (event.key === 'Escape') {
              setDraft(formatDraft(value))
              event.currentTarget.blur()
            }
          }}
        />
        {unit && <span className="field-unit">{unit}</span>}
      </span>
    </label>
  )
}

function PropertySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="property-section">
      <h3>{title}</h3>
      <div className="property-section-content">{children}</div>
    </section>
  )
}

function PanelHeader({
  icon,
  eyebrow,
  title,
  onClose,
  onToggleCollapsed,
}: {
  icon: ReactNode
  eyebrow: string
  title: string
  onClose?: () => void
  onToggleCollapsed: () => void
}) {
  return (
    <div
      className="properties-header"
      onDoubleClick={(event) => {
        if ((event.target as HTMLElement).closest('button')) return
        onToggleCollapsed()
      }}
      title="Double-click to collapse Properties"
    >
      <div className="properties-identity">
        <span className="properties-icon">{icon}</span>
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
      </div>
      {onClose && <button type="button" onClick={onClose} aria-label="Clear selection"><CloseIcon fontSize="small" /></button>}
    </div>
  )
}

function DeleteButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button className="delete-button" type="button" onClick={onClick}>
      <DeleteOutlineIcon fontSize="small" />
      {label}
    </button>
  )
}

function ElementPropertiesPanel({
  model,
  elementId,
  dispatch,
  onToolChange,
  onClose,
  onToggleCollapsed,
  onDeleted,
  onSplitSelect,
}: {
  model: FrameModel
  elementId: number
  dispatch: Dispatch<ModelAction>
  onToolChange: (tool: ToolMode) => void
  onClose: () => void
  onToggleCollapsed: () => void
  onDeleted: () => void
  onSplitSelect: (nodeId: number) => void
}) {
  const element = model.elements.find((item) => item.id === elementId)
  const [splitMode, setSplitMode] = useState<'ratio' | 'distance'>('ratio')
  const [ratioDraft, setRatioDraft] = useState('0.5')
  const [distanceDraft, setDistanceDraft] = useState('1')

  if (!element) return null
  const properties = getElementProperties(model, element)
  const nodeI = model.nodes.find((item) => item.id === element.node_i)
  const nodeJ = model.nodes.find((item) => item.id === element.node_j)
  const length = nodeI && nodeJ ? Math.hypot(nodeJ.x - nodeI.x, nodeJ.y - nodeI.y) : 0

  const splitElement = () => {
    if (length <= 0) return
    let ratio = 0.5
    if (splitMode === 'ratio') {
      const parsed = Number(ratioDraft)
      if (!Number.isFinite(parsed) || parsed <= 0 || parsed >= 1) return
      ratio = parsed
    } else {
      const distance = Number(distanceDraft)
      if (!Number.isFinite(distance) || distance <= 0 || distance >= length) return
      ratio = distance / length
    }
    const newNodeId = Math.max(0, ...model.nodes.map((item) => item.id)) + 1
    dispatch({ type: 'splitElement', elementId: element.id, ratio })
    onSplitSelect(newNodeId)
  }

  return (
    <aside className="properties-panel">
      <PanelHeader icon={<AccountTreeIcon fontSize="small" />} eyebrow="FRAME ELEMENT" title={`E${element.id}`} onClose={onClose} onToggleCollapsed={onToggleCollapsed} />
      <div className="properties-scroll">
        <PropertySection title="Connectivity">
          <label className="property-field"><span>Start node</span><select value={element.node_i} onChange={(event) => dispatch({ type: 'updateElement', id: element.id, patch: { node_i: Number(event.target.value) } })}>{model.nodes.map((node) => <option key={node.id} value={node.id}>N{node.id}</option>)}</select></label>
          <label className="property-field"><span>End node</span><select value={element.node_j} onChange={(event) => dispatch({ type: 'updateElement', id: element.id, patch: { node_j: Number(event.target.value) } })}>{model.nodes.map((node) => <option key={node.id} value={node.id}>N{node.id}</option>)}</select></label>
          <div className="read-only-row"><span>Length</span><b>{length > 0 ? `${length.toFixed(3)} m` : '—'}</b></div>
        </PropertySection>
        <PropertySection title="Assignments">
          <label className="property-field"><span>Material</span><select value={element.material_id ?? ''} onChange={(event) => { const material = model.materials.find((item) => item.id === event.target.value); dispatch({ type: 'updateElement', id: element.id, patch: { material_id: material?.id ?? null, E: material?.E ?? null } }) }}><option value="">Unassigned</option>{model.materials.map((material) => <option key={material.id} value={material.id}>{material.name}</option>)}</select></label>
          <label className="property-field"><span>Section</span><select value={element.section_id ?? ''} onChange={(event) => { const section = model.sections.find((item) => item.id === event.target.value); dispatch({ type: 'updateElement', id: element.id, patch: { section_id: section?.id ?? null, A: section?.A ?? null, I: section?.I ?? null } }) }}><option value="">Unassigned</option>{model.sections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}</select></label>
          <div className="assignment-jump-row"><button type="button" onClick={() => onToolChange('material')}>Material library</button><button type="button" onClick={() => onToolChange('section')}>Section library</button></div>
        </PropertySection>
        <PropertySection title="Effective properties">
          <div className={`read-only-row ${properties.E === null ? 'is-missing' : ''}`}><span>Elastic modulus E</span><b>{properties.E === null ? 'Not set' : properties.E.toExponential(3)}</b></div>
          <div className={`read-only-row ${properties.A === null ? 'is-missing' : ''}`}><span>Cross-section A</span><b>{properties.A === null ? 'Not set' : properties.A.toExponential(3)}</b></div>
          <div className={`read-only-row ${properties.I === null ? 'is-missing' : ''}`}><span>Moment of inertia I</span><b>{properties.I === null ? 'Not set' : properties.I.toExponential(3)}</b></div>
        </PropertySection>
        <DeleteButton label="Delete element" onClick={onDeleted} />
        <PropertySection title="Insert node & split">
          <div className="split-mode-row">
            <button type="button" className={splitMode === 'ratio' ? 'is-active' : ''} onClick={() => setSplitMode('ratio')}>By fraction</button>
            <button type="button" className={splitMode === 'distance' ? 'is-active' : ''} onClick={() => setSplitMode('distance')}>By distance</button>
          </div>
          {splitMode === 'ratio' ? (
            <>
              <NumberField label="Fraction from start" value={Number(ratioDraft) || 0.5} onChange={(value) => setRatioDraft(String(value))} min={0.001} />
              <div className="split-presets">
                {[0.25, 0.5, 0.75].map((value) => (
                  <button key={value} type="button" onClick={() => setRatioDraft(String(value))}>{value === 0.5 ? '1/2' : value === 0.25 ? '1/4' : '3/4'}</button>
                ))}
              </div>
            </>
          ) : (
            <NumberField label={`Distance from N${element.node_i}`} value={Number(distanceDraft) || 0} unit="m" onChange={(value) => setDistanceDraft(String(value))} min={0.001} />
          )}
          <button className="split-element-button" type="button" onClick={splitElement} disabled={length <= 0}>
            Place node & split element
          </button>
          <div className="properties-tip"><InfoOutlinedIcon fontSize="small" /><span>Creates a node on the member and replaces it with two elements that keep the same material and section.</span></div>
        </PropertySection>
      </div>
    </aside>
  )
}

export function PropertiesPanel({
  model,
  activeTool,
  selection,
  elementDefaults,
  supportDefaults,
  nodalLoadDefaults,
  modelHistory,
  exampleModels,
  isCollapsed,
  assignmentOverlay,
  dispatch,
  onToolChange,
  onElementDefaultsChange,
  onSupportDefaultsChange,
  onNodalLoadDefaultsChange,
  onRestoreModel,
  onDeleteHistory,
  onDeleteAllHistory,
  onDeleteExample,
  onDeleteAllExamples,
  onCreateExample,
  onLoadExample,
  onSelectionChange,
  onToggleAssignmentOverlay,
  onToggleCollapsed,
}: PropertiesPanelProps) {
  const close = () => onSelectionChange(null)
  const deleteEntity = (entity: NonNullable<Selection>['type'], id: number) => {
    dispatch({ type: 'delete', entity, id })
    close()
  }

  if (isCollapsed) {
    return (
      <aside className="properties-panel properties-panel--collapsed">
        <button className="properties-collapse-trigger" type="button" onClick={onToggleCollapsed} aria-label="Open Properties">
          <KeyboardDoubleArrowRightIcon fontSize="small" />
          <span>Properties</span>
        </button>
      </aside>
    )
  }

  if (activeTool === 'material') {
    return (
      <MaterialLibraryPanel
        model={model}
        dispatch={dispatch}
        elementDefaults={elementDefaults}
        assignmentOverlay={assignmentOverlay}
        onElementDefaultsChange={onElementDefaultsChange}
        onToggleAssignmentOverlay={onToggleAssignmentOverlay}
        onToggleCollapsed={onToggleCollapsed}
      />
    )
  }
  if (activeTool === 'section') {
    return (
      <SectionLibraryPanel
        model={model}
        dispatch={dispatch}
        elementDefaults={elementDefaults}
        assignmentOverlay={assignmentOverlay}
        onElementDefaultsChange={onElementDefaultsChange}
        onToggleAssignmentOverlay={onToggleAssignmentOverlay}
        onToggleCollapsed={onToggleCollapsed}
      />
    )
  }
  if (activeTool === 'models') {
    return <ModelsPanel history={modelHistory} examples={exampleModels} onRestore={onRestoreModel} onLoadExample={onLoadExample} onDeleteHistory={onDeleteHistory} onDeleteAllHistory={onDeleteAllHistory} onDeleteExample={onDeleteExample} onDeleteAllExamples={onDeleteAllExamples} onCreateExample={onCreateExample} onToggleCollapsed={onToggleCollapsed} />
  }
  if (!selection && activeTool !== 'select') {
    return (
      <ToolSetupPanel
        tool={activeTool}
        model={model}
        elementDefaults={elementDefaults}
        supportDefaults={supportDefaults}
        nodalLoadDefaults={nodalLoadDefaults}
        dispatch={dispatch}
        onElementDefaultsChange={onElementDefaultsChange}
        onSupportDefaultsChange={onSupportDefaultsChange}
        onNodalLoadDefaultsChange={onNodalLoadDefaultsChange}
        onToolChange={onToolChange}
        onToggleCollapsed={onToggleCollapsed}
        onSelectionChange={onSelectionChange}
      />
    )
  }

  if (!selection) {
    return (
      <aside className="properties-panel">
        <PanelHeader icon={<TuneIcon fontSize="small" />} eyebrow="WORKSPACE" title="Properties" onToggleCollapsed={onToggleCollapsed} />
        <div className="properties-scroll">
          <div className="model-overview-card">
            <div className="overview-orbit"><DataObjectIcon /></div>
            <strong>{model.name}</strong>
            <span>SI units · Linear static</span>
            <div className="overview-stats">
              <div><b>{model.nodes.length}</b><span>Nodes</span></div>
              <div><b>{model.elements.length}</b><span>Elements</span></div>
              <div><b>{model.supports.length}</b><span>Supports</span></div>
            </div>
          </div>
          <PropertySection title="Analysis settings">
            <NumberField
              label="Field samples"
              value={model.options.number_of_points}
              min={2}
              onChange={(number_of_points) => dispatch({ type: 'updateOptions', patch: { number_of_points } })}
            />
            <NumberField
              label="Deformation scale"
              value={model.options.deformation_scale}
              onChange={(deformation_scale) => dispatch({ type: 'updateOptions', patch: { deformation_scale } })}
            />
          </PropertySection>
          <div className="properties-tip"><InfoOutlinedIcon fontSize="small" /><span>Select an object on the canvas to edit its parameters. Press ? for the full guide.</span></div>
        </div>
      </aside>
    )
  }

  if (selection.type === 'node') {
    const node = model.nodes.find((item) => item.id === selection.id)
    if (!node) return null
    const connectedElements = model.elements.filter((item) => item.node_i === node.id || item.node_j === node.id)
    return (
      <aside className="properties-panel">
        <PanelHeader icon={<FiberManualRecordIcon fontSize="small" />} eyebrow="NODE" title={`N${node.id}`} onClose={close} onToggleCollapsed={onToggleCollapsed} />
        <div className="properties-scroll">
          <PropertySection title="Coordinates">
            <NumberField label="Global X" value={node.x} unit="m" onChange={(x) => dispatch({ type: 'updateNode', id: node.id, patch: { x } })} />
            <NumberField label="Global Y" value={node.y} unit="m" onChange={(y) => dispatch({ type: 'updateNode', id: node.id, patch: { y } })} />
          </PropertySection>
          <PropertySection title="Connectivity">
            <div className="read-only-row connected-elements-row"><span>Connected elements</span><b>{connectedElements.length > 0 ? connectedElements.map((item) => `E${item.id}`).join(' · ') : 'None'}</b></div>
            <div className="read-only-row"><span>Degrees of freedom</span><b>u · v · φ</b></div>
          </PropertySection>
          <DeleteButton label="Delete node" onClick={() => deleteEntity('node', node.id)} />
        </div>
      </aside>
    )
  }

  if (selection.type === 'element') {
    const element = model.elements.find((item) => item.id === selection.id)
    if (!element) return null
    return (
      <ElementPropertiesPanel
        model={model}
        elementId={element.id}
        dispatch={dispatch}
        onToolChange={onToolChange}
        onClose={close}
        onToggleCollapsed={onToggleCollapsed}
        onDeleted={() => deleteEntity('element', element.id)}
        onSplitSelect={(nodeId) => {
          onToolChange('select')
          onSelectionChange({ type: 'node', id: nodeId })
        }}
      />
    )
  }

  if (selection.type === 'support') {
    const support = model.supports.find((item) => item.node_id === selection.id)
    if (!support) return null
    const restraints = [
      { key: 'u' as const, label: "Local u'", symbol: "u'" },
      { key: 'v' as const, label: "Local v'", symbol: "v'" },
      { key: 'phi' as const, label: 'Rotation', symbol: 'φ' },
    ]
    return (
      <aside className="properties-panel">
        <PanelHeader icon={<ChangeHistoryIcon fontSize="small" />} eyebrow="SUPPORT" title={`N${support.node_id}`} onClose={close} onToggleCollapsed={onToggleCollapsed} />
        <div className="properties-scroll">
          <PropertySection title="Support type">
            <div className="support-presets">
              {SUPPORT_PRESETS.map((preset) => {
                const isActive = support.u === preset.restraints.u && support.v === preset.restraints.v && support.phi === preset.restraints.phi
                return (
                  <button
                    key={preset.label}
                    type="button"
                    aria-pressed={isActive}
                    className={isActive ? 'is-active' : ''}
                    onClick={() => dispatch({
                      type: 'updateSupport',
                      nodeId: support.node_id,
                      patch: {
                        ...preset.restraints,
                        u_value: 0,
                        v_value: 0,
                        phi_value: 0,
                      },
                    })}
                  >
                    <span className={`support-preset-symbol support-preset-symbol--${preset.symbol}`} aria-hidden="true"><i /></span>
                    <span><b>{preset.label}</b><small>{preset.detail}</small></span>
                  </button>
                )
              })}
            </div>
          </PropertySection>
          <PropertySection title="Support orientation">
            <NumberField label="Local u′ axis angle" value={support.angle} unit="deg" onChange={(angle) => dispatch({ type: 'updateSupport', nodeId: support.node_id, patch: { angle } })} />
            <div className="properties-tip"><InfoOutlinedIcon fontSize="small" /><span>Positive angle rotates the local u′ axis counter-clockwise from global +X.</span></div>
          </PropertySection>
          <PropertySection title="Restrained DOF">
            <div className="restraint-grid">
              {restraints.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={support[item.key]}
                  className={support[item.key] ? 'is-active' : ''}
                  onClick={() => {
                    const restrainedCount = restraints.filter((restraint) => support[restraint.key]).length
                    if (support[item.key] && restrainedCount === 1) return
                    const valueKey = `${item.key}_value` as 'u_value' | 'v_value' | 'phi_value'
                    dispatch({
                      type: 'updateSupport',
                      nodeId: support.node_id,
                      patch: { [item.key]: !support[item.key], ...(support[item.key] ? { [valueKey]: 0 } : {}) },
                    })
                  }}
                >
                  <b>{item.symbol}</b><span>{item.label}</span>
                </button>
              ))}
            </div>
          </PropertySection>
          <PropertySection title="Prescribed displacement">
            <NumberField label="u" value={support.u_value} unit="m" onChange={(u_value) => dispatch({ type: 'updateSupport', nodeId: support.node_id, patch: { u_value } })} />
            <NumberField label="v" value={support.v_value} unit="m" onChange={(v_value) => dispatch({ type: 'updateSupport', nodeId: support.node_id, patch: { v_value } })} />
            <NumberField label="φ" value={support.phi_value} unit="rad" onChange={(phi_value) => dispatch({ type: 'updateSupport', nodeId: support.node_id, patch: { phi_value } })} />
          </PropertySection>
          <DeleteButton label="Delete support" onClick={() => deleteEntity('support', support.node_id)} />
        </div>
      </aside>
    )
  }

  if (selection.type === 'nodalLoad') {
    const load = model.nodal_loads.find((item) => item.node_id === selection.id)
    if (!load) return null
    return (
      <aside className="properties-panel">
        <PanelHeader icon={<SouthIcon fontSize="small" />} eyebrow="NODAL LOAD" title={`N${load.node_id}`} onClose={close} onToggleCollapsed={onToggleCollapsed} />
        <div className="properties-scroll">
          <PropertySection title="Global components">
            <NumberField label="Force Fx" value={load.fx} unit="N" onChange={(fx) => dispatch({ type: 'updateNodalLoad', nodeId: load.node_id, patch: { fx } })} />
            <NumberField label="Force Fy" value={load.fy} unit="N" onChange={(fy) => dispatch({ type: 'updateNodalLoad', nodeId: load.node_id, patch: { fy } })} />
            <NumberField label="Moment Mz" value={load.mz} unit="N·m" onChange={(mz) => dispatch({ type: 'updateNodalLoad', nodeId: load.node_id, patch: { mz } })} />
          </PropertySection>
          <div className="properties-tip"><ShowChartIcon fontSize="small" /><span>Positive moment acts counter-clockwise about +Z.</span></div>
          <DeleteButton label="Delete load" onClick={() => deleteEntity('nodalLoad', load.node_id)} />
        </div>
      </aside>
    )
  }

  const load = model.distributed_loads.find((item) => item.element_id === selection.id)
  if (!load) return null
  return (
    <aside className="properties-panel">
      <PanelHeader icon={<SouthIcon fontSize="small" />} eyebrow="DISTRIBUTED LOAD" title={`E${load.element_id}`} onClose={close} onToggleCollapsed={onToggleCollapsed} />
      <div className="properties-scroll">
        <PropertySection title="Local i-end">
          <NumberField label="Axial qx,i" value={load.qx_i} unit="N/m" onChange={(qx_i) => dispatch({ type: 'updateDistributedLoad', elementId: load.element_id, patch: { qx_i } })} />
          <NumberField label="Transverse qy,i" value={load.qy_i} unit="N/m" onChange={(qy_i) => dispatch({ type: 'updateDistributedLoad', elementId: load.element_id, patch: { qy_i } })} />
        </PropertySection>
        <PropertySection title="Local j-end">
          <NumberField label="Axial qx,j" value={load.qx_j} unit="N/m" onChange={(qx_j) => dispatch({ type: 'updateDistributedLoad', elementId: load.element_id, patch: { qx_j } })} />
          <NumberField label="Transverse qy,j" value={load.qy_j} unit="N/m" onChange={(qy_j) => dispatch({ type: 'updateDistributedLoad', elementId: load.element_id, patch: { qy_j } })} />
        </PropertySection>
        <div className="properties-tip"><ShowChartIcon fontSize="small" /><span>Components follow each element’s local +x / +y axes.</span></div>
        <DeleteButton label="Delete load" onClick={() => deleteEntity('distributedLoad', load.element_id)} />
      </div>
    </aside>
  )
}
