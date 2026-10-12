import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import OptimizedImage, { PosterImage } from './OptimizedImage'

describe('OptimizedImage', () => {
  it('passes sizes with the TMDB srcset and lazy-loads by default', () => {
    render(<PosterImage path="/abc.jpg" alt="Dune" sizes="(max-width: 480px) 50vw, 200px" />)
    const img = screen.getByRole('img', { name: 'Dune' })
    expect(img).toHaveAttribute('sizes', '(max-width: 480px) 50vw, 200px')
    expect(img.getAttribute('srcset')).toContain('https://image.tmdb.org/t/p/w342/abc.jpg 342w')
    expect(img).toHaveAttribute('src', 'https://image.tmdb.org/t/p/w342/abc.jpg')
    expect(img).toHaveAttribute('loading', 'lazy')
    expect(img).not.toHaveAttribute('fetchpriority')
  })

  it('loads priority images eagerly with high fetch priority', () => {
    render(<OptimizedImage tmdbPath="/hero.jpg" tmdbType="backdrop" tmdbSize="large" sizes="100vw" priority alt="Hero" />)
    const img = screen.getByRole('img', { name: 'Hero' })
    expect(img).toHaveAttribute('loading', 'eager')
    expect(img).toHaveAttribute('fetchpriority', 'high')
    expect(img).toHaveAttribute('sizes', '100vw')
    expect(img.getAttribute('srcset')).toContain('w1280/hero.jpg 1280w')
  })

  it('does not let callers override internal attributes', () => {
    // Spread first: a caller-provided decoding/loading can't break the component.
    render(<PosterImage path="/abc.jpg" alt="X" sizes="200px" decoding="sync" />)
    expect(screen.getByRole('img', { name: 'X' })).toHaveAttribute('decoding', 'async')
  })

  it('resets the loaded state when the path changes', () => {
    const { rerender } = render(<PosterImage path="/one.jpg" alt="Poster" sizes="200px" />)
    const first = screen.getByRole('img', { name: 'Poster' })
    fireEvent.load(first)
    expect(first).toHaveClass('is-loaded')

    rerender(<PosterImage path="/two.jpg" alt="Poster" sizes="200px" />)
    const second = screen.getByRole('img', { name: 'Poster' })
    expect(second).toHaveAttribute('src', 'https://image.tmdb.org/t/p/w342/two.jpg')
    expect(second).not.toHaveClass('is-loaded')
  })

  it('recovers from an error when the path changes', () => {
    const { rerender } = render(<PosterImage path="/broken.jpg" alt="Poster" sizes="200px" />)
    fireEvent.error(screen.getByRole('img', { name: 'Poster' }))
    expect(screen.queryByRole('img', { name: 'Poster' })).not.toBeInTheDocument()

    rerender(<PosterImage path="/fixed.jpg" alt="Poster" sizes="200px" />)
    expect(screen.getByRole('img', { name: 'Poster' })).toHaveAttribute('src', 'https://image.tmdb.org/t/p/w342/fixed.jpg')
  })
})
