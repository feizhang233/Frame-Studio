import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Snackbar from '@mui/material/Snackbar'
import { useCallback, useEffect, useReducer, useRef, useState, type ChangeEvent } from 'react'
import type { SolveResponse } from './api/contracts'
import { FrameApiError, solveFrame } from './api/frameApi'
import { AuthDialog } from './components/AuthDialog'
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
import { useIdentity } from './hooks/useIdentity'
import { useModelHistory } from './hooks/useModelHistory'
import { modelReducer, type ModelAction } from './state/modelReducer'
import type { MessageSeverity } from './types/ui'
import { readBrowserStorage, writeBrowserStorage } from './utils/browserStorage'
import { downloadModelFile } from './utils/modelFile'

type AnalysisState = 'idle' | 'running' | 'success' | 'error'

interface ToastState {
  severity: MessageSeverity
  message: string
}

const cloneExample = () => structuredClone(exampleModel)
const MAX_MODEL_FILE_BYTES = 10 * 1024 * 1024

function loadExampleModels(): ExampleModelDefinition[] {
  return structuredClone(commonExampleModels)
}

function loadGuidanceVisible(): boolean {
  const stored = readBrowserStorage(GUIDANCE_VISIBLE_KEY)
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
  const [exampleModels, setExampleModels] = useState<ExampleModelDefinition[]>(() => loadExampleModels())
  const [isDirty, setIsDirty] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
  const [guidanceOpen, setGuidanceOpen] = useState(() => readBrowserStorage(ONBOARDING_KEY) !== '1')
  const [guidanceVisible, setGuidanceVisible] = useState(loadGuidanceVisible)
  const [workflowCollapsed, setWorkflowCollapsed] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const analysisAbortRef = useRef<AbortController | null>(null)
  const modelRevisionRef = useRef(0)
  const fileReadTokenRef = useRef(0)

  const showMessage = useCallback((message: string, severity: ToastState['severity'] = 'info') => {
    setToast({ message, severity })
  }, [])

  const {
    currentUser,
    authLoading,
    authDialogOpen,
    authDialogMode,
    openAuthDialog,
    closeAuthDialog,
    handleAuthenticated,
    expireSession,
    signOut,
  } = useIdentity(showMessage)
  const {
    entries: modelHistory,
    saveModel,
    deleteEntry,
    clearEntries,
  } = useModelHistory(currentUser, {
    showMessage,
    onSessionExpired: expireSession,
  })

  const resetAnalysis = useCallback(() => {
    setResult(null)
    setAnalysisState('idle')
    setAnalysisError(null)
    setResultsExpanded(false)
    setResultsOpen(false)
  }, [])

  const replaceWorkspaceModel = useCallback((nextModel: FrameModel, nextTool: ToolMode = 'select') => {
    analysisAbortRef.current?.abort()
    analysisAbortRef.current = null
    fileReadTokenRef.current += 1
    modelRevisionRef.current += 1
    baseDispatch({ type: 'replace', model: nextModel })
    setSelection(null)
    setActiveTool(nextTool)
    setAssignmentOverlay(null)
    setElementDefaults({ materialId: null, sectionId: null })
    resetAnalysis()
    setActiveResult('displacement')
    setCanvasRevision((revision) => revision + 1)
    setIsDirty(false)
  }, [resetAnalysis])

  const dispatch = useCallback((action: ModelAction) => {
    modelRevisionRef.current += 1
    const invalidatesAnalysis = action.type !== 'rename' || analysisAbortRef.current !== null
    if (invalidatesAnalysis) {
      analysisAbortRef.current?.abort()
      analysisAbortRef.current = null
      resetAnalysis()
    }
    baseDispatch(action)
    setIsDirty(true)
  }, [resetAnalysis])

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
    replaceWorkspaceModel(createBlankModel(), 'node')
    showMessage('Blank model created')
  }, [isDirty, replaceWorkspaceModel, showMessage])

  const handleOpen = useCallback(() => fileInputRef.current?.click(), [])

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const fileReadToken = fileReadTokenRef.current + 1
    fileReadTokenRef.current = fileReadToken
    try {
      if (file.size > MAX_MODEL_FILE_BYTES) {
        throw new Error('This model file is too large. The maximum size is 10 MB.')
      }
      const contents = await file.text()
      if (fileReadTokenRef.current !== fileReadToken) return
      const imported = parseFrameModel(JSON.parse(contents) as unknown)
      if (imported.name === 'Imported frame') {
        imported.name = file.name.replace(/\.json$/i, '')
      }
      replaceWorkspaceModel(imported)
      showMessage(`Opened ${file.name}`, 'success')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : 'Could not read this model file.', 'error')
    }
  }, [replaceWorkspaceModel, showMessage])

  const handleSave = useCallback(() => {
    if (!currentUser) {
      openAuthDialog('login')
      showMessage('Guest mode cannot save models. Sign in or register to continue.', 'info')
      return
    }
    if (guideToMissingAssignment(model)) return
    const snapshot = structuredClone(model)
    const saveRevision = modelRevisionRef.current
    void (async () => {
      if (!await saveModel(snapshot, 'saved')) return
      if (modelRevisionRef.current !== saveRevision) {
        showMessage('Snapshot saved; the canvas changed while saving.', 'info')
        return
      }
      try {
        downloadModelFile(snapshot)
      } catch {
        showMessage('Model saved to your account, but the JSON download failed.', 'error')
        return
      }
      setIsDirty(false)
      showMessage('Model saved to your account', 'success')
    })()
  }, [currentUser, guideToMissingAssignment, model, openAuthDialog, saveModel, showMessage])

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
      if (controller.signal.aborted || analysisAbortRef.current !== controller) return
      analysisAbortRef.current = null
      setResult(response)
      setAnalysisState('success')
      setActiveResult('displacement')
      setResultsOpen(true)
      void saveModel(model, 'analyzed')
      showMessage('Analysis complete — results updated', 'success')
    } catch (error) {
      if (controller.signal.aborted) {
        if (analysisAbortRef.current === controller) {
          analysisAbortRef.current = null
          setAnalysisState('idle')
        }
        return
      }
      if (analysisAbortRef.current !== controller) return
      analysisAbortRef.current = null
      const message = error instanceof FrameApiError || error instanceof Error
        ? error.message
        : 'Analysis failed. Check the model.'
      setAnalysisError(message)
      setAnalysisState('error')
      setResultsOpen(true)
      showMessage(message, 'error')
    }
  }, [guideToMissingAssignment, model, saveModel, showMessage])

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
      replaceWorkspaceModel(parseFrameModel(structuredClone(entry.model)))
      showMessage(`Restored ${entry.name}`, 'success')
    } catch {
      showMessage('This snapshot is no longer valid and was not restored.', 'error')
    }
  }, [replaceWorkspaceModel, showMessage])

  const handleLoadExample = useCallback((example: ExampleModelDefinition) => {
    if (isDirty && !window.confirm('The current model has unsaved changes. Load this example anyway?')) return
    replaceWorkspaceModel(structuredClone(example.model))
    showMessage(`Loaded ${example.name}`, 'success')
  }, [isDirty, replaceWorkspaceModel, showMessage])

  const handleDeleteHistory = useCallback((id: string) => {
    deleteEntry(id)
  }, [deleteEntry])

  const handleDeleteHistoryGroup = useCallback((source: ModelHistoryEntry['source']) => {
    const deleted = modelHistory.filter((entry) => entry.source === source)
    if (deleted.length === 0) return
    const label = source === 'saved' ? 'saved models' : 'recent analyses'
    if (!window.confirm(`Delete all ${deleted.length} ${label}?`)) return
    clearEntries(source)
  }, [clearEntries, modelHistory])

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

  const handleLogout = useCallback(() => {
    if (isDirty && !window.confirm('Sign out and discard the unsaved changes on this canvas?')) return
    void (async () => {
      if (!await signOut()) return
      setExampleModels(loadExampleModels())
      replaceWorkspaceModel(cloneExample())
    })()
  }, [isDirty, replaceWorkspaceModel, signOut])

  const handleCloseGuidance = useCallback((dontShowAgain: boolean) => {
    setGuidanceOpen(false)
    if (dontShowAgain) {
      writeBrowserStorage(ONBOARDING_KEY, '1')
    }
  }, [])

  const handleToggleGuidance = useCallback(() => {
    setGuidanceVisible((current) => {
      const next = !current
      writeBrowserStorage(GUIDANCE_VISIBLE_KEY, next ? '1' : '0')
      return next
    })
  }, [])

  const handleDismissGuidance = useCallback(() => {
    setGuidanceVisible(false)
    writeBrowserStorage(GUIDANCE_VISIBLE_KEY, '0')
  }, [])

  const handleOpenGuidance = useCallback(() => {
    setGuidanceOpen(true)
    setGuidanceVisible(true)
    writeBrowserStorage(GUIDANCE_VISIBLE_KEY, '1')
  }, [])

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
  }, [])

  useEffect(() => {
    if (!isDirty) return
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
    }
    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [isDirty])

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
        currentUser={currentUser}
        authLoading={authLoading}
        fileInputRef={fileInputRef}
        onRename={(name) => dispatch({ type: 'rename', name })}
        onNew={handleNew}
        onOpen={handleOpen}
        onFileChange={handleFileChange}
        onSave={handleSave}
        onRun={handleRun}
        onOpenGuidance={handleOpenGuidance}
        onToggleGuidance={handleToggleGuidance}
        onOpenAuth={() => openAuthDialog('login')}
        onLogout={handleLogout}
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
            isGuest={!currentUser}
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
            onSignIn={() => openAuthDialog('login')}
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

      <AuthDialog
        open={authDialogOpen}
        initialMode={authDialogMode}
        onClose={closeAuthDialog}
        onAuthenticated={handleAuthenticated}
      />
    </Box>
  )
}
