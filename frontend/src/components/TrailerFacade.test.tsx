import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import TrailerFacade from './TrailerFacade'

describe('TrailerFacade', () => {
  it('shows a thumbnail and only mounts the iframe after a click', () => {
    const { container } = render(<TrailerFacade videoKey="abc123" title="Dune" />)

    expect(container.querySelector('iframe')).toBeNull()
    const thumb = container.querySelector('img')
    expect(thumb).toHaveAttribute('src', 'https://i.ytimg.com/vi/abc123/hqdefault.jpg')

    fireEvent.click(screen.getByRole('button', { name: 'Play Dune trailer' }))

    const iframe = screen.getByTitle('YouTube video player: Dune trailer')
    expect(iframe.tagName).toBe('IFRAME')
    expect(iframe).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/abc123?autoplay=1&rel=0')
    expect(iframe.getAttribute('allow')).toContain('autoplay')
    expect(screen.queryByRole('button', { name: 'Play Dune trailer' })).not.toBeInTheDocument()
  })
})
