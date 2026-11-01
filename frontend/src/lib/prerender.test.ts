import { describe, expect, it } from 'vitest'
import { escapeHtml, formatMinutes, headTags, homeBody, injectPage, titleBody, trimDetails } from './prerender'

const TEMPLATE = `<!doctype html>
<html>
  <head>
    <title data-seo-fallback>Site</title>
    <meta data-seo-fallback name="description" content="home" />
    <script type="module" src="/assets/index.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`

describe('prerender helpers', () => {
  it('escapes HTML', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;')
  })

  it('replaces fallback head tags and fills #root with the body and seed', () => {
    const head = headTags({ title: 'T <1>', description: 'D "q"', url: 'https://s/movie/1', type: 'video.movie', jsonLd: '{}' })
    const html = injectPage(TEMPLATE, { head, body: '<p>hi</p>', seed: { key: ['details', 'movie', '1'], data: { t: '</script>' }, at: 5 } })
    expect(html).not.toContain('content="home"')
    expect(html).toContain('<title data-seo-fallback>T &lt;1&gt;</title>')
    expect(html).toContain('content="D &quot;q&quot;"')
    expect(html).toContain('<link data-seo-fallback rel="canonical" href="https://s/movie/1" />')
    expect(html).toContain('<div id="root"><p>hi</p></div>')
    expect(html).toContain('<script type="application/json" id="prerender-data">{"key":["details","movie","1"],"data":{"t":"\\u003c/script>"},"at":5}</script>')
    // Every injected head tag is removable by main.tsx's removeSeoFallback.
    const headPart = html.slice(html.indexOf('<head>'), html.indexOf('</head>'))
    for (const line of headPart.split('\n').filter((l) => /<(title|meta|link|script type="application\/ld)/.test(l))) {
      expect(line).toContain('data-seo-fallback')
    }
  })

  it('keeps the shell head when only a body is given', () => {
    const html = injectPage(TEMPLATE, { body: homeBody('Home', [{ title: 'Popular', items: [{ href: '/movie/1', label: 'A & B' }] }, { title: 'Empty', items: [] }]) })
    expect(html).toContain('content="home"')
    expect(html).toContain('<h2>Popular</h2><ul><li><a href="/movie/1">A &amp; B</a></li></ul>')
    expect(html).not.toContain('Empty')
  })

  it('renders title content', () => {
    const body = titleBody({
      heading: 'Heat (1995)',
      facts: ['1995', '2h 50m'],
      overview: 'Cops & robbers',
      watchHref: '/player/movie/949',
      watchLabel: 'Watch Heat',
      cast: [{ href: '/person/1158', name: 'Al Pacino', character: 'Hanna' }],
      related: [{ href: '/movie/2', label: 'Other' }],
      siteName: 'AnyVod',
    })
    expect(body).toContain('<h1>Heat (1995)</h1>')
    expect(body).toContain('Cops &amp; robbers')
    expect(body).toContain('<a href="/person/1158">Al Pacino</a> as Hanna')
    expect(body).toContain('<h2>More to watch</h2>')
  })

  it('trims details to the fields the page uses', () => {
    const t = trimDetails({
      id: 1,
      title: 'X',
      images: { backdrops: [1, 2, 3] },
      credits: { cast: Array.from({ length: 30 }, (_, i) => ({ id: i })), crew: [{ job: 'Director' }, { job: 'Editor' }] },
      videos: { results: [{ site: 'YouTube' }, { site: 'Vimeo' }] },
    })
    expect(t).not.toHaveProperty('images')
    expect((t.credits as { cast: unknown[] }).cast).toHaveLength(20)
    expect((t.credits as { crew: unknown[] }).crew).toEqual([{ job: 'Director' }])
    expect((t.videos as { results: unknown[] }).results).toEqual([{ site: 'YouTube' }])
  })

  it('formats minutes', () => {
    expect(formatMinutes(170)).toBe('2h 50m')
    expect(formatMinutes(45)).toBe('45m')
    expect(formatMinutes(120)).toBe('2h')
    expect(formatMinutes(null)).toBeUndefined()
  })
})
