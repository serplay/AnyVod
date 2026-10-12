import type { MouseEvent } from 'react'
import { PosterImage } from './OptimizedImage'
import moviePlaceholder from '../assets/movie.png'
import type { MediaListItem } from '../api/types'
import { displayTitle, itemKey, releaseDate } from '../lib/media'
import { onActivateKey } from '../lib/a11y'

interface MovieListProps {
  movies?: MediaListItem[]
  onSelect?: (item: MediaListItem) => void
}

const noop = () => {}

export default function MovieList({ movies = [], onSelect = noop }: MovieListProps) {
  const handleMove = (e: MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget
    const inner = card.querySelector<HTMLElement>('.movie-card-inner')
    if (!inner) return
    const rect = card.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const cx = rect.width / 2
    const cy = rect.height / 2
    const dx = (x - cx) / cx
    const dy = (y - cy) / cy
    const max = 12 // max degrees
    const tiltX = (-dy * max).toFixed(2)
    const tiltY = (dx * max).toFixed(2)
    inner.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateZ(8px)`
  }

  const handleLeave = (e: MouseEvent<HTMLDivElement>) => {
    const inner = e.currentTarget.querySelector<HTMLElement>('.movie-card-inner')
    if (inner) inner.style.transform = ''
  }

  return (
    <div className="movie-grid">
      {movies.map((m) => {
        const name = displayTitle(m)
        const select = () => onSelect(m)
        return (
          <div
            key={itemKey(m)}
            className="movie-card"
            role="button"
            tabIndex={0}
            onClick={select}
            onKeyDown={onActivateKey(select)}
            onMouseMove={handleMove}
            onMouseLeave={handleLeave}
            itemType="https://schema.org/Movie"
          >
            <div className="movie-card-inner">
              {m.poster_path ? (
                <PosterImage path={m.poster_path} alt={name} size="medium" style={{ borderRadius: '8px' }} />
              ) : (
                <img src={moviePlaceholder} alt={name} className="placeholder-img" />
              )}
              <div className="meta">
                <h3>{name}</h3>
                <p>{releaseDate(m)}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
