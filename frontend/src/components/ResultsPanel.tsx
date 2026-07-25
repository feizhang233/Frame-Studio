import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import TableChartIcon from '@mui/icons-material/TableChart'
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonGroup from '@mui/material/ButtonGroup'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Tabs from '@mui/material/Tabs'
import Typography from '@mui/material/Typography'
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
  isMinimized: boolean
  error: string | null
  onTabChange: (tab: ResultTab) => void
  onViewChange: (view: 'expanded' | 'default' | 'hidden') => void
  onRun: () => void
}

function ResultsViewControl({
  view,
  onChange,
}: {
  view: 'expanded' | 'default' | 'hidden'
  onChange: (view: 'expanded' | 'default' | 'hidden') => void
}) {
  const options = [
    { id: 'expanded' as const, label: 'Expand', icon: <UnfoldMoreIcon /> },
    { id: 'default' as const, label: 'Default', icon: <TableChartIcon /> },
    { id: 'hidden' as const, label: 'Hide', icon: <UnfoldLessIcon /> },
  ]
  return (
    <ButtonGroup size="small" variant="outlined" color="inherit" aria-label="Results panel size">
      {options.map((option) => (
        <Button
          key={option.id}
          onClick={() => onChange(option.id)}
          variant={view === option.id ? 'contained' : 'outlined'}
          color={view === option.id ? 'primary' : 'inherit'}
          aria-pressed={view === option.id}
          startIcon={option.icon}
          sx={{ minWidth: { xs: 36, sm: 88 }, px: { xs: 0.75, sm: 1.25 } }}
        >
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            {option.label}
          </Box>
        </Button>
      ))}
    </ButtonGroup>
  )
}

function DisplacementTable({ result }: { result: SolveResponse }) {
  return (
    <TableContainer sx={{ height: '100%' }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Node</TableCell>
            <TableCell align="right">u (m)</TableCell>
            <TableCell align="right">v (m)</TableCell>
            <TableCell align="right">φ (rad)</TableCell>
            <TableCell align="right">Resultant (m)</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {result.nodal_displacements.map((row) => (
            <TableRow key={row.node_id} hover>
              <TableCell>
                <Chip size="small" label={`N${row.node_id}`} color="primary" variant="outlined" />
              </TableCell>
              <TableCell align="right">{formatNumber(row.u, 5)}</TableCell>
              <TableCell align="right">{formatNumber(row.v, 5)}</TableCell>
              <TableCell align="right">{formatNumber(row.phi, 5)}</TableCell>
              <TableCell align="right">{formatNumber(Math.hypot(row.u, row.v), 5)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function ReactionTable({ result }: { result: SolveResponse }) {
  return (
    <TableContainer sx={{ height: '100%' }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Node</TableCell>
            <TableCell align="right">Fx (N)</TableCell>
            <TableCell align="right">Fy (N)</TableCell>
            <TableCell align="right">Mz (N·m)</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {result.nodal_reactions.map((row) => (
            <TableRow key={row.node_id} hover>
              <TableCell>
                <Chip size="small" label={`N${row.node_id}`} color="primary" variant="outlined" />
              </TableCell>
              <TableCell align="right">{formatNumber(row.fx)}</TableCell>
              <TableCell align="right">{formatNumber(row.fy)}</TableCell>
              <TableCell align="right">{formatNumber(row.mz)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )
}

function FieldSummary({ result, tab }: { result: SolveResponse; tab: FieldResultTab }) {
  const meta = fieldMeta[tab]
  const key = fieldKey[tab]
  const values = result.elements.flatMap((element) => element.fields[key])
  const scale = displayScale(values, meta.unit)

  return (
    <Box className="field-summary" sx={{ minWidth: 0, minHeight: 0, overflow: 'auto', height: '100%' }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          px: 2,
          py: 1.25,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={700}>
            ELEMENT ENVELOPE
          </Typography>
          <Typography variant="subtitle2">{meta.symbol} result values</Typography>
        </Box>
        <Chip size="small" label={`Values in ${scale.unit}`} />
      </Stack>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>Element</TableCell>
            <TableCell align="right">i-end</TableCell>
            <TableCell align="right">j-end</TableCell>
            <TableCell align="right">Min</TableCell>
            <TableCell align="right">Max</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {result.elements.map((element) => {
            const field = element.fields[key]
            return (
              <TableRow key={element.element_id} hover>
                <TableCell>
                  <Chip size="small" label={`E${element.element_id}`} color="primary" variant="outlined" />
                </TableCell>
                <TableCell align="right">{formatNumber(field[0] / scale.divisor)}</TableCell>
                <TableCell align="right">{formatNumber(field[field.length - 1] / scale.divisor)}</TableCell>
                <TableCell align="right">{formatNumber(Math.min(...field) / scale.divisor)}</TableCell>
                <TableCell align="right">{formatNumber(Math.max(...field) / scale.divisor)}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </Box>
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
    <Box
      className={`field-results${showDiagram ? ' field-results--with-diagram' : ''}`}
      sx={{
        height: '100%',
        minHeight: 190,
        display: 'grid',
        gridTemplateColumns: showDiagram ? { xs: '1fr', md: 'minmax(520px, 1.25fr) minmax(320px, 1fr)' } : '1fr',
      }}
    >
      {showDiagram && <ResultDiagram result={result} tab={activeTab} model={model} />}
      <FieldSummary result={result} tab={activeTab} />
    </Box>
  )
}

export function ResultsPanel({
  model,
  result,
  activeTab,
  isRunning,
  isExpanded,
  isMinimized,
  error,
  onTabChange,
  onViewChange,
  onRun,
}: ResultsPanelProps) {
  const showDiagram = isExpanded && isFieldResultTab(activeTab)
  const tabIndex = Math.max(0, resultTabs.findIndex((tab) => tab.id === activeTab))
  const view = isMinimized ? 'hidden' : isExpanded ? 'expanded' : 'default'

  if (isMinimized) {
    return (
      <Box
        component="section"
        aria-label="Analysis results"
        sx={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1.5,
          bgcolor: 'grey.50',
          borderTop: 0,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flexShrink: 0 }}>
          <TableChartIcon color="primary" fontSize="small" />
          <Typography variant="subtitle2">Results</Typography>
        </Stack>
        <ResultsViewControl view={view} onChange={onViewChange} />
      </Box>
    )
  }

  return (
    <Box
      component="section"
      aria-label="Analysis results"
      sx={{ height: '100%', display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr)' }}
    >
      <Stack
        direction="row"
        alignItems="center"
        spacing={1}
        sx={{
          px: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'grey.50',
          minHeight: 52,
          gap: 1,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={0.75} sx={{ flexShrink: 0 }}>
          <TableChartIcon color="primary" fontSize="small" />
          <Typography variant="subtitle2">Results</Typography>
        </Stack>

        <Tabs
          value={tabIndex}
          onChange={(_, index: number) => onTabChange(resultTabs[index].id)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ flex: 1, minHeight: 48, '& .MuiTab-root': { minHeight: 48, minWidth: 64 } }}
        >
          {resultTabs.map((tab) => (
            <Tab
              key={tab.id}
              label={
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Typography component="span" sx={{ fontFamily: 'Georgia, serif', fontWeight: 700 }}>
                    {tab.symbol}
                  </Typography>
                  <Typography component="span" variant="caption" sx={{ display: { xs: 'none', sm: 'inline' } }}>
                    {tab.label}
                  </Typography>
                </Stack>
              }
            />
          ))}
        </Tabs>

        {result && (
          <Chip
            size="small"
            icon={result.validation.passed ? <CheckCircleIcon /> : <ErrorOutlineIcon />}
            label={result.validation.passed ? 'Checks passed' : 'Check model'}
            color={result.validation.passed ? 'success' : 'warning'}
            variant="outlined"
            sx={{ display: { xs: 'none', md: 'inline-flex' } }}
          />
        )}

        <ResultsViewControl view={view} onChange={onViewChange} />
      </Stack>

      {isRunning && <LinearProgress />}

      <Box sx={{ minHeight: 0, overflow: 'auto' }}>
        {isRunning && (
          <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ height: '100%', p: 3 }}>
            <Typography variant="subtitle2">Solving linear static system…</Typography>
            <Typography variant="body2" color="text.secondary">
              Assembling stiffness, applying BCs, recovering N/V/M fields.
            </Typography>
          </Stack>
        )}

        {!isRunning && error && (
          <Alert
            severity="error"
            sx={{ m: 2 }}
            action={
              <Button color="inherit" size="small" startIcon={<PlayArrowIcon />} onClick={onRun}>
                Retry
              </Button>
            }
          >
            <Typography variant="subtitle2">Analysis failed</Typography>
            {error}
          </Alert>
        )}

        {!isRunning && !error && !result && (
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems="center"
            justifyContent="center"
            spacing={2}
            sx={{ height: '100%', p: 3 }}
          >
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2,
                display: 'grid',
                placeItems: 'center',
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
              }}
            >
              <TableChartIcon />
            </Box>
            <Box>
              <Typography variant="subtitle2">No results yet</Typography>
              <Typography variant="body2" color="text.secondary">
                Complete the workflow (nodes → members → supports → loads), assign material & section, then run.
              </Typography>
            </Box>
            <Button variant="contained" startIcon={<PlayArrowIcon />} onClick={onRun}>
              Run Analysis
            </Button>
          </Stack>
        )}

        {!isRunning && !error && result && (
          <ResultContent model={model} result={result} activeTab={activeTab} showDiagram={showDiagram} />
        )}
      </Box>
    </Box>
  )
}
