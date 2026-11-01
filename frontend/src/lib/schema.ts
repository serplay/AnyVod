/**
 * Runtime in minutes -> ISO 8601 duration (`105` -> `PT1H45M`, `120` -> `PT2H`, `45` -> `PT45M`).
 * Returns undefined when the runtime is unknown (null/undefined/non-positive/non-finite),
 * so callers can omit the property instead of emitting a bogus value.
 */
export function formatIsoDuration(minutes: number | null | undefined): string | undefined {
  if (typeof minutes !== 'number' || !Number.isFinite(minutes)) return undefined
  const total = Math.round(minutes)
  if (total <= 0) return undefined
  const hours = Math.floor(total / 60)
  const mins = total % 60
  return `PT${hours > 0 ? `${hours}H` : ''}${mins > 0 ? `${mins}M` : ''}`
}

/*
 * Schema.org JSON-LD for the title and person pages. Pure and import-free (structural input
 * types only) so scripts/prerender.ts can run it under `node --experimental-strip-types`.
 * Only facts we actually have are emitted. Never ratings: Google's review-snippet rules don't
 * allow ratings sourced from another site (TMDB).
 */

export type JsonLd = Record<string, unknown>

interface Named {
  id: number
  name: string
}

export interface TitleLike {
  id: number
  title?: string
  name?: string
  overview?: string
  poster_path?: string | null
  backdrop_path?: string | null
  release_date?: string
  first_air_date?: string
  genres?: readonly { name: string }[]
  runtime?: number | null
  episode_run_time?: readonly number[]
  number_of_seasons?: number
  imdb_id?: string | null
  external_ids?: { imdb_id?: string | null }
  created_by?: readonly Named[]
  credits?: {
    cast?: readonly (Named & { character?: string })[]
    crew?: readonly (Named & { job?: string })[]
  }
  videos?: {
    results?: readonly { key: string; site: string; type: string; name?: string; published_at?: string }[]
  }
}

export interface PersonLike {
  id: number
  name: string
  profile_path?: string | null
  biography?: string
  birthday?: string | null
  deathday?: string | null
  place_of_birth?: string | null
  known_for_department?: string | null
  imdb_id?: string | null
}

const TMDB_IMG = 'https://image.tmdb.org/t/p/'
const MAX_ACTORS = 10

function img(path: string | null | undefined, size: string): string | undefined {
  return path ? `${TMDB_IMG}${size}${path}` : undefined
}

function clip(text: string | null | undefined, max = 300): string | undefined {
  const flat = (text ?? '').replace(/\s+/g, ' ').trim()
  if (!flat) return undefined
  return flat.length <= max ? flat : `${flat.slice(0, max - 1).replace(/\s+\S*$/, '')}…`
}

/** Drops undefined values and empty arrays so the output only states known facts. */
function compact(obj: JsonLd): JsonLd {
  const out: JsonLd = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') continue
    if (Array.isArray(v) && v.length === 0) continue
    out[k] = v
  }
  return out
}

function personRef(siteUrl: string, p: Named): JsonLd {
  return { '@type': 'Person', name: p.name, url: `${siteUrl}/person/${p.id}` }
}

/** The title's YouTube trailer as a VideoObject, when TMDB has one with a publish date. */
function trailerLd(details: TitleLike, name: string): JsonLd | undefined {
  const youtube = (details.videos?.results ?? []).filter((v) => /youtube/i.test(v.site))
  const t = youtube.find((v) => /trailer/i.test(v.type)) ?? youtube[0]
  if (!t?.published_at) return undefined
  return {
    '@type': 'VideoObject',
    name: t.name || `${name} trailer`,
    description: `Official trailer for ${name}.`,
    thumbnailUrl: `https://i.ytimg.com/vi/${t.key}/hqdefault.jpg`,
    uploadDate: t.published_at,
    embedUrl: `https://www.youtube.com/embed/${t.key}`,
  }
}

export function breadcrumbLd(siteUrl: string, crumbs: readonly { name: string; path: string }[]): JsonLd {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: `${siteUrl}${c.path === '/' ? '/' : c.path}`,
    })),
  }
}

/** `Movie` or `TVSeries` plus a breadcrumb, as one `@graph` document. */
export function titleJsonLd(kind: 'movie' | 'tv', details: TitleLike, siteUrl: string, siteName: string): JsonLd {
  const name = (kind === 'movie' ? details.title : details.name) || details.title || details.name || ''
  const path = `/${kind}/${details.id}`
  const url = `${siteUrl}${path}`
  const imdb = details.imdb_id || details.external_ids?.imdb_id
  const date = kind === 'movie' ? details.release_date : details.first_air_date
  const runtime = details.runtime ?? details.episode_run_time?.[0]
  const crew = details.credits?.crew ?? []

  const main = compact({
    '@type': kind === 'movie' ? 'Movie' : 'TVSeries',
    '@id': `${url}#title`,
    url,
    name,
    description: clip(details.overview),
    image: img(details.poster_path, 'w780') ?? img(details.backdrop_path, 'w1280'),
    datePublished: date || undefined,
    genre: details.genres?.map((g) => g.name),
    duration: kind === 'movie' ? formatIsoDuration(runtime) : undefined,
    numberOfSeasons: kind === 'tv' ? details.number_of_seasons : undefined,
    actor: (details.credits?.cast ?? []).slice(0, MAX_ACTORS).map((p) => personRef(siteUrl, p)),
    director: kind === 'movie' ? crew.filter((c) => c.job === 'Director').map((p) => personRef(siteUrl, p)) : undefined,
    creator: kind === 'tv' ? (details.created_by ?? []).map((p) => personRef(siteUrl, p)) : undefined,
    trailer: trailerLd(details, name),
    sameAs: imdb ? [`https://www.imdb.com/title/${imdb}/`] : undefined,
  })

  return {
    '@context': 'https://schema.org',
    '@graph': [main, breadcrumbLd(siteUrl, [{ name: siteName, path: '/' }, { name, path }])],
  }
}

export function personJsonLd(person: PersonLike, siteUrl: string, siteName: string): JsonLd {
  const path = `/person/${person.id}`
  const main = compact({
    '@type': 'Person',
    '@id': `${siteUrl}${path}#person`,
    url: `${siteUrl}${path}`,
    name: person.name,
    description: clip(person.biography),
    image: img(person.profile_path, 'h632'),
    birthDate: person.birthday || undefined,
    deathDate: person.deathday || undefined,
    birthPlace: person.place_of_birth ? { '@type': 'Place', name: person.place_of_birth } : undefined,
    jobTitle: person.known_for_department || undefined,
    sameAs: person.imdb_id ? [`https://www.imdb.com/name/${person.imdb_id}/`] : undefined,
  })
  return {
    '@context': 'https://schema.org',
    '@graph': [main, breadcrumbLd(siteUrl, [{ name: siteName, path: '/' }, { name: person.name, path }])],
  }
}

/** JSON for an inline `<script type="application/ld+json">`: `<` escaped so it can't close the tag. */
export function jsonLdText(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
