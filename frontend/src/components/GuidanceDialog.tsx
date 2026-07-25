import CloseIcon from '@mui/icons-material/Close'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import IconButton from '@mui/material/IconButton'
import Step from '@mui/material/Step'
import StepContent from '@mui/material/StepContent'
import StepLabel from '@mui/material/StepLabel'
import Stepper from '@mui/material/Stepper'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { WORKFLOW_STEPS, type WorkflowStep } from '../guidance/workflow'
import type { ToolMode } from '../domain/frame'

interface GuidanceDialogProps {
  open: boolean
  onClose: (dontShowAgain: boolean) => void
  onJumpToTool: (tool: ToolMode) => void
}

export function GuidanceDialog({ open, onClose, onJumpToTool }: GuidanceDialogProps) {
  const [activeStep, setActiveStep] = useState(0)

  const handleNext = () => {
    if (activeStep >= WORKFLOW_STEPS.length - 1) {
      onClose(false)
      return
    }
    setActiveStep((step) => step + 1)
  }

  const handleBack = () => setActiveStep((step) => Math.max(0, step - 1))

  const handleTry = (step: WorkflowStep) => {
    onJumpToTool(step.tool)
    onClose(false)
  }

  return (
    <Dialog
      open={open}
      onClose={() => onClose(false)}
      maxWidth="sm"
      fullWidth
      aria-labelledby="guidance-dialog-title"
      aria-describedby="guidance-dialog-description"
    >
      <DialogTitle id="guidance-dialog-title" sx={{ pr: 6 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <HelpOutlineIcon color="primary" />
          Getting started with Frame Studio
        </Box>
        <IconButton
          aria-label="Close"
          onClick={() => onClose(false)}
          sx={{ position: 'absolute', right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Typography id="guidance-dialog-description" variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Model a 2D frame in a few guided steps, then run a linear static analysis.
          Follow the workflow on the left tool rail, or jump into any step below.
        </Typography>
        <Stepper activeStep={activeStep} orientation="vertical">
          {WORKFLOW_STEPS.map((step, index) => (
            <Step key={step.id}>
              <StepLabel
                optional={
                  step.shortcut ? (
                    <Typography variant="caption">Shortcut {step.shortcut}</Typography>
                  ) : null
                }
              >
                {step.label}
              </StepLabel>
              <StepContent>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  {step.description}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  {step.howTo}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                  <Button variant="contained" size="small" onClick={handleNext}>
                    {index === WORKFLOW_STEPS.length - 1 ? 'Finish' : 'Continue'}
                  </Button>
                  <Button size="small" disabled={index === 0} onClick={handleBack}>
                    Back
                  </Button>
                  <Button size="small" color="secondary" onClick={() => handleTry(step)}>
                    Try this step
                  </Button>
                </Box>
              </StepContent>
            </Step>
          ))}
        </Stepper>
        {activeStep >= WORKFLOW_STEPS.length && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              You are ready. Use the tool rail, Properties panel, and Run Analysis when the model is complete.
            </Typography>
            <Button size="small" onClick={() => setActiveStep(0)}>
              Review steps
            </Button>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5, justifyContent: 'space-between' }}>
        <Button color="inherit" onClick={() => onClose(true)}>
          Don&apos;t show again
        </Button>
        <Button variant="contained" onClick={() => onClose(false)}>
          Start modeling
        </Button>
      </DialogActions>
    </Dialog>
  )
}
