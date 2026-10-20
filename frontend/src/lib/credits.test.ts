import { describe, expect, it } from 'vitest'
import { topCredits } from './credits'
import type { PersonCredit } from '../api/types'

const credit = (over: Partial<PersonCredit>): PersonCredit => ({
  credit_id: Math.random().toString(36),
  id: 1,
  media_type: 'movie',
  poster_path: '/p.jpg',
  ...over,
})

describe('topCredits', () => {
  it('keeps one credit per title, sorted by popularity', () => {
    const result = topCredits([
      credit({ credit_id: 'a', id: 1, title: 'Low', popularity: 1 }),
      credit({ credit_id: 'b', id: 2, name: 'Show', media_type: 'tv', popularity: 50, character: 'Self' }),
      credit({ credit_id: 'c', id: 2, name: 'Show', media_type: 'tv', popularity: 50, character: 'Narrator' }),
      credit({ credit_id: 'd', id: 2, title: 'Movie with same id', media_type: 'movie', popularity: 10 }),
    ])
    expect(result.map((c) => c.credit_id)).toEqual(['b', 'd', 'a'])
  })

  it('drops credits without posters and respects the limit', () => {
    const cast = Array.from({ length: 30 }, (_, i) => credit({ credit_id: `c${i}`, id: i, popularity: i }))
    cast.push(credit({ credit_id: 'noposter', id: 999, poster_path: null, popularity: 1000 }))
    const result = topCredits(cast, 5)
    expect(result).toHaveLength(5)
    expect(result.map((c) => c.id)).toEqual([29, 28, 27, 26, 25])
  })

  it('handles missing data', () => {
    expect(topCredits(undefined)).toEqual([])
  })
})
