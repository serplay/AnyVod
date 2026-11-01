import { SITE_URL } from '../config'

/** Absolute URL on the public site for a route path (query/hash stripped). */
export function canonicalUrl(path: string, siteUrl: string = SITE_URL): string {
  const clean = (path.split(/[?#]/)[0] ?? '').trim()
  const withSlash = clean.startsWith('/') ? clean : `/${clean}`
  return `${siteUrl}${withSlash}`
}

export { truncate } from './seoText'

/**
 * Remove the static head tags index.html ships for crawlers that don't run JS.
 * Must run before the first render: React's hoisted tags don't replace them.
 */
export function removeSeoFallback(doc: Document = document): void {
  doc.head.querySelectorAll('[data-seo-fallback]').forEach((el) => el.remove())
}
