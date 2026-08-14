import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface AppErrorBoundaryProps {
  children: ReactNode
}

interface AppErrorBoundaryState {
  hasError: boolean
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Frame Studio render failure', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3, bgcolor: 'background.default' }}>
        <Paper sx={{ width: 'min(100%, 520px)', p: 4, textAlign: 'center' }}>
          <ErrorOutlineIcon color="error" sx={{ fontSize: 48, mb: 1.5 }} />
          <Typography variant="h5" gutterBottom>Frame Studio needs to restart</Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            An unexpected interface error occurred. Your server-side saved models are safe.
          </Typography>
          <Button variant="contained" onClick={() => window.location.reload()}>
            Reload application
          </Button>
        </Paper>
      </Box>
    )
  }
}
