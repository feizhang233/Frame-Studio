import { useCallback, useEffect, useRef, useState } from 'react'
import type { AuthUser } from '../api/contracts'
import {
  clearModelHistory,
  deleteModelHistoryEntry,
  FrameApiError,
  listModelHistory,
  saveModelHistoryEntry,
} from '../api/frameApi'
import { parseFrameModel, type FrameModel, type ModelHistoryEntry } from '../domain/frame'
import type { ShowMessage } from '../types/ui'

const HISTORY_LIMIT = 12

interface HistoryState {
  ownerId: string | null
  entries: ModelHistoryEntry[]
}

interface ModelHistoryOptions {
  showMessage: ShowMessage
  onSessionExpired: (message: string, promptForLogin?: boolean) => void
}

function createHistoryEntry(
  snapshot: FrameModel,
  source: ModelHistoryEntry['source'],
): ModelHistoryEntry {
  const randomId = globalThis.crypto?.randomUUID?.()
    ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  return {
    id: randomId,
    name: snapshot.name.trim() || 'Untitled frame',
    savedAt: new Date().toISOString(),
    source,
    model: structuredClone(snapshot),
  }
}

export function useModelHistory(
  currentUser: AuthUser | null,
  { showMessage, onSessionExpired }: ModelHistoryOptions,
) {
  const [state, setState] = useState<HistoryState>({ ownerId: null, entries: [] })
  const currentOwnerRef = useRef<string | null>(null)
  const ownerId = currentUser?.id ?? null
  currentOwnerRef.current = ownerId

  const entries = state.ownerId === ownerId ? state.entries : []

  const handleRequestError = useCallback((error: unknown, fallback: string, prompt = false) => {
    if (error instanceof FrameApiError && error.status === 401) {
      onSessionExpired('Your session expired. Continue as a guest or sign in again.', prompt)
      return
    }
    showMessage(fallback, 'error')
  }, [onSessionExpired, showMessage])

  useEffect(() => {
    const requestedOwner = ownerId
    if (!requestedOwner) {
      setState({ ownerId: null, entries: [] })
      return
    }

    const controller = new AbortController()
    setState({ ownerId: requestedOwner, entries: [] })

    async function loadHistory() {
      try {
        const storedEntries = await listModelHistory(controller.signal)
        if (controller.signal.aborted || currentOwnerRef.current !== requestedOwner) return
        const validEntries = storedEntries.flatMap((entry) => {
          try {
            return [{ ...entry, model: parseFrameModel(entry.model) }]
          } catch {
            return []
          }
        })
        setState({ ownerId: requestedOwner, entries: validEntries.slice(0, HISTORY_LIMIT) })
      } catch (error) {
        if (controller.signal.aborted) return
        if (currentOwnerRef.current !== requestedOwner) return
        handleRequestError(error, 'Could not read your saved models. Please try again later.')
      }
    }

    void loadHistory()
    return () => controller.abort()
  }, [handleRequestError, ownerId])

  const saveModel = useCallback(async (
    snapshot: FrameModel,
    source: ModelHistoryEntry['source'],
  ): Promise<ModelHistoryEntry | null> => {
    const requestedOwner = currentOwnerRef.current
    if (!requestedOwner) return null
    try {
      const entry = createHistoryEntry(snapshot, source)
      await saveModelHistoryEntry(entry)
      if (currentOwnerRef.current !== requestedOwner) return null
      setState((current) => ({
        ownerId: requestedOwner,
        entries: [entry, ...(current.ownerId === requestedOwner ? current.entries : [])]
          .filter((item, index, values) => values.findIndex(({ id }) => id === item.id) === index)
          .slice(0, HISTORY_LIMIT),
      }))
      return entry
    } catch (error) {
      if (currentOwnerRef.current === requestedOwner) {
        handleRequestError(
          error,
          'Could not save this model to your account. Please try again.',
          true,
        )
      }
      return null
    }
  }, [handleRequestError])

  const deleteEntry = useCallback((id: string) => {
    const requestedOwner = currentOwnerRef.current
    if (!requestedOwner) return
    const deleted = entries.find((entry) => entry.id === id)
    setState((current) => current.ownerId === requestedOwner
      ? { ...current, entries: current.entries.filter((entry) => entry.id !== id) }
      : current)
    void deleteModelHistoryEntry(id).catch((error) => {
      if (currentOwnerRef.current !== requestedOwner) return
      if (deleted) {
        setState((current) => current.ownerId === requestedOwner
          ? { ...current, entries: [deleted, ...current.entries].slice(0, HISTORY_LIMIT) }
          : current)
      }
      handleRequestError(error, 'Could not delete this history entry from the database.')
    })
  }, [entries, handleRequestError])

  const clearEntries = useCallback((source: ModelHistoryEntry['source']) => {
    const requestedOwner = currentOwnerRef.current
    if (!requestedOwner) return
    const deleted = entries.filter((entry) => entry.source === source)
    if (deleted.length === 0) return
    setState((current) => current.ownerId === requestedOwner
      ? { ...current, entries: current.entries.filter((entry) => entry.source !== source) }
      : current)
    void clearModelHistory(source).catch((error) => {
      if (currentOwnerRef.current !== requestedOwner) return
      setState((current) => {
        if (current.ownerId !== requestedOwner) return current
        const restoredIds = new Set(deleted.map((entry) => entry.id))
        return {
          ...current,
          entries: [...deleted, ...current.entries.filter((entry) => !restoredIds.has(entry.id))]
            .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
            .slice(0, HISTORY_LIMIT),
        }
      })
      handleRequestError(error, 'Could not clear these model snapshots from the database.')
    })
  }, [entries, handleRequestError])

  return { entries, saveModel, deleteEntry, clearEntries }
}
