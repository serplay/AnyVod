/**
 * Page titles and meta descriptions shared by the React pages and scripts/prerender.ts, so the
 * prerendered HTML and the hydrated page always agree. Import-free so Node can run it directly
 * with `--experimental-strip-types`.
 */

/** Collapse whitespace and cut to at most `max` chars on a word boundary, adding an ellipsis. */
export function truncate(text: string | null | undefined, max = 155): string {
  const flat = (text ?? '').replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut
  return `${base.replace(/[\s.,;:!?-]+$/, '')}…`
}

interface TitleText {
  title?: string
  name?: string
  overview?: string
  release_date?: string
  first_air_date?: string
  genres?: readonly { name: string }[]
}

/** "Name (Year)", or just the name when the year is unknown. */
export function titleWithYear(kind: 'movie' | 'tv', d: TitleText): string {
  const name = (kind === 'movie' ? d.title : d.name) || d.title || d.name || ''
  const year = (kind === 'movie' ? d.release_date : d.first_air_date)?.slice(0, 4)
  return year && /^\d{4}$/.test(year) ? `${name} (${year})` : name
}

/** `<title>` text (without the site suffix) for a movie or TV detail page. */
export function titleSeoTitle(kind: 'movie' | 'tv', d: TitleText): string {
  return `${titleWithYear(kind, d)} - Watch ${kind === 'tv' ? 'TV Show' : 'Movie'} Online`
}

/** Meta description: what it is (year, genres) first, then the plot, within ~155 chars. */
export function titleSeoDescription(kind: 'movie' | 'tv', d: TitleText): string {
  const genres = (d.genres ?? [])
    .slice(0, 3)
    .map((g) => g.name)
    .join(', ')
  const lead = `${titleWithYear(kind, d)}${genres ? ` · ${genres}` : ''}.`
  return truncate(d.overview ? `${lead} ${d.overview}` : `${lead} Watch it online on AnyVod.`)
}

/** Meta description for a person page. */
export function personSeoDescription(p: { name: string; biography?: string; known_for_department?: string | null }): string {
  const role = p.known_for_department === 'Acting' ? 'Actor' : p.known_for_department
  const lead = `${p.name}${role ? ` · ${role}` : ''}.`
  return truncate(p.biography ? `${lead} ${p.biography}` : `${lead} Movies and TV shows on AnyVod.`)
}
