/**
 * Pure HTML helpers for scripts/prerender.ts (build-time prerendering of title pages).
 * Import-free and erasable-syntax-only so Node runs it with `--experimental-strip-types`.
 *
 * Each prerendered page is the built index.html with:
 * - the page's own head tags, marked `data-seo-fallback` so src/main.tsx removes them before
 *   React renders its own (React does not dedupe against existing tags);
 * - a JSON seed (`#prerender-data`) that main.tsx loads into React Query, so the page renders
 *   at once without waiting for the API (which may be asleep on Render's free plan);
 * - plain, crawlable content inside #root, which React replaces on its first render.
 */

export interface HeadInput {
  title: string
  description: string
  url: string
  image?: string
  type: string
  jsonLd?: string
}

/** A React Query cache entry to restore on load. */
export interface Seed {
  key: readonly unknown[]
  data: unknown
  /** Epoch ms the data was fetched; older than staleTime means it refetches in the background. */
  at: number
}

export interface LinkItem {
  href: string
  label: string
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** JSON safe to embed in a `<script>` element. */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}

const ROBOTS = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'

export function headTags(h: HeadInput): string {
  const attr = escapeHtml
  const tags = [
    `<title data-seo-fallback>${escapeHtml(h.title)}</title>`,
    `<meta data-seo-fallback name="description" content="${attr(h.description)}" />`,
    `<meta data-seo-fallback name="robots" content="${ROBOTS}" />`,
    `<link data-seo-fallback rel="canonical" href="${attr(h.url)}" />`,
    `<meta data-seo-fallback property="og:type" content="${attr(h.type)}" />`,
    `<meta data-seo-fallback property="og:url" content="${attr(h.url)}" />`,
    `<meta data-seo-fallback property="og:title" content="${attr(h.title)}" />`,
    `<meta data-seo-fallback property="og:description" content="${attr(h.description)}" />`,
    `<meta data-seo-fallback name="twitter:card" content="summary_large_image" />`,
    `<meta data-seo-fallback name="twitter:title" content="${attr(h.title)}" />`,
    `<meta data-seo-fallback name="twitter:description" content="${attr(h.description)}" />`,
  ]
  if (h.image) {
    tags.push(
      `<meta data-seo-fallback property="og:image" content="${attr(h.image)}" />`,
      `<meta data-seo-fallback name="twitter:image" content="${attr(h.image)}" />`,
    )
  }
  if (h.jsonLd) tags.push(`<script data-seo-fallback type="application/ld+json">${h.jsonLd}</script>`)
  return tags.map((t) => `    ${t}`).join('\n')
}

/**
 * Fills the built index.html: replaces its fallback head tags (lines carrying
 * `data-seo-fallback`) when `head` is given, puts `body` inside #root and the seed before it.
 */
export function injectPage(template: string, page: { head?: string; body: string; seed?: Seed }): string {
  let html = template
  if (page.head !== undefined) {
    html = html
      .split('\n')
      .filter((line) => !line.includes('data-seo-fallback'))
      .join('\n')
      .replace('</head>', `${page.head}\n  </head>`)
  }
  const seed = page.seed ? `<script type="application/json" id="prerender-data">${scriptJson(page.seed)}</script>\n    ` : ''
  const root = '<div id="root"></div>'
  if (!html.includes(root)) throw new Error('index.html has no empty <div id="root"></div>')
  return html.replace(root, `${seed}<div id="root">${page.body}</div>`)
}

function linkList(items: readonly LinkItem[]): string {
  return `<ul>${items.map((i) => `<li><a href="${escapeHtml(i.href)}">${escapeHtml(i.label)}</a></li>`).join('')}</ul>`
}

export interface TitleBodyInput {
  heading: string
  facts: readonly string[]
  overview?: string
  watchHref: string
  watchLabel: string
  cast: readonly { href: string; name: string; character?: string }[]
  related: readonly LinkItem[]
  siteName: string
}

export function titleBody(t: TitleBodyInput): string {
  const cast = t.cast.length
    ? `<h2>Cast</h2><ul>${t.cast
        .map(
          (c) =>
            `<li><a href="${escapeHtml(c.href)}">${escapeHtml(c.name)}</a>${c.character ? ` as ${escapeHtml(c.character)}` : ''}</li>`,
        )
        .join('')}</ul>`
    : ''
  return [
    '<div class="prerender">',
    `<nav><a href="/">${escapeHtml(t.siteName)}</a></nav>`,
    '<article>',
    `<h1>${escapeHtml(t.heading)}</h1>`,
    t.facts.length ? `<p>${t.facts.map(escapeHtml).join(' · ')}</p>` : '',
    t.overview ? `<p>${escapeHtml(t.overview)}</p>` : '',
    `<p><a href="${escapeHtml(t.watchHref)}">${escapeHtml(t.watchLabel)}</a></p>`,
    cast,
    t.related.length ? `<h2>More to watch</h2>${linkList(t.related)}` : '',
    '</article>',
    '</div>',
  ].join('')
}

export function homeBody(heading: string, sections: readonly { title: string; items: readonly LinkItem[] }[]): string {
  return [
    '<div class="prerender">',
    `<h1>${escapeHtml(heading)}</h1>`,
    ...sections.filter((s) => s.items.length).map((s) => `<section><h2>${escapeHtml(s.title)}</h2>${linkList(s.items)}</section>`),
    '</div>',
  ].join('')
}

/** "2h 19m" / "45m", or undefined. */
export function formatMinutes(minutes: number | null | undefined): string | undefined {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes) || minutes <= 0) return undefined
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return h ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`
}

const KEEP_FIELDS = [
  'id',
  'title',
  'name',
  'overview',
  'poster_path',
  'backdrop_path',
  'vote_average',
  'vote_count',
  'release_date',
  'first_air_date',
  'genres',
  'runtime',
  'episode_run_time',
  'number_of_seasons',
  'seasons',
  'imdb_id',
  'external_ids',
  'created_by',
] as const

interface RawDetails {
  [key: string]: unknown
  credits?: { cast?: readonly unknown[]; crew?: readonly { job?: string }[] }
  videos?: { results?: readonly { site?: string }[] }
}

/**
 * The detail fields the title page uses, so the seed stays small: top cast, directors only,
 * YouTube videos only. Anything else is fetched by the normal background refetch.
 */
export function trimDetails(details: RawDetails, castLimit = 20): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of KEEP_FIELDS) if (details[k] !== undefined) out[k] = details[k]
  out.credits = {
    cast: (details.credits?.cast ?? []).slice(0, castLimit),
    crew: (details.credits?.crew ?? []).filter((c) => c.job === 'Director'),
  }
  out.videos = { results: (details.videos?.results ?? []).filter((v) => /youtube/i.test(v.site ?? '')) }
  return out
}
