import { describe, expect, it } from 'vitest'
import { parseSearchParams, searchPath, toUrlSearchParams } from './searchParams'

describe('search URL params', () => {
  it('returns null without a query', () => {
    expect(parseSearchParams(new URLSearchParams(''))).toBeNull()
    expect(parseSearchParams(new URLSearchParams('q=%20%20'))).toBeNull()
  })

  it('drops invalid values', () => {
    expect(
      parseSearchParams(new URLSearchParams('q=a&type=bogus&sort_by=nope&year=abc&min_rating=11&genres=x,,5&page=-2')),
    ).toEqual({ query: 'a', genres: [5], page: 1 })
  })

  it('round-trips and omits defaults', () => {
    const path = searchPath({ query: 'the office', type: 'tv', genres: [35], page: 1, sort_by: 'relevance' })
    expect(path).toBe('/search?q=the+office&type=tv&genres=35')
    const parsed = parseSearchParams(new URLSearchParams(path.split('?')[1]))
    expect(parsed).toEqual({ query: 'the office', type: 'tv', genres: [35], page: 1 })
    expect(toUrlSearchParams({ query: 'x', page: 3 }).get('page')).toBe('3')
  })
})
