/**
 * Pure sitemap helpers shared by scripts/gen-sitemap.ts and the tests.
 * Keep this file free of imports and non-erasable TS syntax so Node can run it
 * directly with `--experimental-strip-types`.
 */

export type SitemapKind = 'movie' | 'tv'

export interface SitemapEntry {
  kind: SitemapKind
  id: number
}

interface ListItem {
  id?: unknown
  media_type?: unknown
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** `YYYY-MM-DD` in UTC. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * Movie/TV entries from a TMDB list response. `fallbackKind` is used for
 * single-kind lists (popular, top_rated) whose items carry no `media_type`;
 * people and anything else with an unknown `media_type` are skipped.
 */
export function entriesFromList(body: unknown, fallbackKind?: SitemapKind): SitemapEntry[] {
  const results = (body as { results?: unknown } | null)?.results
  if (!Array.isArray(results)) return []
  const out: SitemapEntry[] = []
  for (const item of results as ListItem[]) {
    const kind = item.media_type ?? fallbackKind
    if (kind !== 'movie' && kind !== 'tv') continue
    if (typeof item.id !== 'number' || !Number.isSafeInteger(item.id) || item.id <= 0) continue
    out.push({ kind, id: item.id })
  }
  return out
}

/** Site-relative paths (`/`, then `/movie/{id}` / `/tv/{id}`), deduplicated, in first-seen order. */
export function sitemapPaths(entries: readonly SitemapEntry[]): string[] {
  const paths = new Set<string>(['/'])
  for (const { kind, id } of entries) paths.add(`/${kind}/${id}`)
  return [...paths]
}

/** Render a sitemap for absolute `urls` (deduplicated), each with `lastmod` set to `date`. */
export function buildSitemap(urls: readonly string[], date: Date): string {
  const lastmod = isoDate(date)
  const unique = [...new Set(urls)]
  const body = unique
    .map((url) => {
      const isHome = new URL(url).pathname === '/'
      return [
        '  <url>',
        `    <loc>${escapeXml(url)}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <changefreq>${isHome ? 'daily' : 'weekly'}</changefreq>`,
        `    <priority>${isHome ? '1.0' : '0.8'}</priority>`,
        '  </url>',
      ].join('\n')
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}
