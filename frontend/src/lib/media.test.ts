import { describe, expect, it } from 'vitest'
import {
  formatRuntime,
  formatYear,
  getMediaKind,
  itemKey,
  itemPath,
  parseNonNegativeInt,
  pickTrailerKey,
  seasonsOf,
  tmdbImageFor,
  tmdbSrcSet,
} from './media'

describe('getMediaKind', () => {
  it('trusts media_type when present', () => {
    expect(getMediaKind({ media_type: 'tv', title: 'x', release_date: '2020-01-01' })).toBe('tv')
    expect(getMediaKind({ media_type: 'movie', name: 'x', first_air_date: '2020-01-01' })).toBe('movie')
  })

  it('infers tv from first_air_date without release_date', () => {
    expect(getMediaKind({ name: 'Show', first_air_date: '2011-04-17' })).toBe('tv')
  })

  it('infers tv from name without title', () => {
    expect(getMediaKind({ name: 'Show' })).toBe('tv')
  })

  it('defaults to movie', () => {
    expect(getMediaKind({ title: 'Film', release_date: '1999-10-15' })).toBe('movie')
    expect(getMediaKind({})).toBe('movie')
  })

  it('ignores person media_type for kind detection', () => {
    expect(getMediaKind({ media_type: 'person', name: 'Someone' })).toBe('tv')
  })
})

describe('itemKey / itemPath', () => {
  it('prefixes with kind so movie and tv ids do not collide', () => {
    expect(itemKey({ id: 1, media_type: 'movie' })).toBe('movie-1')
    expect(itemKey({ id: 1, media_type: 'tv' })).toBe('tv-1')
    expect(itemKey({ id: 1, name: 'x', first_air_date: '2000-01-01' })).toBe('tv-1')
    expect(itemKey({ id: 7, media_type: 'person', name: 'P' })).toBe('person-7')
  })

  it('builds detail paths', () => {
    expect(itemPath({ id: 550, title: 'Fight Club' })).toBe('/movie/550')
    expect(itemPath({ id: 1399, media_type: 'tv' })).toBe('/tv/1399')
    expect(itemPath({ id: 287, media_type: 'person' })).toBe('/person/287')
  })
})

describe('tmdb images', () => {
  it('builds URLs without a .webp suffix', () => {
    expect(tmdbImageFor('/abc.jpg', 'poster', 'medium')).toBe('https://image.tmdb.org/t/p/w342/abc.jpg')
    expect(tmdbImageFor('/abc.jpg', 'backdrop', 'original')).toBe('https://image.tmdb.org/t/p/original/abc.jpg')
    expect(tmdbImageFor(null)).toBeUndefined()
  })

  it('srcset uses real width descriptors', () => {
    expect(tmdbSrcSet('/p.jpg', 'poster')).toBe(
      'https://image.tmdb.org/t/p/w185/p.jpg 185w, https://image.tmdb.org/t/p/w342/p.jpg 342w, https://image.tmdb.org/t/p/w500/p.jpg 500w',
    )
    const profile = tmdbSrcSet('/x.jpg', 'profile') ?? ''
    expect(profile).toContain('w45/x.jpg 45w')
    expect(profile).toContain('w185/x.jpg 185w')
    expect(profile).not.toContain('632w')
    expect(profile).not.toContain('.webp')
    expect(tmdbSrcSet(undefined, 'still')).toBeUndefined()
  })
})

describe('seasonsOf', () => {
  it('uses details.seasons and drops empty specials', () => {
    const seasons = seasonsOf({
      number_of_seasons: 2,
      seasons: [
        { season_number: 2, name: 'Season 2', episode_count: 8 },
        { season_number: 0, name: 'Specials', episode_count: 0 },
        { season_number: 1, name: 'Season 1', episode_count: 10 },
      ],
    })
    expect(seasons.map((s) => s.season_number)).toEqual([1, 2])
  })

  it('keeps specials that have episodes', () => {
    const seasons = seasonsOf({
      seasons: [
        { season_number: 0, name: 'Specials', episode_count: 3 },
        { season_number: 1, name: 'Season 1', episode_count: 10 },
      ],
    })
    expect(seasons.map((s) => s.season_number)).toEqual([0, 1])
  })

  it('handles non-contiguous season numbers', () => {
    const seasons = seasonsOf({
      number_of_seasons: 2,
      seasons: [
        { season_number: 1, name: 'S1', episode_count: 5 },
        { season_number: 3, name: 'S3', episode_count: 5 },
      ],
    })
    expect(seasons.map((s) => s.season_number)).toEqual([1, 3])
  })

  it('falls back to 1..number_of_seasons', () => {
    expect(seasonsOf({ number_of_seasons: 3 }).map((s) => s.season_number)).toEqual([1, 2, 3])
    expect(seasonsOf(null)).toEqual([])
  })
})

describe('misc helpers', () => {
  it('formatYear', () => {
    expect(formatYear('2019-05-03')).toBe('2019')
    expect(formatYear('')).toBeUndefined()
    expect(formatYear(null)).toBeUndefined()
  })

  it('parseNonNegativeInt', () => {
    expect(parseNonNegativeInt('42')).toBe(42)
    expect(parseNonNegativeInt('0')).toBe(0)
    expect(parseNonNegativeInt('-1')).toBeUndefined()
    expect(parseNonNegativeInt('4x')).toBeUndefined()
    expect(parseNonNegativeInt(undefined)).toBeUndefined()
  })

  it('pickTrailerKey prefers YouTube trailers', () => {
    expect(
      pickTrailerKey({
        videos: {
          results: [
            { type: 'Teaser', site: 'YouTube', key: 'teaser' },
            { type: 'Trailer', site: 'Vimeo', key: 'vimeo' },
            { type: 'Trailer', site: 'YouTube', key: 'trailer' },
          ],
        },
      }),
    ).toBe('trailer')
    expect(pickTrailerKey({ videos: { results: [{ type: 'Trailer', site: 'Vimeo', key: 'v' }] } })).toBeUndefined()
  })
})

describe('formatRuntime', () => {
  it('formats minutes as hours and minutes', () => {
    expect(formatRuntime(148)).toBe('2h 28m')
    expect(formatRuntime(120)).toBe('2h')
    expect(formatRuntime(45)).toBe('45m')
    expect(formatRuntime(0)).toBeUndefined()
    expect(formatRuntime(null)).toBeUndefined()
  })
})
