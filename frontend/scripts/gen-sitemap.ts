/**
 * Regenerates public/sitemap.xml from the backend's TMDB list endpoints.
 *
 *   SITEMAP_API_BASE=https://api.example.com npm run sitemap
 *
 * Env:
 *   SITEMAP_API_BASE  Backend origin serving `/tmdb/...` (required; without it this is a no-op).
 *   SITEMAP_SITE_URL  Public site origin for <loc> (falls back to VITE_SITE_URL, then production).
 *
 * Zero dependencies: runs on Node 22 with `--experimental-strip-types`.
 * Any failure logs a warning and exits 0, leaving the existing sitemap untouched,
 * so it is safe as a `prebuild` step (including offline builds).
 */
import { writeFile } from 'node:fs/promises'
import { buildSitemap, entriesFromList, sitemapPaths } from '../src/lib/sitemap.ts'
import type { SitemapEntry, SitemapKind } from '../src/lib/sitemap.ts'

const DEFAULT_SITE_URL = 'https://vod.losingsanity.com'
const TIMEOUT_MS = 10_000
const OUTPUT = new URL('../public/sitemap.xml', import.meta.url)

/** Endpoint -> kind for lists whose items carry no `media_type`. */
const SOURCES: ReadonlyArray<readonly [string, SitemapKind | undefined]> = [
  ['/tmdb/trending/all/week', undefined],
  ['/tmdb/popular', 'movie'],
  ['/tmdb/tv/popular', 'tv'],
  ['/tmdb/movie/top_rated', 'movie'],
  ['/tmdb/tv/top_rated', 'tv'],
]

function warn(message: string): void {
  console.warn(`[sitemap] ${message}; leaving public/sitemap.xml untouched.`)
}

async function fetchList(apiBase: string, path: string, fallbackKind: SitemapKind | undefined): Promise<SitemapEntry[]> {
  const res = await fetch(`${apiBase}${path}`, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`${path} -> HTTP ${res.status}`)
  return entriesFromList(await res.json(), fallbackKind)
}

async function main(): Promise<void> {
  const apiBase = process.env.SITEMAP_API_BASE?.trim().replace(/\/+$/, '')
  if (!apiBase) {
    warn('SITEMAP_API_BASE is not set')
    return
  }
  const siteUrl = (process.env.SITEMAP_SITE_URL || process.env.VITE_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '')

  let entries: SitemapEntry[]
  try {
    const lists = await Promise.all(SOURCES.map(([path, kind]) => fetchList(apiBase, path, kind)))
    entries = lists.flat()
  } catch (err) {
    warn(`fetch from ${apiBase} failed (${err instanceof Error ? err.message : String(err)})`)
    return
  }
  if (entries.length === 0) {
    warn('the API returned no movie/tv entries')
    return
  }

  const urls = sitemapPaths(entries).map((path) => `${siteUrl}${path}`)
  await writeFile(OUTPUT, buildSitemap(urls, new Date()), 'utf8')
  console.log(`[sitemap] wrote ${urls.length} URLs to public/sitemap.xml`)
}

main().catch((err: unknown) => {
  warn(`unexpected error (${err instanceof Error ? err.message : String(err)})`)
})
