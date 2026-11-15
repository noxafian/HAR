export class ApiClientError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
  }
}

type ApiEnvelope<T> = { success: true; data: T; message?: string } | { success: false; error?: { message?: string } | string; message?: string; errorId?: string }

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
    credentials: 'same-origin',
    cache: 'no-store',
  })
  if (response.status === 204) return undefined as T
  const payload = await response.json().catch(() => null) as ApiEnvelope<T> | null
  if (!response.ok || !payload || payload.success !== true) {
    const nestedError = payload && 'error' in payload ? payload.error : undefined
    const message = typeof nestedError === 'string' ? nestedError
      : nestedError && typeof nestedError === 'object' ? nestedError.message
      : payload && 'message' in payload ? payload.message : undefined
    throw new ApiClientError(message || `Request failed (${response.status})`, response.status)
  }
  return payload.data
}

export function jsonBody(value: unknown): string {
  return JSON.stringify(value)
}
