import { SEARCH_SORTS, type SearchParams, type SearchSort, type SearchType } from '../api/types'
import { parseNonNegativeInt } from './media'

/**
 * URL <-> SearchParams for the /search route.
 * URL keys: q, type, genres (comma-separated), year, min_rating, sort_by, page.
 */

const SEARCH_TYPES: readonly string[] = ['movie', 'tv', 'person']

function isSearchType(v: string | null): v is SearchType {
  return v !== null && SEARCH_TYPES.includes(v)
}

function isSearchSort(v: string | null): v is SearchSort {
  return v !== null && (SEARCH_SORTS as readonly string[]).includes(v)
}

/** Parse the URL; returns null when there is no query. Invalid values are dropped. */
export function parseSearchParams(sp: URLSearchParams): SearchParams | null {
  const query = (sp.get('q') ?? '').trim()
  if (!query) return null

  const params: SearchParams = { query }

  const type = sp.get('type')
  if (isSearchType(type)) params.type = type

  const sort = sp.get('sort_by')
  if (isSearchSort(sort) && sort !== 'relevance') params.sort_by = sort

  const year = parseNonNegativeInt(sp.get('year'))
  if (year !== undefined && year >= 1800 && year <= 2200) params.year = year

  const minRatingRaw = sp.get('min_rating')
  const minRating = minRatingRaw === null || minRatingRaw === '' ? NaN : Number(minRatingRaw)
  if (Number.isFinite(minRating) && minRating > 0 && minRating <= 10) params.min_rating = minRating

  const genres = (sp.get('genres') ?? '')
    .split(',')
    .map((g) => parseNonNegativeInt(g.trim()))
    .filter((g): g is number => g !== undefined && g > 0)
  if (genres.length > 0) params.genres = Array.from(new Set(genres))

  const page = parseNonNegativeInt(sp.get('page'))
  params.page = page !== undefined && page >= 1 ? page : 1

  return params
}

/** Serialize to URL params, omitting defaults. */
export function toUrlSearchParams(params: SearchParams): URLSearchParams {
  const sp = new URLSearchParams()
  sp.set('q', params.query)
  if (params.type) sp.set('type', params.type)
  if (params.genres && params.genres.length > 0) sp.set('genres', params.genres.join(','))
  if (params.year !== undefined) sp.set('year', String(params.year))
  if (params.min_rating !== undefined) sp.set('min_rating', String(params.min_rating))
  if (params.sort_by && params.sort_by !== 'relevance') sp.set('sort_by', params.sort_by)
  if (params.page !== undefined && params.page > 1) sp.set('page', String(params.page))
  return sp
}

/**
 * Whether the backend narrows each TMDB results page itself (rating, genres, and year
 * outside movie search, which TMDB filters upstream). TMDB's totals then count the
 * unfiltered results, so they can't be shown as the number of matches.
 */
export function isFilteredPerPage(params: SearchParams): boolean {
  if (params.type === 'person') return false
  return (
    params.min_rating !== undefined ||
    (params.genres?.length ?? 0) > 0 ||
    (params.year !== undefined && params.type !== 'movie')
  )
}

export function searchPath(params: SearchParams): string {
  return `/search?${toUrlSearchParams(params).toString()}`
}
