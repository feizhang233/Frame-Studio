import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Snackbar from '@mui/material/Snackbar'
import { useCallback, useEffect, useReducer, useRef, useState, type ChangeEvent } from 'react'
import type { SolveResponse } from './api/contracts'
import {
  clearModelHistory,
  deleteModelHistoryEntry,
  FrameApiError,
  listModelHistory,
  saveModelHistoryEntry,
  solveFrame,
} from './api/frameApi'
import { GuidanceDialog } from './components/GuidanceDialog'
import { ModelCanvas } from './components/ModelCanvas'
import { PropertiesPanel } from './components/PropertiesPanel'
import type { AssignmentOverlayKind } from './components/LibraryPanels'
import { ResultsPanel, type ResultTab } from './components/ResultsPanel'
import { ToolGuidanceAlert } from './components/ToolGuidanceAlert'
import { ToolRail } from './components/ToolRail'
import { TopToolbar } from './components/TopToolbar'
import { WorkflowProgress } from './components/WorkflowProgress'
import {
  commonExampleModels,
  createBlankModel,
  exampleModel,
  type ExampleModelDefinition,
} from './data/exampleModel'
import {
  findFirstAssignmentIssue,
  parseFrameModel,
  toSolverPayload,
  type ElementDefaults,
  type FrameModel,
  type ModelHistoryEntry,
  type NodalLoadDefaults,
  type Selection,
  type SupportDefaults,
  type ToolMode,
} from './domain/frame'
import {
  GUIDANCE_VISIBLE_KEY,
  ONBOARDING_KEY,
} from './guidance/workflow'
import { modelReducer, type ModelAction } from './state/modelReducer'

type AnalysisState = 'idle' | 'running' | 'success' | 'error'

interface ToastState {
  severity: 'info' | 'success' | 'error'
  message: string
}

const cloneExample = () => structuredClone(exampleModel)
const HISTORY_KEY = 'frame-studio:model-history:v1'
const EXAMPLES_KEY = 'frame-studio:example-models:v1'

function loadModelHistory(): ModelHistoryEntry[] {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as unknown
    if (!Array.isArray(value)) return []
    return value.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const candidate = item as Partial<ModelHistoryEntry>
      if (
        typeof candidate.id !== 'string'
        || typeof candidate.name !== 'string'
        || typeof candidate.savedAt !== 'string'
        || (candidate.source !== 'saved' && candidate.source !== 'analyzed')
      ) return []
      try {
        return [{ ...candidate, model: parseFrameModel(candidate.model) } as ModelHistoryEntry]
      } catch {
        return []
      }
    }).slice(0, 12)
  } catch {
    return []
  }
}

function loadExampleModels(): ExampleModelDefinition[] {
  const stored = localStorage.getItem(EXAMPLES_KEY)
  if (stored === null) return structuredClone(commonExampleModels)
  try {
    const value = JSON.parse(stored) as unknown
    if (!Array.isArray(value)) return structuredClone(commonExampleModels)
    return value.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const candidate = item as Partial<ExampleModelDefinition>
      if (
        typeof candidate.id !== 'string'
        || typeof candidate.name !== 'string'
        || typeof candidate.description !== 'string'
      ) return []
      try {
        return [{ ...candidate, model: parseFrameModel(candidate.model) } as ExampleModelDefinition]
      } catch {
        return []
      }
    })
  } catch {
    return structuredClone(commonExampleModels)
  }
}

function loadGuidanceVisible(): boolean {
  const stored = localStorage.getItem(GUIDANCE_VISIBLE_KEY)
  if (stored === null) return true
  return stored !== '0'
}

export default function App() {
  const [model, baseDispatch] = useReducer(modelReducer, undefined, cloneExample)
  const [activeTool, setActiveTool] = useState<ToolMode>('select')
  const [selection, setSelection] = useState<Selection>(null)
  const [result, setResult] = useState<SolveResponse | null>(null)
  const [activeResult, setActiveResult] = useState<ResultTab>('displacement')
  const [analysisState, setAnalysisState] = useState<AnalysisState>('idle')
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [resultsExpanded, setResultsExpanded] = useState(false)
  const [resultsOpen, setResultsOpen] = useState(false)
  const [propertiesCollapsed, setPropertiesCollapsed] = useState(false)
  const [assignmentOverlay, setAssignmentOverlay] = useState<AssignmentOverlayKind | null>(null)
  const [canvasRevision, setCanvasRevision] = useState(0)
  const [elementDefaults, setElementDefaults] = useState<ElementDefaults>({ materialId: null, sectionId: null })
  const [supportDefaults, setSupportDefaults] = useState<SupportDefaults>({ u: true, v: true, phi: true, angle: 0 })
  const [nodalLoadDefaults, setNodalLoadDefaults] = useState<NodalLoadDefaults>({ fx: 0, fy: -1000, mz: 0 })
  const [modelHistory, setModelHistory] = useState<ModelHistoryEntry[]>(loadModelHistory)
  const [exampleModels, setExampleModels] = useState<ExampleModelDefinition[]>(loadExampleModels)
  const [isDirty, setIsDirty] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [guidanceOpen, setGuidanceOpen] = useState(() => localStorage.getItem(ONBOARDING_KEY) !== '1')
  const [guidanceVisible, setGuidanceVisible] = useState(loadGuidanceVisible)
  const [workflowCollapsed, setWorkflowCollapsed] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const analysisAbortRef = useRef<AbortController | null>(null)
  const historyAbortRef = useRef<AbortController | null>(null)

  const dispatch = useCallback((action: ModelAction) => {
    baseDispatch(action)
    setIsDirty(true)
    if (action.type !== 'rename') {
      setResult(null)
      setAnalysisState('idle')
      setAnalysisError(null)
      setResultsExpanded(false)
      setResultsOpen(false)
    }
  }, [])

  const showMessage = useCallback((message: string, severity: ToastState['severity'] = 'info') => {
    setToast({ message, severity })
  }, [])

  const rememberModel = useCallback(async (snapshot: FrameModel, source: ModelHistoryEntry['source']) => {
    const normalizedName = snapshot.name.trim() || 'Untitled frame'
    const entry: ModelHistoryEntry = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      name: normalizedName,
      savedAt: new Date().toISOString(),
      source,
      model: structuredClone(snapshot),
    }
    setModelHistory((current) => {
      return [entry, ...current.filter((item) => item.id !== entry.id)].slice(0, 12)
    })
    try {
      await saveModelHistoryEntry(entry)
    } catch {
      showMessage('Database temporarily unavailable; snapshot saved locally and will sync later.', 'error')
    }
  }, [showMessage])

  const guideToMissingAssignment = useCallback((targetModel: FrameModel) => {
    const issue = findFirstAssignmentIssue(targetModel)
    if (!issue) return false
    setSelection({ type: 'element', id: issue.elementId })
    setActiveTool(issue.type)
    setAnalysisError(null)
    showMessage(
      `Element E${issue.elementId} is missing a ${issue.type}. Choose one and apply it before analysis.`,
      'error',
    )
    return true
  }, [showMessage])

  const handleNew = useCallback(() => {
    if (isDirty && !window.confirm('The current model has unsaved changes. Create a new model anyway?')) return
    analysisAbortRef.current?.abort()
    baseDispatch({ type: 'replace', model: createBlankModel() })
    setSelection(null)
    setResult(null)
    setAnalysisError(null)
    setAnalysisState('idle')
    setActiveTool('node')
    setElementDefaults({ materialId: null, sectionId: null })
    setResultsExpanded(false)
    setResultsOpen(false)
    setCanvasRevision((revision) => revision + 1)
    setIsDirty(false)
    showMessage('Blank model created')
  }, [isDirty, showMessage])

  const handleOpen = useCallback(() => fileInputRef.current?.click(), [])

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const imported = parseFrameModel(JSON.parse(await file.text()) as unknown)
      if (imported.name === 'Imported frame') {
        imported.name = file.name.replace(/\.json$/i, '')
      }
      baseDispatch({ type: 'replace', model: imported })
      setSelection(null)
      setResult(null)
      setAnalysisError(null)
      setAnalysisState('idle')
      setResultsExpanded(false)
      setResultsOpen(false)
      setCanvasRevision((revision) => revision + 1)
      setIsDirty(false)
      showMessage(`Opened ${file.name}`, 'success')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Could not read this model file.', 'error')
    }
  }, [showMessage])

  const handleSave = useCallback(() => {
    if (guideToMissingAssignment(model)) return
    const contents = JSON.stringify(toSolverPayload(model), null, 2)
    const url = URL.createObjectURL(new Blob([contents], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${model.name.trim().replace(/[^\p{L}\p{N}._-]+/gu, '-') || 'frame-model'}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setIsDirty(false)
    void rememberModel(model, 'saved')
    showMessage('Model saved', 'success')
  }, [guideToMissingAssignment, model, rememberModel, showMessage])

  const handleRun = useCallback(async () => {
    if (model.nodes.length === 0 || model.elements.length === 0) {
      setAnalysisError('At least one node and one element are required to run analysis.')
      setAnalysisState('error')
      setActiveResult('displacement')
      return
    }
    if (guideToMissingAssignment(model)) return
    analysisAbortRef.current?.abort()
    const controller = new AbortController()
    analysisAbortRef.current = controller
    setAnalysisState('running')
    setAnalysisError(null)
    setResult(null)
    setResultsOpen(true)
    try {
      const response = await solveFrame(model, controller.signal)
      if (controller.signal.aborted) return
      setResult(response)
      setAnalysisState('success')
      setActiveResult('displacement')
      setResultsOpen(true)
      void rememberModel(model, 'analyzed')
      showMessage('Analysis complete — results updated', 'success')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        if (analysisAbortRef.current === controller) {
          setAnalysisState('idle')
        }
        return
      }
      if (analysisAbortRef.current !== controller) return
      const message = error instanceof FrameApiError || error instanceof Error
        ? error.message
        : 'Analysis failed. Check the model.'
      setAnalysisError(message)
      setAnalysisState('error')
      setResultsOpen(true)
      showMessage(message, 'error')
    }
  }, [guideToMissingAssignment, model, rememberModel, showMessage])

  const handleToolChange = useCallback((tool: ToolMode) => {
    setActiveTool(tool)
    setSelection(null)
    if (tool !== 'material' && tool !== 'section') {
      setAssignmentOverlay(null)
    } else {
      setAssignmentOverlay((current) => (current && current !== tool ? null : current))
    }
  }, [])

  const handleToggleAssignmentOverlay = useCallback((kind: AssignmentOverlayKind) => {
    setAssignmentOverlay((current) => (current === kind ? null : kind))
  }, [])

  const handleRestoreModel = useCallback((entry: ModelHistoryEntry) => {
    try {
      baseDispatch({ type: 'replace', model: parseFrameModel(structuredClone(entry.model)) })
      setSelection(null)
      setResult(null)
      setAnalysisError(null)
      setAnalysisState('idle')
      setActiveTool('select')
      setElementDefaults({ materialId: null, sectionId: null })
      setResultsExpanded(false)
      setResultsOpen(false)
      setCanvasRevision((revision) => revision + 1)
      setIsDirty(false)
      showMessage(`Restored ${entry.name}`, 'success')
    } catch {
      showMessage('This snapshot is no longer valid and was not restored.', 'error')
    }
  }, [showMessage])

  const handleLoadExample = useCallback((example: ExampleModelDefinition) => {
    if (isDirty && !window.confirm('The current model has unsaved changes. Load this example anyway?')) return
    baseDispatch({ type: 'replace', model: structuredClone(example.model) })
    setSelection(null)
    setResult(null)
    setAnalysisError(null)
    setAnalysisState('idle')
    setActiveTool('select')
    setElementDefaults({ materialId: null, sectionId: null })
    setResultsExpanded(false)
    setResultsOpen(false)
    setCanvasRevision((revision) => revision + 1)
    setIsDirty(false)
    showMessage(`Loaded ${example.name}`, 'success')
  }, [isDirty, showMessage])

  const handleDeleteHistory = useCallback((id: string) => {
    const deleted = modelHistory.find((entry) => entry.id === id)
    setModelHistory((current) => current.filter((entry) => entry.id !== id))
    void deleteModelHistoryEntry(id).catch(() => {
      if (deleted) {
        setModelHistory((current) => [deleted, ...current].slice(0, 12))
      }
      showMessage('Could not delete this history entry from the database.', 'error')
    })
  }, [modelHistory, showMessage])

  const handleDeleteHistoryGroup = useCallback((source: ModelHistoryEntry['source']) => {
    const deleted = modelHistory.filter((entry) => entry.source === source)
    if (deleted.length === 0) return
    const label = source === 'saved' ? 'saved models' : 'recent analyses'
    if (!window.confirm(`Delete all ${deleted.length} ${label}?`)) return
    setModelHistory((current) => current.filter((entry) => entry.source !== source))
    void clearModelHistory(source).catch(() => {
      setModelHistory((current) => {
        const restoredIds = new Set(deleted.map((entry) => entry.id))
        return [...deleted, ...current.filter((entry) => !restoredIds.has(entry.id))]
          .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
          .slice(0, 12)
      })
      showMessage(`Could not clear ${label} from the database.`, 'error')
    })
  }, [modelHistory, showMessage])

  const handleDeleteExample = useCallback((id: string) => {
    setExampleModels((current) => current.filter((example) => example.id !== id))
  }, [])

  const handleDeleteAllExamples = useCallback(() => {
    if (exampleModels.length === 0) return
    if (!window.confirm(`Delete all ${exampleModels.length} examples?`)) return
    setExampleModels([])
  }, [exampleModels.length])

  const handleCreateExample = useCallback((entry: ModelHistoryEntry) => {
    const example: ExampleModelDefinition = {
      id: `recent-${entry.id}`,
      name: entry.name,
      description: `Created from a ${entry.source} model on ${new Date(entry.savedAt).toLocaleDateString()}.`,
      model: structuredClone(entry.model),
    }
    setExampleModels((current) => [example, ...current.filter((item) => item.id !== example.id)])
    showMessage(`${entry.name} added to Example models`, 'success')
  }, [showMessage])

  const handleCloseGuidance = useCallback((dontShowAgain: boolean) => {
    setGuidanceOpen(false)
    if (dontShowAgain) {
      localStorage.setItem(ONBOARDING_KEY, '1')
    }
  }, [])

  const handleToggleGuidance = useCallback(() => {
    setGuidanceVisible((current) => {
      const next = !current
      localStorage.setItem(GUIDANCE_VISIBLE_KEY, next ? '1' : '0')
      return next
    })
  }, [])

  const handleDismissGuidance = useCallback(() => {
    setGuidanceVisible(false)
    localStorage.setItem(GUIDANCE_VISIBLE_KEY, '0')
  }, [])

  const handleOpenGuidance = useCallback(() => {
    setGuidanceOpen(true)
    setGuidanceVisible(true)
    localStorage.setItem(GUIDANCE_VISIBLE_KEY, '1')
  }, [])

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(modelHistory))
  }, [modelHistory])

  useEffect(() => {
    localStorage.setItem(EXAMPLES_KEY, JSON.stringify(exampleModels))
  }, [exampleModels])

  useEffect(() => {
    const controller = new AbortController()
    historyAbortRef.current = controller
    const localEntries = loadModelHistory()

    async function synchronizeHistory() {
      try {
        if (localEntries.length > 0) {
          for (const entry of localEntries) {
            await saveModelHistoryEntry(entry, controller.signal)
          }
        }
        const storedEntries = await listModelHistory(controller.signal)
        const validEntries = storedEntries.flatMap((entry) => {
          try {
            return [{ ...entry, model: parseFrameModel(entry.model) }]
          } catch {
            return []
          }
        })
        setModelHistory(validEntries.slice(0, 12))
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        showMessage('Could not read the model database; showing browser history for now.', 'error')
      }
    }

    void synchronizeHistory()
    return () => controller.abort()
  }, [showMessage])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
        event.preventDefault()
        handleSave()
        return
      }
      if (event.key === '?' || (event.shiftKey && event.key === '/')) {
        event.preventDefault()
        handleOpenGuidance()
        return
      }
      const toolShortcuts: Record<string, ToolMode> = {
        v: 'select', n: 'node', m: 'material', c: 'section', e: 'element', s: 'support', l: 'load', h: 'models',
      }
      const tool = toolShortcuts[event.key.toLowerCase()]
      if (tool) handleToolChange(tool)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleOpenGuidance, handleSave, handleToolChange])

  useEffect(() => () => {
    analysisAbortRef.current?.abort()
    historyAbortRef.current?.abort()
  }, [])

  // Close assignment map when clicking anywhere except the Assignment panel controls.
  useEffect(() => {
    if (!assignmentOverlay) return
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.closest('[data-assignment-overlay-keep]')) return
      setAssignmentOverlay(null)
    }
    document.addEventListener('pointerdown', handlePointerDown, true)
    return () => document.removeEventListener('pointerdown', handlePointerDown, true)
  }, [assignmentOverlay])

  const resultsMinimized = analysisState !== 'running' && !resultsOpen && !resultsExpanded

  return (
    <Box
      className="app-shell"
      sx={{
        height: '100vh',
        minHeight: 680,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
        overflow: 'hidden',
      }}
    >
      <TopToolbar
        modelName={model.name}
        isDirty={isDirty}
        analysisState={analysisState}
        guidanceVisible={guidanceVisible}
        fileInputRef={fileInputRef}
        onRename={(name) => dispatch({ type: 'rename', name })}
        onNew={handleNew}
        onOpen={handleOpen}
        onFileChange={handleFileChange}
        onSave={handleSave}
        onRun={handleRun}
        onOpenGuidance={handleOpenGuidance}
        onToggleGuidance={handleToggleGuidance}
      />

      <WorkflowProgress
        model={model}
        isCollapsed={workflowCollapsed}
        onJumpToTool={handleToolChange}
        onToggleCollapsed={() => setWorkflowCollapsed((collapsed) => !collapsed)}
      />

      <Box
        component="main"
        className={`workspace ${resultsExpanded ? 'workspace--results-expanded' : ''} ${resultsMinimized ? 'workspace--results-minimized' : ''} ${propertiesCollapsed ? 'workspace--properties-collapsed' : ''}`}
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: {
            xs: propertiesCollapsed ? '64px minmax(0, 1fr)' : '64px minmax(0, 1fr)',
            sm: propertiesCollapsed ? '88px 56px minmax(0, 1fr)' : '88px 360px minmax(0, 1fr)',
            md: propertiesCollapsed ? '88px 56px minmax(0, 1fr)' : '88px 380px minmax(0, 1fr)',
          },
          gridTemplateRows: resultsExpanded
            ? { xs: 'minmax(240px, 1fr) auto minmax(320px, 0.9fr)', md: 'minmax(210px, 38%) minmax(400px, 62%)' }
            : resultsMinimized
              ? { xs: 'minmax(280px, 1fr) auto 44px', md: 'minmax(0, 1fr) 44px' }
              : { xs: 'minmax(280px, 1fr) auto clamp(240px, 28vh, 340px)', md: 'minmax(280px, 1fr) clamp(300px, 30vh, 360px)' },
          overflow: 'hidden',
        }}
      >
        <Box sx={{ gridColumn: 1, gridRow: { xs: '1 / -1', md: '1 / 3' }, minHeight: 0, minWidth: 0, display: 'flex', height: '100%' }}>
          <ToolRail activeTool={activeTool} onToolChange={handleToolChange} />
        </Box>

        <Box
          className="canvas-panel"
          sx={{
            gridColumn: { xs: 2, sm: 3 },
            gridRow: 1,
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.paper',
            borderLeft: { sm: 0 },
          }}
        >
          <ToolGuidanceAlert
            tool={activeTool}
            visible={guidanceVisible}
            onDismiss={handleDismissGuidance}
          />
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <ModelCanvas
              key={canvasRevision}
              model={model}
              tool={activeTool}
              selection={selection}
              result={result}
              activeResult={activeResult}
              elementDefaults={elementDefaults}
              supportDefaults={supportDefaults}
              nodalLoadDefaults={nodalLoadDefaults}
              assignmentOverlay={assignmentOverlay}
              dispatch={dispatch}
              onSelectionChange={setSelection}
              onRename={(name) => dispatch({ type: 'rename', name })}
              onMessage={(message) => showMessage(message)}
              onCloseAssignmentOverlay={() => setAssignmentOverlay(null)}
            />
          </Box>
        </Box>

        <Box
          sx={{
            gridColumn: { xs: 2, sm: 2 },
            gridRow: { xs: 2, sm: 1 },
            minWidth: 0,
            minHeight: 0,
            display: { xs: propertiesCollapsed ? 'none' : 'flex', sm: 'flex' },
            flexDirection: 'column',
            borderRight: { sm: 1 },
            borderColor: 'divider',
            bgcolor: 'grey.50',
            maxHeight: { xs: 420, sm: 'none' },
          }}
        >
          <PropertiesPanel
            model={model}
            activeTool={activeTool}
            selection={selection}
            elementDefaults={elementDefaults}
            supportDefaults={supportDefaults}
            nodalLoadDefaults={nodalLoadDefaults}
            modelHistory={modelHistory}
            exampleModels={exampleModels}
            isCollapsed={propertiesCollapsed}
            assignmentOverlay={assignmentOverlay}
            dispatch={dispatch}
            onToolChange={handleToolChange}
            onElementDefaultsChange={setElementDefaults}
            onSupportDefaultsChange={setSupportDefaults}
            onNodalLoadDefaultsChange={setNodalLoadDefaults}
            onRestoreModel={handleRestoreModel}
            onLoadExample={handleLoadExample}
            onDeleteHistory={handleDeleteHistory}
            onDeleteHistoryGroup={handleDeleteHistoryGroup}
            onDeleteExample={handleDeleteExample}
            onDeleteAllExamples={handleDeleteAllExamples}
            onCreateExample={handleCreateExample}
            onSelectionChange={setSelection}
            onToggleAssignmentOverlay={handleToggleAssignmentOverlay}
            onToggleCollapsed={() => setPropertiesCollapsed((collapsed) => !collapsed)}
          />
        </Box>

        <Box
          sx={{
            gridColumn: { xs: 2, sm: '2 / 4' },
            gridRow: { xs: 3, sm: 2 },
            minWidth: 0,
            minHeight: 0,
            borderTop: 1,
            borderColor: 'divider',
            bgcolor: 'background.paper',
          }}
        >
          <ResultsPanel
            model={model}
            result={result}
            activeTab={activeResult}
            isRunning={analysisState === 'running'}
            error={analysisError}
            isExpanded={resultsExpanded}
            isMinimized={resultsMinimized}
            onTabChange={setActiveResult}
            onViewChange={(view) => {
              setResultsOpen(view !== 'hidden')
              setResultsExpanded(view === 'expanded')
            }}
            onRun={handleRun}
          />
        </Box>
      </Box>

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={3200}
        onClose={(_, reason) => {
          if (reason === 'clickaway') return
          setToast(null)
        }}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setToast(null)}
          severity={toast?.severity ?? 'info'}
          variant="filled"
          sx={{ width: '100%' }}
        >
          {toast?.message}
        </Alert>
      </Snackbar>

      <GuidanceDialog
        open={guidanceOpen}
        onClose={handleCloseGuidance}
        onJumpToTool={handleToolChange}
      />
    </Box>
  )
}
