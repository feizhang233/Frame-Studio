import Box from '@mui/material/Box'
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
  onJumpToTool: (tool: ToolMode) => void
}

/**
 * Compact horizontal stepper that shows modeling progress and lets users jump to a step.
 */
export function WorkflowProgress({ model, onJumpToTool }: WorkflowProgressProps) {
  const activeStep = getActiveWorkflowIndex(model)

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
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: { xs: 'none', md: 'block' }, mb: 0.5, fontWeight: 600, letterSpacing: 0.06 }}
      >
        WORKFLOW
      </Typography>
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
