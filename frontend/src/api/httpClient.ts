const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '')
const DEFAULT_TIMEOUT_MS = 30_000

export class FrameApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'FrameApiError'
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

async function responseErrorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      detail?: string | Array<{ msg?: string }>
    }
    if (typeof body.detail === 'string') return body.detail
    if (Array.isArray(body.detail)) {
      const messages = body.detail.map((item) => item.msg).filter(Boolean)
      if (messages.length > 0) return messages.join('; ')
    }
  } catch {
    // Empty and non-JSON error responses use the stable fallback below.
  }
  return `The service returned HTTP ${response.status}`
}

async function apiFetch(
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController()
  const externalSignal = init.signal ?? undefined
  let timedOut = false
  const abortFromCaller = () => controller.abort()
  if (externalSignal?.aborted) abortFromCaller()
  else externalSignal?.addEventListener('abort', abortFromCaller, { once: true })
  const timeoutId = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      credentials: 'include',
      ...init,
      signal: controller.signal,
    })
  } catch (error) {
    if (timedOut) {
      throw new FrameApiError('The request timed out. Please try again.', undefined, {
        cause: error,
      })
    }
    if (isAbortError(error) || externalSignal?.aborted) throw error
    throw new FrameApiError(
      'Unable to reach the Frame Studio service. Check the server and your connection.',
      undefined,
      { cause: error },
    )
  } finally {
    window.clearTimeout(timeoutId)
    externalSignal?.removeEventListener('abort', abortFromCaller)
  }
}

export async function requestJson<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const response = await apiFetch(path, init, timeoutMs)
  if (!response.ok) {
    throw new FrameApiError(await responseErrorMessage(response), response.status)
  }
  try {
    return await response.json() as T
  } catch (error) {
    throw new FrameApiError('The service returned an invalid JSON response.', response.status, {
      cause: error,
    })
  }
}

export async function requestJsonOrNull<T>(
  path: string,
  nullStatus: number,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T | null> {
  const response = await apiFetch(path, init, timeoutMs)
  if (response.status === nullStatus) return null
  if (!response.ok) {
    throw new FrameApiError(await responseErrorMessage(response), response.status)
  }
  try {
    return await response.json() as T
  } catch (error) {
    throw new FrameApiError('The service returned an invalid JSON response.', response.status, {
      cause: error,
    })
  }
}

export async function requestVoid(
  path: string,
  init: RequestInit = {},
  acceptedStatuses: readonly number[] = [],
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<void> {
  const response = await apiFetch(path, init, timeoutMs)
  if (!response.ok && !acceptedStatuses.includes(response.status)) {
    throw new FrameApiError(await responseErrorMessage(response), response.status)
  }
}
