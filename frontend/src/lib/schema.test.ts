import { describe, expect, it } from 'vitest'
import { formatIsoDuration, jsonLdText, personJsonLd, titleJsonLd } from './schema'

describe('formatIsoDuration', () => {
  it('formats hours and minutes as ISO 8601', () => {
    expect(formatIsoDuration(105)).toBe('PT1H45M')
    expect(formatIsoDuration(45)).toBe('PT45M')
    expect(formatIsoDuration(120)).toBe('PT2H')
    expect(formatIsoDuration(61)).toBe('PT1H1M')
  })

  it('rounds fractional minutes', () => {
    expect(formatIsoDuration(44.6)).toBe('PT45M')
  })

  it('returns undefined when unknown', () => {
    expect(formatIsoDuration(undefined)).toBeUndefined()
    expect(formatIsoDuration(null)).toBeUndefined()
    expect(formatIsoDuration(0)).toBeUndefined()
    expect(formatIsoDuration(-5)).toBeUndefined()
    expect(formatIsoDuration(Number.NaN)).toBeUndefined()
  })
})


const SITE = 'https://site.example'

describe('titleJsonLd', () => {
  const movie = {
    id: 550,
    title: 'Fight Club',
    overview: 'An insomniac office worker…',
    poster_path: '/p.jpg',
    backdrop_path: '/b.jpg',
    release_date: '1999-10-15',
    genres: [{ name: 'Drama' }],
    runtime: 139,
    imdb_id: 'tt0137523',
    credits: {
      cast: [{ id: 819, name: 'Edward Norton', character: 'Narrator' }],
      crew: [
        { id: 7467, name: 'David Fincher', job: 'Director' },
        { id: 1, name: 'Someone', job: 'Editor' },
      ],
    },
    videos: { results: [{ key: 'abc', site: 'YouTube', type: 'Trailer', published_at: '2014-01-01T00:00:00.000Z' }] },
  }

  it('describes a movie with only known facts and a breadcrumb', () => {
    const ld = titleJsonLd('movie', movie, SITE, 'AnyVod') as { '@graph': Record<string, unknown>[] }
    const [main, crumbs] = ld['@graph']
    expect(main).toMatchObject({
      '@type': 'Movie',
      url: `${SITE}/movie/550`,
      name: 'Fight Club',
      image: 'https://image.tmdb.org/t/p/w780/p.jpg',
      datePublished: '1999-10-15',
      genre: ['Drama'],
      duration: 'PT2H19M',
      actor: [{ '@type': 'Person', name: 'Edward Norton', url: `${SITE}/person/819` }],
      director: [{ '@type': 'Person', name: 'David Fincher', url: `${SITE}/person/7467` }],
      sameAs: ['https://www.imdb.com/title/tt0137523/'],
      trailer: { '@type': 'VideoObject', embedUrl: 'https://www.youtube.com/embed/abc' },
    })
    expect(main).not.toHaveProperty('aggregateRating')
    expect(crumbs).toMatchObject({ '@type': 'BreadcrumbList' })
  })

  it('describes a TV series and omits what is unknown', () => {
    const ld = titleJsonLd(
      'tv',
      { id: 1399, name: 'Game of Thrones', number_of_seasons: 8, external_ids: { imdb_id: 'tt0944947' }, created_by: [{ id: 9813, name: 'David Benioff' }] },
      SITE,
      'AnyVod',
    ) as { '@graph': Record<string, unknown>[] }
    const main = ld['@graph'][0]!
    expect(main).toMatchObject({ '@type': 'TVSeries', numberOfSeasons: 8, creator: [{ name: 'David Benioff' }] })
    for (const key of ['description', 'image', 'datePublished', 'genre', 'duration', 'actor', 'trailer']) {
      expect(main).not.toHaveProperty(key)
    }
  })
})

describe('personJsonLd / jsonLdText', () => {
  it('describes a person', () => {
    const ld = personJsonLd(
      { id: 819, name: 'Edward Norton', birthday: '1969-08-18', place_of_birth: 'Boston', imdb_id: 'nm0001570', biography: '' },
      SITE,
      'AnyVod',
    ) as { '@graph': Record<string, unknown>[] }
    expect(ld['@graph'][0]).toMatchObject({
      '@type': 'Person',
      birthDate: '1969-08-18',
      birthPlace: { name: 'Boston' },
      sameAs: ['https://www.imdb.com/name/nm0001570/'],
    })
    expect(ld['@graph'][0]).not.toHaveProperty('description')
  })

  it('escapes < so the JSON cannot close its script tag', () => {
    expect(jsonLdText({ name: '</script><b>' })).toBe('{"name":"\\u003c/script>\\u003cb>"}')
  })
})
