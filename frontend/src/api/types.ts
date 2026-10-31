/**
 * Types for the AnyVod API (see docs/API.md).
 * Only the fields the frontend depends on are modelled; TMDB passes through
 * many more, and many documented fields can be null upstream.
 */

export type MediaKind = 'movie' | 'tv'
export type SearchType = MediaKind | 'person'

export interface Paged<T> {
  page: number
  results: T[]
  total_pages: number
  total_results: number
  /** Search only: how many items the filters were applied to, when they ran on the server. */
  filtered_from?: number
}

export interface Genre {
  id: number
  name: string
}

export interface GenreList {
  genres: Genre[]
}

/** An entry in any list route (trending, popular, similar, discover, search). */
export interface MediaListItem {
  id: number
  media_type?: MediaKind | 'person'
  title?: string
  name?: string
  poster_path: string | null
  backdrop_path?: string | null
  release_date?: string
  first_air_date?: string
  vote_average?: number
  popularity?: number
  genre_ids?: number[]
  /** Present on person results from multi/person search. */
  profile_path?: string | null
}

export interface Video {
  type: string
  site: string
  key: string
}

export interface CastMember {
  id: number
  name: string
  character?: string
  profile_path: string | null
}

export interface SeasonSummary {
  season_number: number
  name: string
  episode_count: number
}

export interface ExternalIds {
  imdb_id?: string | null
  [key: string]: unknown
}

export interface MediaDetails {
  id: number
  title?: string
  name?: string
  overview?: string
  poster_path: string | null
  backdrop_path: string | null
  vote_average?: number
  vote_count?: number
  release_date?: string
  first_air_date?: string
  genres?: Genre[]
  runtime?: number | null
  episode_run_time?: number[]
  number_of_seasons?: number
  seasons?: SeasonSummary[]
  external_ids?: ExternalIds
  imdb_id?: string | null
  videos?: { results: Video[] }
  credits?: { cast: CastMember[] }
}

export interface Episode {
  id: number
  episode_number: number
  name: string
  still_path: string | null
  runtime: number | null
  vote_average: number
  overview: string
  air_date: string | null
}

export interface SeasonDetails {
  name: string
  overview: string
  episodes: Episode[]
}

export interface Person {
  id: number
  name: string
  profile_path: string | null
  biography: string
  popularity: number
  birthday: string | null
  deathday: string | null
  place_of_birth: string | null
  known_for_department: string | null
}

export interface PersonCredit {
  credit_id: string
  id: number
  media_type: MediaKind
  title?: string
  name?: string
  character?: string
  poster_path: string | null
  popularity?: number
  vote_average?: number
  release_date?: string
  first_air_date?: string
}

export interface PersonCredits {
  cast: PersonCredit[]
}

export interface Availability {
  available: boolean
  reason?: string
  embed_url?: string
  tmdb_id: number
  type: MediaKind
  season?: number
  episode?: number
}

export type SearchSort =
  | 'relevance'
  | 'title_asc'
  | 'title_desc'
  | 'rating_desc'
  | 'rating_asc'
  | 'date_desc'
  | 'date_asc'
  | 'popularity_desc'

export const SEARCH_SORTS: readonly SearchSort[] = [
  'relevance',
  'title_asc',
  'title_desc',
  'rating_desc',
  'rating_asc',
  'date_desc',
  'date_asc',
  'popularity_desc',
]

/** Params for GET /tmdb/search (exid omitted: not used by the UI). */
export interface SearchParams {
  query: string
  page?: number
  type?: SearchType
  year?: number
  sort_by?: SearchSort
  min_rating?: number
  genres?: number[]
}

/** Paths of the list routes the home page uses. */
export type CategoryPath =
  | 'popular'
  | 'movie/popular'
  | 'movie/top_rated'
  | 'movie/upcoming'
  | 'movie/now_playing'
  | 'tv/popular'
  | 'tv/top_rated'
  | 'tv/on_the_air'

export type ApiErrorBody = { detail: string }
