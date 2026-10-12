import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_BASE, ApiError, apiGet, buildUrl } from './client'

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('buildUrl', () => {
  it('skips empty params and joins arrays with commas', () => {
    const url = buildUrl('/tmdb/search', { query: 'dune', page: 2, year: undefined, type: '', genres: [12, 878] })
    expect(url).toBe(`${API_BASE}/tmdb/search?query=dune&page=2&genres=12%2C878`)
  })
})

describe('apiGet', () => {
  it('returns parsed JSON and forwards the abort signal', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' }))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()

    await expect(apiGet<{ status: string }>('/health', undefined, controller.signal)).resolves.toEqual({ status: 'ok' })
    expect(fetchMock).toHaveBeenCalledWith(`${API_BASE}/health`, expect.objectContaining({ signal: controller.signal }))
  })

  it('throws ApiError with status and detail from the body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ detail: 'Invalid sort_by' }, { status: 400 })))

    const err = await apiGet('/tmdb/search', { query: 'x', sort_by: 'nope' }).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err).toMatchObject({ status: 400, detail: 'Invalid sort_by' })
  })

  it('falls back to statusText for non-JSON error bodies', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>bad gateway</html>', { status: 502, statusText: 'Bad Gateway' })),
    )
    await expect(apiGet('/tmdb/movie/1')).rejects.toMatchObject({ status: 502, detail: 'Bad Gateway' })
  })

  it('wraps network failures as status 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(apiGet('/tmdb/movie/1')).rejects.toMatchObject({ status: 0, detail: 'Failed to fetch' })
  })

  it('re-throws aborts untouched', async () => {
    const abort = new DOMException('The operation was aborted.', 'AbortError')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort))
    await expect(apiGet('/tmdb/movie/1')).rejects.toBe(abort)
  })
})
