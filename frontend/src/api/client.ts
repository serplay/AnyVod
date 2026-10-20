/**
 * Single place that knows where the API lives and how to talk to it.
 *
 * - `VITE_API_BASE` wins when set.
 * - In dev without it, fall back to the local backend.
 * - In a production build without it, use same-origin relative URLs.
 */
export const API_BASE: string = (
  import.meta.env.VITE_API_BASE ?? (import.meta.env.DEV ? 'http://localhost:8000' : '')
).replace(/\/+$/, '')

export type QueryValue = string | number | boolean | readonly number[] | null | undefined
export type QueryParams = Record<string, QueryValue>

export class ApiError extends Error {
  readonly status: number
  readonly detail: string

  constructor(status: number, detail: string) {
    super(`API error ${status}: ${detail}`)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

export function buildUrl(path: string, params?: QueryParams): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`
  const search = new URLSearchParams()
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue
      if (Array.isArray(value)) {
        if (value.length > 0) search.set(key, value.join(','))
      } else {
        search.set(key, String(value))
      }
    }
  }
  const qs = search.toString()
  return `${API_BASE}${cleanPath}${qs ? `?${qs}` : ''}`
}

function detailFrom(body: unknown, fallback: string): string {
  if (typeof body === 'object' && body !== null && 'detail' in body) {
    const { detail } = body as { detail: unknown }
    if (typeof detail === 'string') return detail
    if (detail !== undefined) return JSON.stringify(detail)
  }
  return fallback
}

/**
 * GET a JSON endpoint. Throws `ApiError` for non-2xx responses (status + the
 * backend's `{ detail }` message) and for network failures (status 0).
 * Abort errors are re-thrown untouched so React Query can recognise them.
 */
export async function apiGet<T>(path: string, params?: QueryParams, signal?: AbortSignal): Promise<T> {
  let res: Response
  try {
    res = await fetch(buildUrl(path, params), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new ApiError(0, err instanceof Error ? err.message : 'Network error')
  }

  if (!res.ok) {
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      // Non-JSON error body; fall back to statusText.
    }
    throw new ApiError(res.status, detailFrom(body, res.statusText || 'Request failed'))
  }

  return (await res.json()) as T
}
