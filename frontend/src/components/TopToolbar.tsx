import {
  ChevronDown,
  CloudOff,
  FilePlus2,
  FolderOpen,
  Play,
  Save,
  Sparkles,
} from 'lucide-react'
import type { ChangeEvent, RefObject } from 'react'

interface TopToolbarProps {
  modelName: string
  isDirty: boolean
  analysisState: 'idle' | 'running' | 'success' | 'error'
  fileInputRef: RefObject<HTMLInputElement | null>
  onRename: (name: string) => void
  onNew: () => void
  onOpen: () => void
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onSave: () => void
  onRun: () => void
}

export function TopToolbar({
  modelName,
  isDirty,
  analysisState,
  fileInputRef,
  onRename,
  onNew,
  onOpen,
  onFileChange,
  onSave,
  onRun,
}: TopToolbarProps) {
  return (
    <header className="top-toolbar">
      <div className="brand" aria-label="Frame Studio">
        <div className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="brand-copy">
          <span className="brand-name">Frame Studio</span>
          <span className="brand-edition">2D analysis</span>
        </div>
      </div>

      <div className="file-actions" aria-label="檔案操作">
        <button className="toolbar-button" type="button" onClick={onNew}>
          <FilePlus2 size={18} />
          <span>New</span>
        </button>
        <button className="toolbar-button" type="button" onClick={onOpen}>
          <FolderOpen size={18} />
          <span>Open</span>
        </button>
        <input
          ref={fileInputRef}
          className="visually-hidden"
          type="file"
          accept="application/json,.json"
          onChange={onFileChange}
        />
        <button className="toolbar-button" type="button" onClick={onSave}>
          <Save size={18} />
          <span>Save</span>
        </button>
      </div>

      <div className="model-title-wrap">
        <Sparkles size={15} aria-hidden="true" />
        <input
          aria-label="模型名稱"
          className="model-title-input"
          value={modelName}
          onChange={(event) => onRename(event.target.value)}
          spellCheck={false}
        />
        {isDirty && <span className="dirty-dot" title="尚未儲存" />}
      </div>

      <div className="analysis-actions">
        {analysisState === 'error' && (
          <span className="service-state service-state--error">
            <CloudOff size={15} />
            Offline
          </span>
        )}
        {analysisState === 'success' && <span className="service-state">Results ready</span>}
        <button
          className="run-button"
          type="button"
          onClick={onRun}
          disabled={analysisState === 'running'}
        >
          {analysisState === 'running' ? <span className="button-spinner" /> : <Play size={18} fill="currentColor" />}
          <span>{analysisState === 'running' ? 'Running…' : 'Run Analysis'}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </div>
    </header>
  )
}
