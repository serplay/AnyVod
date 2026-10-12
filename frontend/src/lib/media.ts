import type { MediaDetails, MediaKind, SeasonSummary } from '../api/types'

export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/'

export type ImageRole = 'poster' | 'backdrop' | 'profile' | 'still'
export type ImageSize = 'small' | 'medium' | 'large' | 'original'

/** TMDB size tokens per role. See https://developer.themoviedb.org/docs/image-basics */
const SIZES: Record<ImageRole, Record<Exclude<ImageSize, 'original'>, string>> = {
  poster: { small: 'w185', medium: 'w342', large: 'w500' },
  backdrop: { small: 'w300', medium: 'w780', large: 'w1280' },
  profile: { small: 'w45', medium: 'w185', large: 'h632' },
  still: { small: 'w185', medium: 'w300', large: 'w500' },
}

/**
 * srcset candidates per role as [TMDB size token, intrinsic width in px].
 * Width descriptors must be real pixel widths: `h632` is a *height*; TMDB
 * profiles are 2:3, so an h632 profile is ~421px wide (not 632w).
 */
const SRCSET: Record<ImageRole, ReadonlyArray<readonly [string, number]>> = {
  poster: [['w185', 185], ['w342', 342], ['w500', 500]],
  backdrop: [['w300', 300], ['w780', 780], ['w1280', 1280]],
  profile: [['w45', 45], ['w185', 185], ['h632', 421]],
  still: [['w185', 185], ['w300', 300], ['w500', 500]],
}

const MEDIA_KINDS: readonly string[] = ['movie', 'tv']

export function isMediaKind(value: unknown): value is MediaKind {
  return typeof value === 'string' && MEDIA_KINDS.includes(value)
}

/** Minimal shape needed to tell a movie from a TV show. */
export interface KindDetectable {
  media_type?: string
  title?: string
  name?: string
  release_date?: string
  first_air_date?: string
}

/**
 * Movie or TV? Trusts `media_type` when present (trending/multi/credits),
 * otherwise infers from TV-only fields (`first_air_date`, `name` without `title`).
 */
export function getMediaKind(item: KindDetectable): MediaKind {
  if (isMediaKind(item.media_type)) return item.media_type
  if (item.first_air_date && !item.release_date) return 'tv'
  if (!item.title && item.name) return 'tv'
  return 'movie'
}

export function isPerson(item: { media_type?: string }): boolean {
  return item.media_type === 'person'
}

/** Stable React key across mixed movie/tv/person lists (TMDB ids collide across kinds). */
export function itemKey(item: KindDetectable & { id: number }): string {
  const kind = isPerson(item) ? 'person' : getMediaKind(item)
  return `${kind}-${item.id}`
}

/** Route to the detail page of a list item. */
export function itemPath(item: KindDetectable & { id: number }): string {
  if (isPerson(item)) return `/person/${item.id}`
  return `/${getMediaKind(item)}/${item.id}`
}

/** Full image URL from a TMDB size token (e.g. `w342`, `original`). */
export function tmdbImage(path: string | null | undefined, size: string): string | undefined {
  if (!path) return undefined
  return `${TMDB_IMAGE_BASE}${size}${path}`
}

/** Full image URL for a role at a semantic size. */
export function tmdbImageFor(
  path: string | null | undefined,
  role: ImageRole = 'poster',
  size: ImageSize = 'medium',
): string | undefined {
  const token = size === 'original' ? 'original' : SIZES[role][size]
  return tmdbImage(path, token)
}

/** srcset with correct `w` descriptors for a role. */
export function tmdbSrcSet(path: string | null | undefined, role: ImageRole): string | undefined {
  if (!path) return undefined
  return SRCSET[role].map(([token, width]) => `${TMDB_IMAGE_BASE}${token}${path} ${width}w`).join(', ')
}

/**
 * Seasons to show for a TV show. Uses `details.seasons` (so gaps and specials
 * are handled), keeps season 0 (Specials) only when it has episodes, and falls
 * back to 1..number_of_seasons when `seasons` is missing (episode_count then 0 = unknown).
 */
export function seasonsOf(details: Pick<MediaDetails, 'seasons' | 'number_of_seasons'> | null | undefined): SeasonSummary[] {
  if (!details) return []
  if (Array.isArray(details.seasons) && details.seasons.length > 0) {
    return details.seasons
      .filter((s) => s.season_number !== 0 || s.episode_count > 0)
      .slice()
      .sort((a, b) => a.season_number - b.season_number)
  }
  const n = details.number_of_seasons ?? 0
  return Array.from({ length: n }, (_, i) => ({
    season_number: i + 1,
    name: `Season ${i + 1}`,
    episode_count: 0,
  }))
}

/** `title` for movies, `name` for TV/people. */
export function displayTitle(item: { title?: string; name?: string }): string {
  return item.title || item.name || ''
}

export function releaseDate(item: { release_date?: string; first_air_date?: string }): string | undefined {
  return item.release_date || item.first_air_date || undefined
}

/** "2019-05-03" -> "2019". */
export function formatYear(date: string | null | undefined): string | undefined {
  if (!date) return undefined
  const year = date.split('-')[0]
  return year || undefined
}

export function formatRating(rating: number | null | undefined): string | undefined {
  if (typeof rating !== 'number' || Number.isNaN(rating)) return undefined
  return rating.toFixed(1)
}

/** Parse a route/query param as a non-negative integer; undefined if invalid. */
export function parseNonNegativeInt(value: string | null | undefined): number | undefined {
  if (value === null || value === undefined || !/^\d+$/.test(value)) return undefined
  const n = Number(value)
  return Number.isSafeInteger(n) ? n : undefined
}

/** First YouTube trailer, else any YouTube video. */
export function pickTrailerKey(details: Pick<MediaDetails, 'videos'> | null | undefined): string | undefined {
  const vids = details?.videos?.results ?? []
  const youtube = vids.filter((v) => /youtube/i.test(v.site))
  return (youtube.find((v) => /trailer/i.test(v.type)) ?? youtube[0])?.key
}
