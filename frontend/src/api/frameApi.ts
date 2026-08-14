import type { FrameModel, ModelHistoryEntry } from '../domain/frame'
import { toSolverPayload } from '../domain/frame'
import type { AuthUser, SolveResponse } from './contracts'
import {
  FrameApiError,
  requestJson,
  requestJsonOrNull,
  requestVoid,
} from './httpClient'

export { FrameApiError }

export async function solveFrame(
  model: FrameModel,
  signal?: AbortSignal,
): Promise<SolveResponse> {
  return requestJson<SolveResponse>('/api/v1/solve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toSolverPayload(model)),
    signal,
  }, 120_000)
}

export async function listModelHistory(signal?: AbortSignal): Promise<ModelHistoryEntry[]> {
  return requestJson<ModelHistoryEntry[]>('/api/v1/models', { signal })
}

export async function saveModelHistoryEntry(
  entry: ModelHistoryEntry,
  signal?: AbortSignal,
): Promise<ModelHistoryEntry> {
  return requestJson<ModelHistoryEntry>('/api/v1/models', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
    signal,
  })
}

export async function deleteModelHistoryEntry(id: string): Promise<void> {
  return requestVoid(
    `/api/v1/models/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    [404],
  )
}

export async function clearModelHistory(source?: ModelHistoryEntry['source']): Promise<void> {
  const query = source ? `?source=${encodeURIComponent(source)}` : ''
  return requestVoid(`/api/v1/models${query}`, {
    method: 'DELETE',
  })
}

export async function getCurrentUser(signal?: AbortSignal): Promise<AuthUser | null> {
  return requestJsonOrNull<AuthUser>('/api/v1/auth/me', 401, { signal })
}

export async function registerAccount(payload: {
  email: string
  displayName: string
  password: string
}, signal?: AbortSignal): Promise<AuthUser> {
  return requestJson<AuthUser>('/api/v1/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })
}

export async function loginAccount(payload: {
  email: string
  password: string
}, signal?: AbortSignal): Promise<AuthUser> {
  return requestJson<AuthUser>('/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  })
}

export async function logoutAccount(): Promise<void> {
  return requestVoid('/api/v1/auth/logout', {
    method: 'POST',
  })
}
