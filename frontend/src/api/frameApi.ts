import type { FrameModel, ModelHistoryEntry } from '../domain/frame'
import { toSolverPayload } from '../domain/frame'
import type { SolveResponse } from './contracts'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')

export class FrameApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'FrameApiError'
  }
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: string | Array<{ msg?: string }> }
    if (typeof body.detail === 'string') return body.detail
    if (Array.isArray(body.detail)) return body.detail.map((item) => item.msg).filter(Boolean).join('；')
  } catch {
    // The server may return an empty or non-JSON error body.
  }
  return `分析服務回傳 HTTP ${response.status}`
}

export async function solveFrame(
  model: FrameModel,
  signal?: AbortSignal,
): Promise<SolveResponse> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api/v1/solve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toSolverPayload(model)),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new FrameApiError('無法連線分析服務，請在專案根目錄執行 npm run dev。')
  }

  if (!response.ok) {
    throw new FrameApiError(await errorMessage(response), response.status)
  }
  return response.json() as Promise<SolveResponse>
}

export async function listModelHistory(signal?: AbortSignal): Promise<ModelHistoryEntry[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/models`, { signal })
  if (!response.ok) throw new FrameApiError(await errorMessage(response), response.status)
  return response.json() as Promise<ModelHistoryEntry[]>
}

export async function saveModelHistoryEntry(
  entry: ModelHistoryEntry,
  signal?: AbortSignal,
): Promise<ModelHistoryEntry> {
  const response = await fetch(`${API_BASE_URL}/api/v1/models`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(entry),
    signal,
  })
  if (!response.ok) throw new FrameApiError(await errorMessage(response), response.status)
  return response.json() as Promise<ModelHistoryEntry>
}

export async function deleteModelHistoryEntry(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/models/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (!response.ok && response.status !== 404) {
    throw new FrameApiError(await errorMessage(response), response.status)
  }
}

export async function clearModelHistory(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/v1/models`, { method: 'DELETE' })
  if (!response.ok) {
    throw new FrameApiError(await errorMessage(response), response.status)
  }
}
