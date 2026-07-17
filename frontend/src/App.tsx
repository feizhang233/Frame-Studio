import { CheckCircle2, CircleAlert, X } from 'lucide-react'
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
import { ModelCanvas } from './components/ModelCanvas'
import { PropertiesPanel } from './components/PropertiesPanel'
import { ResultsPanel, type ResultTab } from './components/ResultsPanel'
import { ToolRail } from './components/ToolRail'
import { TopToolbar } from './components/TopToolbar'
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
import { modelReducer, type ModelAction } from './state/modelReducer'

type AnalysisState = 'idle' | 'running' | 'success' | 'error'

interface ToastState {
  tone: 'neutral' | 'success' | 'error'
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
        typeof candidate.id !== 'string' ||
        typeof candidate.name !== 'string' ||
        typeof candidate.savedAt !== 'string' ||
        (candidate.source !== 'saved' && candidate.source !== 'analyzed')
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
        typeof candidate.id !== 'string' ||
        typeof candidate.name !== 'string' ||
        typeof candidate.description !== 'string'
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

export default function App() {
  const [model, baseDispatch] = useReducer(modelReducer, undefined, cloneExample)
  const [activeTool, setActiveTool] = useState<ToolMode>('select')
  const [selection, setSelection] = useState<Selection>(null)
  const [result, setResult] = useState<SolveResponse | null>(null)
  const [activeResult, setActiveResult] = useState<ResultTab>('displacement')
  const [analysisState, setAnalysisState] = useState<AnalysisState>('idle')
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [resultsExpanded, setResultsExpanded] = useState(false)
  const [propertiesCollapsed, setPropertiesCollapsed] = useState(false)
  const [canvasRevision, setCanvasRevision] = useState(0)
  const [elementDefaults, setElementDefaults] = useState<ElementDefaults>({ materialId: null, sectionId: null })
  const [supportDefaults, setSupportDefaults] = useState<SupportDefaults>({ u: true, v: true, phi: true, angle: 0 })
  const [nodalLoadDefaults, setNodalLoadDefaults] = useState<NodalLoadDefaults>({ fx: 0, fy: -1000, mz: 0 })
  const [modelHistory, setModelHistory] = useState<ModelHistoryEntry[]>(loadModelHistory)
  const [exampleModels, setExampleModels] = useState<ExampleModelDefinition[]>(loadExampleModels)
  const [isDirty, setIsDirty] = useState(false)
  const [toast, setToast] = useState<ToastState | null>(null)
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
    }
  }, [])

  const showMessage = useCallback((message: string, tone: ToastState['tone'] = 'neutral') => {
    setToast({ message, tone })
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
      showMessage('数据库暂时不可用；快照已保存在本机，恢复连接后会自动重试。', 'error')
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

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  const handleNew = useCallback(() => {
    if (isDirty && !window.confirm('目前模型有尚未儲存的變更，仍要建立新模型嗎？')) return
    analysisAbortRef.current?.abort()
    baseDispatch({ type: 'replace', model: createBlankModel() })
    setSelection(null)
    setResult(null)
    setAnalysisError(null)
    setAnalysisState('idle')
    setActiveTool('node')
    setElementDefaults({ materialId: null, sectionId: null })
    setCanvasRevision((revision) => revision + 1)
    setIsDirty(false)
    showMessage('已建立空白模型')
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
      setCanvasRevision((revision) => revision + 1)
      setIsDirty(false)
      showMessage(`已開啟 ${file.name}`, 'success')
    } catch (error) {
      showMessage(error instanceof Error ? error.message : '無法讀取此模型檔案。', 'error')
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
    showMessage('模型已儲存', 'success')
  }, [guideToMissingAssignment, model, rememberModel, showMessage])

  const handleRun = useCallback(async () => {
    if (model.nodes.length === 0 || model.elements.length === 0) {
      setAnalysisError('至少需要一個節點與一個構件才能執行分析。')
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
    try {
      const response = await solveFrame(model, controller.signal)
      if (controller.signal.aborted) return
      setResult(response)
      setAnalysisState('success')
      setActiveResult('displacement')
      void rememberModel(model, 'analyzed')
      showMessage('分析完成，結果已更新', 'success')
    } catch (error) {
      // Ignore aborts from a superseded run; only the latest controller owns UI state.
      if (error instanceof DOMException && error.name === 'AbortError') {
        if (analysisAbortRef.current === controller) {
          setAnalysisState('idle')
        }
        return
      }
      if (analysisAbortRef.current !== controller) return
      const message = error instanceof FrameApiError || error instanceof Error
        ? error.message
        : '分析失敗，請檢查模型。'
      setAnalysisError(message)
      setAnalysisState('error')
      showMessage(message, 'error')
    }
  }, [guideToMissingAssignment, model, rememberModel, showMessage])

  const handleToolChange = useCallback((tool: ToolMode) => {
    setActiveTool(tool)
    setSelection(null)
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
      setCanvasRevision((revision) => revision + 1)
      setIsDirty(false)
      showMessage(`Restored ${entry.name}`, 'success')
    } catch {
      showMessage('This snapshot is no longer valid and was not restored.', 'error')
    }
  }, [showMessage])

  const handleLoadExample = useCallback((example: ExampleModelDefinition) => {
    if (isDirty && !window.confirm('目前模型有尚未儲存的變更，仍要載入範例嗎？')) return
    baseDispatch({ type: 'replace', model: structuredClone(example.model) })
    setSelection(null)
    setResult(null)
    setAnalysisError(null)
    setAnalysisState('idle')
    setActiveTool('select')
    setElementDefaults({ materialId: null, sectionId: null })
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
      showMessage('无法从数据库删除此历史模型。', 'error')
    })
  }, [modelHistory, showMessage])

  const handleDeleteAllHistory = useCallback(() => {
    if (modelHistory.length === 0) return
    if (!window.confirm(`Delete all ${modelHistory.length} recent models?`)) return
    const deleted = modelHistory
    setModelHistory([])
    void clearModelHistory().catch(() => {
      setModelHistory(deleted)
      showMessage('无法从数据库批量删除历史模型。', 'error')
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
        showMessage('无法读取模型数据库，暂时显示浏览器中的历史记录。', 'error')
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
      const toolShortcuts: Record<string, ToolMode> = {
        v: 'select', n: 'node', m: 'material', c: 'section', e: 'element', s: 'support', l: 'load', h: 'models',
      }
      const tool = toolShortcuts[event.key.toLowerCase()]
      if (tool) handleToolChange(tool)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleSave, handleToolChange])

  useEffect(() => () => {
    analysisAbortRef.current?.abort()
    historyAbortRef.current?.abort()
  }, [])

  return (
    <div className="app-shell">
      <TopToolbar
        modelName={model.name}
        isDirty={isDirty}
        analysisState={analysisState}
        fileInputRef={fileInputRef}
        onRename={(name) => dispatch({ type: 'rename', name })}
        onNew={handleNew}
        onOpen={handleOpen}
        onFileChange={handleFileChange}
        onSave={handleSave}
        onRun={handleRun}
      />
      <main className={`workspace ${resultsExpanded ? 'workspace--results-expanded' : ''} ${propertiesCollapsed ? 'workspace--properties-collapsed' : ''}`}>
        <ToolRail activeTool={activeTool} onToolChange={handleToolChange} />
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
          dispatch={dispatch}
          onSelectionChange={setSelection}
          onMessage={showMessage}
        />
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
          dispatch={dispatch}
          onToolChange={handleToolChange}
          onElementDefaultsChange={setElementDefaults}
          onSupportDefaultsChange={setSupportDefaults}
          onNodalLoadDefaultsChange={setNodalLoadDefaults}
          onRestoreModel={handleRestoreModel}
          onLoadExample={handleLoadExample}
          onDeleteHistory={handleDeleteHistory}
          onDeleteAllHistory={handleDeleteAllHistory}
          onDeleteExample={handleDeleteExample}
          onDeleteAllExamples={handleDeleteAllExamples}
          onCreateExample={handleCreateExample}
          onSelectionChange={setSelection}
          onToggleCollapsed={() => setPropertiesCollapsed((collapsed) => !collapsed)}
        />
        <ResultsPanel
          model={model}
          result={result}
          activeTab={activeResult}
          isRunning={analysisState === 'running'}
          error={analysisError}
          isExpanded={resultsExpanded}
          onTabChange={setActiveResult}
          onToggleExpanded={() => setResultsExpanded((expanded) => !expanded)}
          onRun={handleRun}
        />
      </main>
      {toast && (
        <div className={`toast toast--${toast.tone}`} role="status">
          {toast.tone === 'success' ? <CheckCircle2 size={18} /> : toast.tone === 'error' ? <CircleAlert size={18} /> : null}
          <span>{toast.message}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="關閉通知"><X size={16} /></button>
        </div>
      )}
    </div>
  )
}
