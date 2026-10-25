import { SITE_URL } from '../config'

/** Absolute URL on the public site for a route path (query/hash stripped). */
export function canonicalUrl(path: string, siteUrl: string = SITE_URL): string {
  const clean = (path.split(/[?#]/)[0] ?? '').trim()
  const withSlash = clean.startsWith('/') ? clean : `/${clean}`
  return `${siteUrl}${withSlash}`
}

/** Collapse whitespace and cut to at most `max` chars on a word boundary, adding an ellipsis. */
export function truncate(text: string | null | undefined, max = 155): string {
  const flat = (text ?? '').replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut
  return `${base.replace(/[\s.,;:!?-]+$/, '')}…`
}

/**
 * Remove the static head tags index.html ships for crawlers that don't run JS.
 * Must run before the first render: React's hoisted tags don't replace them.
 */
export function removeSeoFallback(doc: Document = document): void {
  doc.head.querySelectorAll('[data-seo-fallback]').forEach((el) => el.remove())
}
