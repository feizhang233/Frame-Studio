import { useCallback, useEffect, useState } from 'react'
import type { AuthUser } from '../api/contracts'
import { getCurrentUser, logoutAccount } from '../api/frameApi'
import type { AuthDialogMode } from '../components/AuthDialog'
import type { ShowMessage } from '../types/ui'

export function useIdentity(showMessage: ShowMessage) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [authDialogOpen, setAuthDialogOpen] = useState(false)
  const [authDialogMode, setAuthDialogMode] = useState<AuthDialogMode>('login')

  const openAuthDialog = useCallback((mode: AuthDialogMode = 'login') => {
    setAuthDialogMode(mode)
    setAuthDialogOpen(true)
  }, [])

  const closeAuthDialog = useCallback(() => setAuthDialogOpen(false), [])

  const handleAuthenticated = useCallback((user: AuthUser, isNewAccount: boolean) => {
    setCurrentUser(user)
    setAuthLoading(false)
    setAuthDialogOpen(false)
    showMessage(
      isNewAccount
        ? `Welcome, ${user.displayName}. Your account is ready.`
        : `Welcome back, ${user.displayName}.`,
      'success',
    )
  }, [showMessage])

  const expireSession = useCallback((message: string, promptForLogin = false) => {
    setCurrentUser(null)
    if (promptForLogin) openAuthDialog('login')
    showMessage(message, 'error')
  }, [openAuthDialog, showMessage])

  const signOut = useCallback(async (): Promise<boolean> => {
    try {
      await logoutAccount()
      setCurrentUser(null)
      showMessage('Signed out. You can keep working in guest mode.', 'success')
      return true
    } catch (error) {
      showMessage(
        error instanceof Error ? error.message : 'Could not sign out. Please try again.',
        'error',
      )
      return false
    }
  }, [showMessage])

  useEffect(() => {
    const controller = new AbortController()

    async function restoreSession() {
      try {
        const user = await getCurrentUser(controller.signal)
        if (!controller.signal.aborted) setCurrentUser(user)
      } catch (error) {
        if (controller.signal.aborted) return
        setCurrentUser(null)
        showMessage('Account service is unavailable; continuing in guest mode.', 'error')
      } finally {
        if (!controller.signal.aborted) setAuthLoading(false)
      }
    }

    void restoreSession()
    return () => controller.abort()
  }, [showMessage])

  return {
    currentUser,
    authLoading,
    authDialogOpen,
    authDialogMode,
    openAuthDialog,
    closeAuthDialog,
    handleAuthenticated,
    expireSession,
    signOut,
  }
}
