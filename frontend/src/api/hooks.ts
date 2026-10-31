import { keepPreviousData, queryOptions, useQuery } from '@tanstack/react-query'
import { apiGet } from './client'
import type {
  Availability,
  CategoryPath,
  GenreList,
  MediaDetails,
  MediaKind,
  MediaListItem,
  Paged,
  Person,
  PersonCredits,
  SearchParams,
  SeasonDetails,
} from './types'

type Id = number | string

const ONE_DAY = 24 * 60 * 60 * 1000

/** Query keys, exported so callers can prefetch/invalidate consistently. */
export const queryKeys = {
  details: (kind: MediaKind, id: Id) => ['details', kind, String(id)] as const,
  similar: (kind: MediaKind, id: Id) => ['similar', kind, String(id)] as const,
  season: (tvId: Id, n: number) => ['season', String(tvId), n] as const,
  availability: (kind: MediaKind, id: Id) => ['availability', kind, String(id)] as const,
  search: (params: SearchParams) => ['search', params] as const,
  genres: (kind: MediaKind) => ['genres', kind] as const,
  person: (id: Id) => ['person', String(id)] as const,
  personCredits: (id: Id) => ['personCredits', String(id)] as const,
  category: (path: CategoryPath) => ['category', path] as const,
  trending: () => ['trending', 'all', 'day'] as const,
}

const hasId = (id: Id | null | undefined): id is Id => id !== null && id !== undefined && id !== ''

export function useDetails(kind: MediaKind, id: Id | undefined) {
  return useQuery({
    queryKey: queryKeys.details(kind, id ?? ''),
    queryFn: ({ signal }) => apiGet<MediaDetails>(`/tmdb/${kind}/${id}`, undefined, signal),
    enabled: hasId(id),
  })
}

export function useSimilar(kind: MediaKind, id: Id | undefined) {
  return useQuery({
    queryKey: queryKeys.similar(kind, id ?? ''),
    queryFn: ({ signal }) => apiGet<Paged<MediaListItem>>(`/tmdb/${kind}/${id}/similar`, undefined, signal),
    enabled: hasId(id),
  })
}

/** Shared with imperative `queryClient.fetchQuery` callers (e.g. the player's "previous season"). */
export function seasonQueryOptions(tvId: Id, n: number) {
  return queryOptions({
    queryKey: queryKeys.season(tvId, n),
    queryFn: ({ signal }) => apiGet<SeasonDetails>(`/tmdb/tv/${tvId}/season/${n}`, undefined, signal),
  })
}

export function useSeason(tvId: Id | undefined, n: number | null | undefined) {
  return useQuery({
    ...seasonQueryOptions(tvId ?? '', n ?? -1),
    enabled: hasId(tvId) && typeof n === 'number' && n >= 0,
  })
}

export function useAvailability(kind: MediaKind, id: Id | undefined) {
  return useQuery({
    queryKey: queryKeys.availability(kind, id ?? ''),
    queryFn: ({ signal }) => apiGet<Availability>(`/vidsrc/${kind}/availability/${id}`, undefined, signal),
    enabled: hasId(id),
  })
}

export function useSearch(params: SearchParams | null) {
  return useQuery({
    queryKey: queryKeys.search(params ?? { query: '' }),
    queryFn: ({ signal }) => {
      const { genres, ...rest } = params ?? { query: '' }
      return apiGet<Paged<MediaListItem>>('/tmdb/search', { ...rest, genres }, signal)
    },
    enabled: !!params && params.query.trim() !== '',
    placeholderData: keepPreviousData,
  })
}

export function useGenres(kind: MediaKind | null) {
  return useQuery({
    queryKey: queryKeys.genres(kind ?? 'movie'),
    queryFn: ({ signal }) => apiGet<GenreList>(`/tmdb/genres/${kind}`, undefined, signal),
    enabled: kind !== null,
    staleTime: ONE_DAY,
  })
}

export function usePerson(id: Id | undefined) {
  return useQuery({
    queryKey: queryKeys.person(id ?? ''),
    queryFn: ({ signal }) => apiGet<Person>(`/tmdb/person/${id}`, undefined, signal),
    enabled: hasId(id),
  })
}

export function usePersonCredits(id: Id | undefined) {
  return useQuery({
    queryKey: queryKeys.personCredits(id ?? ''),
    queryFn: ({ signal }) => apiGet<PersonCredits>(`/tmdb/person/${id}/combined_credits`, undefined, signal),
    enabled: hasId(id),
  })
}

export function useCategory(path: CategoryPath) {
  return useQuery({
    queryKey: queryKeys.category(path),
    queryFn: ({ signal }) => apiGet<Paged<MediaListItem>>(`/tmdb/${path}`, undefined, signal),
  })
}

export function useTrending() {
  return useQuery({
    queryKey: queryKeys.trending(),
    queryFn: ({ signal }) => apiGet<Paged<MediaListItem>>('/tmdb/trending/all/day', undefined, signal),
  })
}
