/**
 * Build-time prerendering for search engines (runs as `postbuild`).
 *
 *   PRERENDER_API_BASE=https://vapi.losingsanity.com npm run build
 *
 * Fetches trending / popular / top-rated titles from the backend, then writes into dist/:
 * - `movie/{id}/index.html` and `tv/{id}/index.html`: real title, description, canonical,
 *   Open Graph tags, Movie/TVSeries JSON-LD, readable content and a React Query seed
 *   (see src/lib/prerender.ts);
 * - `index.html`: the home page with crawlable links to every prerendered title;
 * - `sitemap.xml`: every prerendered URL;
 * - `app.html`: the untouched SPA shell that render.yaml rewrites other routes to (always written).
 *
 * Env:
 *   PRERENDER_API_BASE  Backend origin serving `/tmdb/...`. Without it this is a no-op, so
 *                       local and CI builds don't need the network.
 *   PRERENDER_SITE_URL  Public site origin (falls back to VITE_SITE_URL, then production).
 *   PRERENDER_PAGES     List pages per source (default 3, ~20 titles each).
 *
 * Failures never fail the build: a title that can't be fetched is skipped, and if the lists
 * can't be fetched at all, dist/ is left as Vite built it.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { buildSitemap } from '../src/lib/sitemap.ts'
import { titleJsonLd, jsonLdText, type TitleLike } from '../src/lib/schema.ts'
import { titleSeoDescription, titleSeoTitle, titleWithYear } from '../src/lib/seoText.ts'
import {
  formatMinutes,
  headTags,
  homeBody,
  injectPage,
  titleBody,
  trimDetails,
  type LinkItem,
} from '../src/lib/prerender.ts'

type Kind = 'movie' | 'tv'

const SITE_NAME = 'AnyVod'
const DEFAULT_SITE_URL = 'https://vod.losingsanity.com'
const DIST = new URL('../dist/', import.meta.url)
/** The first request may wake the API from Render's free-plan sleep (up to about a minute). */
const FIRST_TIMEOUT_MS = 90_000
const TIMEOUT_MS = 15_000
const CONCURRENCY = 4
const RELATED_LINKS = 12
const CAST_LINKS = 10

const SOURCES: ReadonlyArray<{ path: string; kind?: Kind; title: string }> = [
  { path: '/tmdb/trending/all/week', title: 'Trending this week' },
  { path: '/tmdb/movie/popular', kind: 'movie', title: 'Popular movies' },
  { path: '/tmdb/tv/popular', kind: 'tv', title: 'Popular TV shows' },
  { path: '/tmdb/movie/top_rated', kind: 'movie', title: 'Top rated movies' },
  { path: '/tmdb/tv/top_rated', kind: 'tv', title: 'Top rated TV shows' },
]

interface Entry {
  kind: Kind
  id: number
  label: string
}

interface ListItem {
  id?: unknown
  media_type?: unknown
  title?: unknown
  name?: unknown
  release_date?: unknown
  first_air_date?: unknown
}

interface Details extends TitleLike {
  [key: string]: unknown
  credits?: { cast?: { id: number; name: string; character?: string }[]; crew?: { id: number; name: string; job?: string }[] }
}

const log = (msg: string) => console.log(`[prerender] ${msg}`)
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** GET JSON, retrying on rate limits (honouring Retry-After) and transient failures. */
async function getJson(url: string, timeoutMs: number): Promise<unknown> {
  let lastError: unknown
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) })
      if (res.ok) return await res.json()
      if (res.status === 429 || res.status >= 500) {
        const wait = Number(res.headers.get('retry-after')) || 2 ** attempt
        lastError = new Error(`HTTP ${res.status}`)
        await sleep(Math.min(wait, 30) * 1000)
        continue
      }
      throw new Error(`HTTP ${res.status}`)
    } catch (err) {
      lastError = err
      if (err instanceof Error && /^HTTP 4/.test(err.message)) break
      await sleep(1000 * 2 ** attempt)
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

function entriesFrom(body: unknown, fallback?: Kind): Entry[] {
  const results = (body as { results?: unknown } | null)?.results
  if (!Array.isArray(results)) return []
  const out: Entry[] = []
  for (const item of results as ListItem[]) {
    const kind = item.media_type ?? fallback
    if (kind !== 'movie' && kind !== 'tv') continue
    if (typeof item.id !== 'number' || !Number.isSafeInteger(item.id) || item.id <= 0) continue
    const label = titleWithYear(kind, {
      title: typeof item.title === 'string' ? item.title : undefined,
      name: typeof item.name === 'string' ? item.name : undefined,
      release_date: typeof item.release_date === 'string' ? item.release_date : undefined,
      first_air_date: typeof item.first_air_date === 'string' ? item.first_air_date : undefined,
    })
    if (label) out.push({ kind, id: item.id, label })
  }
  return out
}

/** Runs `fn` over `items` with at most `limit` in flight. */
async function pool<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i] as T)
    }
  })
  await Promise.all(workers)
  return out
}

const keyOf = (e: { kind: Kind; id: number }) => `${e.kind}/${e.id}`
const hrefOf = (e: { kind: Kind; id: number }) => `/${e.kind}/${e.id}`

function renderTitle(template: string, siteUrl: string, entry: Entry, raw: Details, related: Entry[], now: number): string {
  const { kind, id } = entry
  const url = `${siteUrl}/${kind}/${id}`
  const title = `${titleSeoTitle(kind, raw)} | ${SITE_NAME}`
  const name = (kind === 'movie' ? raw.title : raw.name) || raw.title || raw.name || entry.label
  const poster = raw.poster_path ? `https://image.tmdb.org/t/p/w780${raw.poster_path}` : undefined
  const runtime = kind === 'movie' ? raw.runtime : raw.episode_run_time?.[0]
  const facts = [
    (kind === 'movie' ? raw.release_date : raw.first_air_date)?.slice(0, 4),
    kind === 'tv' && raw.number_of_seasons
      ? `${raw.number_of_seasons} ${raw.number_of_seasons === 1 ? 'season' : 'seasons'}`
      : formatMinutes(runtime),
    (raw.genres ?? [])
      .slice(0, 3)
      .map((g) => g.name)
      .join(', '),
  ].filter((f): f is string => !!f)

  const head = headTags({
    title,
    description: titleSeoDescription(kind, raw),
    url,
    image: poster,
    type: kind === 'movie' ? 'video.movie' : 'video.tv_show',
    jsonLd: jsonLdText(titleJsonLd(kind, raw, siteUrl, SITE_NAME)),
  })
  const body = titleBody({
    heading: titleWithYear(kind, raw) || name,
    facts,
    overview: raw.overview,
    watchHref: `/player/${kind}/${id}`,
    watchLabel: `Watch ${name}`,
    cast: (raw.credits?.cast ?? []).slice(0, CAST_LINKS).map((c) => ({
      href: `/person/${c.id}`,
      name: c.name,
      character: c.character || undefined,
    })),
    related: related.map((r) => ({ href: hrefOf(r), label: r.label })),
    siteName: SITE_NAME,
  })
  // Same key as queryKeys.details in src/api/hooks.ts.
  const seed = { key: ['details', kind, String(id)], data: trimDetails(raw), at: now }
  return injectPage(template, { head, body, seed })
}

async function main(): Promise<void> {
  // The untouched SPA shell, for routes that aren't prerendered (render.yaml rewrites to it).
  // Written first and unconditionally, so the rewrite target always exists.
  const template = await readFile(new URL('index.html', DIST), 'utf8')
  await writeFile(new URL('app.html', DIST), template, 'utf8')

  const apiBase = process.env.PRERENDER_API_BASE?.trim().replace(/\/+$/, '')
  if (!apiBase) {
    log('PRERENDER_API_BASE is not set; skipping (dist/ left as built).')
    return
  }
  const siteUrl = (process.env.PRERENDER_SITE_URL || process.env.VITE_SITE_URL || DEFAULT_SITE_URL).replace(/\/+$/, '')
  const pages = Math.max(1, Math.min(10, Number(process.env.PRERENDER_PAGES) || 3))

  // Wake the API first so the list requests don't all hit a cold start.
  try {
    await getJson(`${apiBase}/health`, FIRST_TIMEOUT_MS)
  } catch (err) {
    log(`API at ${apiBase} is unreachable (${err instanceof Error ? err.message : String(err)}); skipping.`)
    return
  }

  const sections: { title: string; entries: Entry[] }[] = []
  for (const source of SOURCES) {
    const entries: Entry[] = []
    for (let page = 1; page <= pages; page++) {
      try {
        entries.push(...entriesFrom(await getJson(`${apiBase}${source.path}?page=${page}`, TIMEOUT_MS), source.kind))
      } catch (err) {
        log(`${source.path} page ${page} failed (${err instanceof Error ? err.message : String(err)})`)
        break
      }
    }
    sections.push({ title: source.title, entries })
  }

  const unique = new Map<string, Entry>()
  for (const s of sections) for (const e of s.entries) if (!unique.has(keyOf(e))) unique.set(keyOf(e), e)
  const all = [...unique.values()]
  if (all.length === 0) {
    log('no titles returned; skipping.')
    return
  }
  log(`fetching ${all.length} titles from ${apiBase}`)

  const now = Date.now()
  const written = new Set<string>()
  await pool(all, CONCURRENCY, async (entry) => {
    let details: Details
    try {
      details = (await getJson(`${apiBase}/tmdb/${entry.kind}/${entry.id}`, TIMEOUT_MS)) as Details
    } catch (err) {
      log(`skipped ${keyOf(entry)} (${err instanceof Error ? err.message : String(err)})`)
      return
    }
    // Neighbours in the combined list: related enough, and every page links to others.
    const i = all.indexOf(entry)
    const related = Array.from({ length: Math.min(RELATED_LINKS, all.length - 1) }, (_, n) => all[(i + 1 + n) % all.length] as Entry)
    const dir = new URL(`${entry.kind}/${entry.id}/`, DIST)
    await mkdir(dir, { recursive: true })
    await writeFile(new URL('index.html', dir), renderTitle(template, siteUrl, entry, details, related, now), 'utf8')
    written.add(keyOf(entry))
  })

  // Home: the shell's fallback head already describes the home page; add crawlable links.
  const homeSections = sections.map((s) => ({
    title: s.title,
    items: s.entries.filter((e) => written.has(keyOf(e))).map((e): LinkItem => ({ href: hrefOf(e), label: e.label })),
  }))
  await writeFile(
    new URL('index.html', DIST),
    injectPage(template, { body: homeBody(`${SITE_NAME}: watch movies and TV shows online`, homeSections) }),
    'utf8',
  )

  const urls = [`${siteUrl}/`, ...all.filter((e) => written.has(keyOf(e))).map((e) => `${siteUrl}${hrefOf(e)}`)]
  await writeFile(new URL('sitemap.xml', DIST), buildSitemap(urls, new Date(now)), 'utf8')
  log(`wrote ${written.size} title pages, the home page and a sitemap with ${urls.length} URLs`)
}

main().catch((err: unknown) => {
  console.warn(`[prerender] unexpected error, dist/ may be partially prerendered: ${err instanceof Error ? err.message : String(err)}`)
})
