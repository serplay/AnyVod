import { useEffect, useRef, type MouseEvent } from 'react'
import { Link } from 'react-router'
import { PosterImage, ProfileImage } from './OptimizedImage'
import moviePlaceholder from '../assets/movie.png'
import type { MediaListItem } from '../api/types'
import { displayTitle, isPerson, itemKey, itemPath, releaseDate } from '../lib/media'

/** Grid cells are minmax(160px, 1fr) inside a 1200px app; 2 columns on phones. */
const MOVIE_CARD_SIZES = '(max-width: 480px) 50vw, 200px'
const MAX_TILT_DEG = 12

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

interface MovieListProps {
  movies?: MediaListItem[]
  /** Link target per card; defaults to the item's detail page. */
  hrefFor?: (item: MediaListItem) => string
}

export default function MovieList({ movies = [], hrefFor = itemPath }: MovieListProps) {
  return (
    <div className="movie-grid">
      {movies.map((m) => (
        <MovieCard key={itemKey(m)} item={m} href={hrefFor(m)} />
      ))}
    </div>
  )
}

function MovieCard({ item, href }: { item: MediaListItem; href: string }) {
  const innerRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<number | null>(null)
  const pointerRef = useRef<{ x: number; y: number; rect: DOMRect } | null>(null)

  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    },
    [],
  )

  const applyTilt = () => {
    frameRef.current = null
    const inner = innerRef.current
    const p = pointerRef.current
    if (!inner || !p) return
    const cx = p.rect.width / 2
    const cy = p.rect.height / 2
    const dx = (p.x - p.rect.left - cx) / cx
    const dy = (p.y - p.rect.top - cy) / cy
    const tiltX = (-dy * MAX_TILT_DEG).toFixed(2)
    const tiltY = (dx * MAX_TILT_DEG).toFixed(2)
    inner.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateZ(8px)`
  }

  const handleMove = (e: MouseEvent<HTMLAnchorElement>) => {
    if (prefersReducedMotion()) return
    pointerRef.current = { x: e.clientX, y: e.clientY, rect: e.currentTarget.getBoundingClientRect() }
    // At most one style write per frame.
    if (frameRef.current === null) frameRef.current = requestAnimationFrame(applyTilt)
  }

  const handleLeave = () => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    pointerRef.current = null
    if (innerRef.current) innerRef.current.style.transform = ''
  }

  const name = displayTitle(item)
  const person = isPerson(item)
  const imagePath = person ? item.profile_path : item.poster_path
  const CardImage = person ? ProfileImage : PosterImage

  return (
    <Link to={href} className="movie-card" onMouseMove={handleMove} onMouseLeave={handleLeave}>
      <div className="movie-card-inner" ref={innerRef}>
        {imagePath ? (
          <CardImage path={imagePath} alt="" size="medium" sizes={MOVIE_CARD_SIZES} className="oi-rounded" />
        ) : (
          <img src={moviePlaceholder} alt="" className="placeholder-img" loading="lazy" />
        )}
        <div className="meta">
          <h3>{name}</h3>
          {person ? null : <p>{releaseDate(item)}</p>}
        </div>
      </div>
    </Link>
  )
}
