import { describe, expect, it } from 'vitest'
import { isFilteredPerPage, parseSearchParams, searchPath, toUrlSearchParams } from './searchParams'

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

  it('knows which filters the backend applies per page', () => {
    expect(isFilteredPerPage({ query: 'x' })).toBe(false)
    expect(isFilteredPerPage({ query: 'x', sort_by: 'rating_desc' })).toBe(false)
    expect(isFilteredPerPage({ query: 'x', min_rating: 7 })).toBe(true)
    expect(isFilteredPerPage({ query: 'x', genres: [18] })).toBe(true)
    // movie search sends the year upstream; other searches filter it locally
    expect(isFilteredPerPage({ query: 'x', type: 'movie', year: 2020 })).toBe(false)
    expect(isFilteredPerPage({ query: 'x', type: 'tv', year: 2020 })).toBe(true)
    expect(isFilteredPerPage({ query: 'x', year: 2020 })).toBe(true)
    // person search ignores media filters
    expect(isFilteredPerPage({ query: 'x', type: 'person', min_rating: 7 })).toBe(false)
  })
})
