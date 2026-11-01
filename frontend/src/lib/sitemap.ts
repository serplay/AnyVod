/**
 * Pure sitemap builder shared by scripts/prerender.ts and the tests.
 * Keep this file free of imports and non-erasable TS syntax so Node can run it
 * directly with `--experimental-strip-types`.
 */

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** `YYYY-MM-DD` in UTC. */
export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/** Render a sitemap for absolute `urls` (deduplicated), each with `lastmod` set to `date`. */
export function buildSitemap(urls: readonly string[], date: Date): string {
  const lastmod = isoDate(date)
  const unique = [...new Set(urls)]
  const body = unique
    .map((url) => {
      const isHome = new URL(url).pathname === '/'
      return [
        '  <url>',
        `    <loc>${escapeXml(url)}</loc>`,
        `    <lastmod>${lastmod}</lastmod>`,
        `    <changefreq>${isHome ? 'daily' : 'weekly'}</changefreq>`,
        `    <priority>${isHome ? '1.0' : '0.8'}</priority>`,
        '  </url>',
      ].join('\n')
    })
    .join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
}
