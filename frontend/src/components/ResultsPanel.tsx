import { Activity, CheckCircle2, ChevronsDown, ChevronsUp, CircleAlert, Play, Table2 } from 'lucide-react'
import type { SolveResponse } from '../api/contracts'
import type { FrameModel } from '../domain/frame'
import { formatNumber } from '../utils/format'
import { ResultDiagram } from './ResultDiagram'
import {
  displayScale,
  fieldKey,
  fieldMeta,
  isFieldResultTab,
  resultTabs,
  type FieldResultTab,
  type ResultTab,
} from './resultFields'

export type { ResultTab } from './resultFields'

interface ResultsPanelProps {
  model: FrameModel
  result: SolveResponse | null
  activeTab: ResultTab
  isRunning: boolean
  isExpanded: boolean
  error: string | null
  onTabChange: (tab: ResultTab) => void
  onToggleExpanded: () => void
  onRun: () => void
}

function DisplacementTable({ result }: { result: SolveResponse }) {
  return (
    <div className="result-table-wrap">
      <table>
        <thead><tr><th>Node</th><th>u <small>m</small></th><th>v <small>m</small></th><th>φ <small>rad</small></th><th>Resultant <small>m</small></th></tr></thead>
        <tbody>{result.nodal_displacements.map((row) => (
          <tr key={row.node_id}>
            <td><span className="table-entity">N{row.node_id}</span></td>
            <td>{formatNumber(row.u, 5)}</td>
            <td>{formatNumber(row.v, 5)}</td>
            <td>{formatNumber(row.phi, 5)}</td>
            <td>{formatNumber(Math.hypot(row.u, row.v), 5)}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}

function ReactionTable({ result }: { result: SolveResponse }) {
  return (
    <div className="result-table-wrap">
      <table>
        <thead><tr><th>Node</th><th>Fx <small>N</small></th><th>Fy <small>N</small></th><th>Mz <small>N·m</small></th></tr></thead>
        <tbody>{result.nodal_reactions.map((row) => (
          <tr key={row.node_id}>
            <td><span className="table-entity">N{row.node_id}</span></td>
            <td>{formatNumber(row.fx)}</td>
            <td>{formatNumber(row.fy)}</td>
            <td>{formatNumber(row.mz)}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}

function FieldSummary({ result, tab }: { result: SolveResponse; tab: FieldResultTab }) {
  const meta = fieldMeta[tab]
  const key = fieldKey[tab]
  const values = result.elements.flatMap((element) => element.fields[key])
  const scale = displayScale(values, meta.unit)

  return (
    <div className="field-summary">
      <div className="field-summary-heading">
        <div><span>ELEMENT ENVELOPE</span><strong>{meta.symbol} result values</strong></div>
        <span className="summary-unit">Values in {scale.unit}</span>
      </div>
      <table>
        <thead><tr><th>Element</th><th>i-end</th><th>j-end</th><th>Min</th><th>Max</th></tr></thead>
        <tbody>{result.elements.map((element) => {
          const field = element.fields[key]
          return (
            <tr key={element.element_id}>
              <td><span className="table-entity">E{element.element_id}</span></td>
              <td>{formatNumber(field[0] / scale.divisor)}</td>
              <td>{formatNumber(field[field.length - 1] / scale.divisor)}</td>
              <td>{formatNumber(Math.min(...field) / scale.divisor)}</td>
              <td>{formatNumber(Math.max(...field) / scale.divisor)}</td>
            </tr>
          )
        })}</tbody>
      </table>
    </div>
  )
}

function ResultContent({
  model,
  result,
  activeTab,
  showDiagram,
}: {
  model: FrameModel
  result: SolveResponse
  activeTab: ResultTab
  showDiagram: boolean
}) {
  if (activeTab === 'displacement') return <DisplacementTable result={result} />
  if (activeTab === 'reaction') return <ReactionTable result={result} />

  return (
    <div className={`field-results${showDiagram ? ' field-results--with-diagram' : ''}`}>
      {showDiagram && <ResultDiagram result={result} tab={activeTab} model={model} />}
      <FieldSummary result={result} tab={activeTab} />
    </div>
  )
}

export function ResultsPanel({
  model,
  result,
  activeTab,
  isRunning,
  isExpanded,
  error,
  onTabChange,
  onToggleExpanded,
  onRun,
}: ResultsPanelProps) {
  const showDiagram = isExpanded && isFieldResultTab(activeTab)

  return (
    <section className="results-panel" aria-label="分析結果">
      <div className="results-nav">
        <div className="results-title"><Table2 size={18} /><span>Results</span></div>
        <div className="result-tabs" role="tablist">
          {resultTabs.map((tab) => (
            <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} className={activeTab === tab.id ? 'is-active' : ''} onClick={() => onTabChange(tab.id)}>
              <b>{tab.symbol}</b><span>{tab.label}</span>
            </button>
          ))}
        </div>
        {result && (
          <span className={`validation-chip ${result.validation.passed ? '' : 'validation-chip--warning'}`}>
            {result.validation.passed ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />}
            {result.validation.passed ? 'Checks passed' : 'Check model'}
          </span>
        )}
        <button
          className="collapse-results"
          type="button"
          onClick={onToggleExpanded}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? '缩小结果区域' : '放大结果区域'}
          title={isExpanded ? 'Compact results' : 'Expand results'}
        >
          <span>{isExpanded ? 'Compact' : 'Expand'}</span>
          {isExpanded ? <ChevronsDown size={19} /> : <ChevronsUp size={19} />}
        </button>
      </div>

      <div className="results-content">
        {!result && !error && (
          <div className="results-empty">
            <div className="results-empty-icon"><Activity size={22} /></div>
            <div><strong>{isRunning ? 'Solving the global system…' : 'Model ready for analysis'}</strong><span>{isRunning ? 'Assembling stiffness, loads and boundary conditions.' : 'Run the solver to inspect displacement, reaction and N / V / M fields.'}</span></div>
            {!isRunning && <button type="button" onClick={onRun}><Play size={16} fill="currentColor" /> Run now</button>}
            {isRunning && <span className="analysis-progress"><i /></span>}
          </div>
        )}

        {error && (
          <div className="results-error">
            <CircleAlert size={22} />
            <div><strong>Analysis could not be completed</strong><span>{error}</span></div>
            <button type="button" onClick={onRun}>Try again</button>
          </div>
        )}

        {result && (
          <ResultContent
            model={model}
            result={result}
            activeTab={activeTab}
            showDiagram={showDiagram}
          />
        )}
      </div>
    </section>
  )
}
