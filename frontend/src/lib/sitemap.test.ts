import { buildSitemap, entriesFromList, sitemapPaths } from './sitemap'

describe('buildSitemap', () => {
  const date = new Date('2026-10-12T15:30:00Z')

  it('renders one <url> per unique URL with lastmod set to the given day', () => {
    const xml = buildSitemap(
      ['https://example.com/', 'https://example.com/movie/1', 'https://example.com/movie/1', 'https://example.com/tv/2'],
      date,
    )
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')).toBe(true)
    expect(xml.match(/<loc>[^<]*<\/loc>/g)).toEqual([
      '<loc>https://example.com/</loc>',
      '<loc>https://example.com/movie/1</loc>',
      '<loc>https://example.com/tv/2</loc>',
    ])
    expect(xml.match(/<lastmod>2026-10-12<\/lastmod>/g)).toHaveLength(3)
    expect(xml).toContain('<priority>1.0</priority>')
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true)
  })

  it('escapes XML special characters', () => {
    expect(buildSitemap(['https://example.com/?a=1&b=2'], date)).toContain('<loc>https://example.com/?a=1&amp;b=2</loc>')
  })
})

describe('entriesFromList / sitemapPaths', () => {
  it('uses media_type when present, the fallback otherwise, and skips people and bad ids', () => {
    const trending = {
      results: [
        { id: 1, media_type: 'movie' },
        { id: 2, media_type: 'tv' },
        { id: 3, media_type: 'person' },
        { id: 'x', media_type: 'movie' },
      ],
    }
    expect(entriesFromList(trending)).toEqual([
      { kind: 'movie', id: 1 },
      { kind: 'tv', id: 2 },
    ])
    expect(entriesFromList({ results: [{ id: 5 }] }, 'tv')).toEqual([{ kind: 'tv', id: 5 }])
    expect(entriesFromList({ results: [{ id: 5 }] })).toEqual([])
    expect(entriesFromList(null)).toEqual([])
  })

  it('starts with / and deduplicates detail paths', () => {
    expect(
      sitemapPaths([
        { kind: 'movie', id: 1 },
        { kind: 'movie', id: 1 },
        { kind: 'tv', id: 1 },
      ]),
    ).toEqual(['/', '/movie/1', '/tv/1'])
  })
})
