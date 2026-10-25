import { cleanup, render } from '@testing-library/react'
import Seo from './Seo'
import { SITE_URL } from '../config'
import { removeSeoFallback } from '../lib/seo'

function head(selector: string): Element[] {
  return Array.from(document.head.querySelectorAll(selector))
}

describe('Seo', () => {
  afterEach(() => {
    // Unmount first so React removes its own hoisted nodes, then drop anything a test added by hand.
    cleanup()
    document.head.innerHTML = ''
  })

  it('hoists title, description, canonical and social tags into <head>', () => {
    render(<Seo title="Dune (2021)" description="Spice." path="/movie/438631?ref=x" image="https://img/x.jpg" type="video.movie" />)

    expect(document.title).toBe('Dune (2021) | AnyVod')
    expect(head('link[rel="canonical"]').map((l) => l.getAttribute('href'))).toEqual([`${SITE_URL}/movie/438631`])
    expect(head('meta[property="og:url"]')[0]?.getAttribute('content')).toBe(`${SITE_URL}/movie/438631`)
    expect(head('meta[property="og:type"]')[0]?.getAttribute('content')).toBe('video.movie')
    expect(head('meta[property="og:image"]')[0]?.getAttribute('content')).toBe('https://img/x.jpg')
    expect(head('meta[name="twitter:image"]')[0]?.getAttribute('content')).toBe('https://img/x.jpg')
    expect(head('meta[name="description"]')[0]?.getAttribute('content')).toBe('Spice.')
    expect(head('meta[name="robots"]')[0]?.getAttribute('content')).toMatch(/^index, follow/)
  })

  it('emits noindex and falls back to the default image', () => {
    render(<Seo title="Search: dune" path="/search" noindex />)

    expect(head('meta[name="robots"]').map((m) => m.getAttribute('content'))).toEqual(['noindex, follow'])
    expect(head('meta[property="og:image"]')[0]?.getAttribute('content')).toBe(`${SITE_URL}/og-image.png`)
  })

  it('removes its tags on unmount and does not stack across pages', () => {
    const { rerender, unmount } = render(<Seo title="A" path="/a" />)
    rerender(<Seo title="B" path="/b" />)
    expect(head('title')).toHaveLength(1)
    expect(head('link[rel="canonical"]').map((l) => l.getAttribute('href'))).toEqual([`${SITE_URL}/b`])
    unmount()
    expect(head('title')).toHaveLength(0)
    expect(head('link[rel="canonical"]')).toHaveLength(0)
  })

  // Documents why index.html carries no static <title>: React 19 inserts its
  // hoisted <title> alongside (before) an existing one instead of replacing it.
  it('does not replace a pre-existing static <title>', () => {
    const staticTitle = document.createElement('title')
    staticTitle.textContent = 'Static'
    document.head.appendChild(staticTitle)

    render(<Seo title="Page" path="/" />)

    expect(head('title').map((t) => t.textContent)).toEqual(['Page | AnyVod', 'Static'])
  })

  it('drops the index.html crawler fallbacks so page tags are the only ones', () => {
    document.head.innerHTML =
      '<title data-seo-fallback>Static</title><meta data-seo-fallback property="og:image" content="/x.png" /><meta property="og:site_name" content="AnyVod" />'

    removeSeoFallback()
    render(<Seo title="Page" path="/" />)

    expect(head('title').map((t) => t.textContent)).toEqual(['Page | AnyVod'])
    expect(head('meta[property="og:image"]')).toHaveLength(1)
    expect(head('meta[property="og:site_name"]')).toHaveLength(1)
  })
})
