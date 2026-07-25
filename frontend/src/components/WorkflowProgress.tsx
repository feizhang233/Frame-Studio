import UnfoldLessIcon from '@mui/icons-material/UnfoldLess'
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Step from '@mui/material/Step'
import StepButton from '@mui/material/StepButton'
import Stepper from '@mui/material/Stepper'
import Typography from '@mui/material/Typography'
import {
  getActiveWorkflowIndex,
  isWorkflowStepComplete,
  WORKFLOW_STEPS,
} from '../guidance/workflow'
import type { FrameModel, ToolMode } from '../domain/frame'

interface WorkflowProgressProps {
  model: FrameModel
  isCollapsed: boolean
  onJumpToTool: (tool: ToolMode) => void
  onToggleCollapsed: () => void
}

/**
 * Compact horizontal stepper that shows modeling progress and lets users jump to a step.
 * Can collapse to a thin strip (same idea as Results).
 */
export function WorkflowProgress({
  model,
  isCollapsed,
  onJumpToTool,
  onToggleCollapsed,
}: WorkflowProgressProps) {
  const activeStep = getActiveWorkflowIndex(model)
  const activeLabel = WORKFLOW_STEPS[activeStep]?.shortLabel ?? 'Workflow'

  if (isCollapsed) {
    return (
      <Box
        sx={{
          px: 1.5,
          minHeight: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          gap: 1,
        }}
        aria-label="Modeling workflow progress"
      >
        <Typography variant="subtitle2" noWrap>
          Workflow
          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            · {activeLabel}
          </Typography>
        </Typography>
        <Button
          size="small"
          variant="outlined"
          color="inherit"
          onClick={onToggleCollapsed}
          startIcon={<UnfoldMoreIcon />}
          sx={{ flexShrink: 0 }}
        >
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            Expand
          </Box>
        </Button>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        px: { xs: 1, sm: 2 },
        py: 1,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        overflowX: 'auto',
      }}
      aria-label="Modeling workflow progress"
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          mb: { xs: 0.5, md: 0.75 },
        }}
      >
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontWeight: 600, letterSpacing: 0.06 }}
        >
          WORKFLOW
        </Typography>
        <Button
          size="small"
          variant="outlined"
          color="inherit"
          onClick={onToggleCollapsed}
          startIcon={<UnfoldLessIcon />}
          sx={{ flexShrink: 0 }}
        >
          <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>
            Hide
          </Box>
        </Button>
      </Box>
      <Stepper
        nonLinear
        activeStep={activeStep}
        alternativeLabel
        sx={{
          minWidth: 560,
          '& .MuiStepLabel-label': { typography: 'caption', mt: 0.5 },
        }}
      >
        {WORKFLOW_STEPS.map((step, index) => (
          <Step key={step.id} completed={isWorkflowStepComplete(model, index)}>
            <StepButton
              color="inherit"
              onClick={() => onJumpToTool(step.tool)}
              optional={
                index === activeStep ? (
                  <Typography variant="caption" color="primary">
                    Next
                  </Typography>
                ) : undefined
              }
            >
              {step.shortLabel}
            </StepButton>
          </Step>
        ))}
      </Stepper>
    </Box>
  )
}
