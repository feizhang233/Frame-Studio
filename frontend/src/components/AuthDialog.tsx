import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined'
import Alert from '@mui/material/Alert'
import Avatar from '@mui/material/Avatar'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import Stack from '@mui/material/Stack'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { FrameApiError, loginAccount, registerAccount } from '../api/frameApi'
import type { AuthUser } from '../api/contracts'

export type AuthDialogMode = 'login' | 'register'

interface AuthDialogProps {
  open: boolean
  initialMode: AuthDialogMode
  onClose: () => void
  onAuthenticated: (user: AuthUser, isNewAccount: boolean) => void
}

export function AuthDialog({
  open,
  initialMode,
  onClose,
  onAuthenticated,
}: AuthDialogProps) {
  const [mode, setMode] = useState<AuthDialogMode>(initialMode)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const requestRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!open) return
    setMode(initialMode)
    setError(null)
    setDisplayName('')
    setEmail('')
    setPassword('')
    setConfirmPassword('')
  }, [initialMode, open])

  useEffect(() => () => {
    requestRef.current?.abort()
    requestRef.current = null
  }, [])

  const changeMode = (nextMode: AuthDialogMode) => {
    setMode(nextMode)
    setError(null)
    setPassword('')
    setConfirmPassword('')
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return
    setError(null)
    if (mode === 'register' && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setSubmitting(true)
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    try {
      const user = mode === 'login'
        ? await loginAccount({ email, password }, controller.signal)
        : await registerAccount({ email, displayName, password }, controller.signal)
      if (controller.signal.aborted) return
      onAuthenticated(user, mode === 'register')
      setPassword('')
      setConfirmPassword('')
    } catch (requestError) {
      if (controller.signal.aborted) return
      setError(
        requestError instanceof FrameApiError || requestError instanceof Error
          ? requestError.message
          : 'Could not complete authentication. Please try again.',
      )
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null
        setSubmitting(false)
      }
    }
  }

  return (
    <Dialog open={open} onClose={submitting ? undefined : onClose} fullWidth maxWidth="xs">
      <Box component="form" onSubmit={submit}>
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
              {mode === 'login' ? <LockOutlinedIcon /> : <PersonAddAltOutlinedIcon />}
            </Avatar>
            <Box>
              <Typography variant="h6" lineHeight={1.2}>
                {mode === 'login' ? 'Welcome back' : 'Create your account'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Save models privately and access them on your next visit.
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>

        <DialogContent>
          <Tabs
            value={mode}
            onChange={(_, value: AuthDialogMode) => changeMode(value)}
            variant="fullWidth"
            sx={{ mb: 2 }}
          >
            <Tab value="login" label="Sign in" />
            <Tab value="register" label="Register" />
          </Tabs>

          <Stack spacing={2}>
            {error && <Alert severity="error">{error}</Alert>}
            {mode === 'register' && (
              <TextField
                autoFocus
                required
                label="Display name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                inputProps={{ minLength: 2, maxLength: 120 }}
                autoComplete="name"
              />
            )}
            <TextField
              autoFocus={mode === 'login'}
              required
              type="email"
              label="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              inputProps={{ maxLength: 320 }}
              autoComplete="email"
            />
            <TextField
              required
              type="password"
              label="Password"
              helperText={mode === 'register' ? 'Use at least 8 characters.' : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              inputProps={{ minLength: mode === 'register' ? 8 : 1, maxLength: 128 }}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
            {mode === 'register' && (
              <TextField
                required
                type="password"
                label="Confirm password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                inputProps={{ minLength: 8, maxLength: 128 }}
                autoComplete="new-password"
              />
            )}
            <Alert severity="info" variant="outlined" icon={false}>
              Prefer not to sign in? Close this window to keep using all modeling and analysis tools as a guest. Guest work cannot be saved.
            </Alert>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={onClose} disabled={submitting} color="inherit">
            Continue as guest
          </Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            {submitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
