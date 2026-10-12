import type { PersonCredit } from '../api/types'
import { itemKey } from './media'

/**
 * Credits to show on a person page: only titles with a poster, most popular
 * first, one entry per title (combined_credits lists a title once per role,
 * e.g. several characters), capped at `limit`.
 */
export function topCredits(cast: readonly PersonCredit[] | null | undefined, limit = 18): PersonCredit[] {
  if (!cast) return []
  const seen = new Set<string>()
  const result: PersonCredit[] = []
  const sorted = cast.filter((c) => c.poster_path).sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
  for (const credit of sorted) {
    const key = itemKey(credit)
    if (seen.has(key)) continue
    seen.add(key)
    result.push(credit)
    if (result.length >= limit) break
  }
  return result
}
