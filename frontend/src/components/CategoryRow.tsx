import { useRef } from 'react'
import { Link } from 'react-router'
import { PosterImage } from './OptimizedImage'
import { ErrorState } from './states'
import moviePlaceholder from '../assets/movie.png'
import type { MediaListItem } from '../api/types'
import { displayTitle, formatRating, itemKey, itemPath, tmdbImageFor } from '../lib/media'

/** Rendered card widths from category-row.css / responsive.css / mobile.css. */
const CATEGORY_CARD_SIZES = '(max-width: 374px) 120px, (max-width: 767px) 160px, (max-width: 1024px) 180px, 200px'

/** Fallback when the row has no rendered card to measure (card width + gap). */
const FALLBACK_STEP = 212
const PRELOAD_AHEAD = 4

interface CategoryRowProps {
  title: string
  items?: MediaListItem[]
  error?: unknown
  onRetry?: () => void
  /** How many leading cards load eagerly with high priority (above the fold). */
  priorityCount?: number
}

/** Width of one card plus the flex gap, measured from the DOM. */
function measureStep(container: HTMLElement): number {
  const card = container.querySelector<HTMLElement>('.category-card')
  if (!card) return FALLBACK_STEP
  const styles = window.getComputedStyle(container)
  const gap = parseFloat(styles.columnGap || styles.gap || '0') || 0
  return card.offsetWidth + gap || FALLBACK_STEP
}

export default function CategoryRow({ title, items = [], error, onRetry, priorityCount = 0 }: CategoryRowProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  // Indexes already preloaded; a ref because it never affects rendering.
  const preloadedRef = useRef<Set<number>>(new Set())

  const preloadImages = (startIndex: number, count: number) => {
    const preloaded = preloadedRef.current
    for (let i = startIndex; i < Math.min(startIndex + count, items.length); i++) {
      const src = tmdbImageFor(items[i]?.poster_path, 'poster', 'medium')
      if (!preloaded.has(i) && src) {
        const img = new Image()
        img.src = src
        preloaded.add(i)
      }
    }
  }

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current
    if (!container) return
    const step = measureStep(container)
    // Page by the number of whole cards that fit in the viewport.
    const visibleCards = Math.max(1, Math.floor(container.clientWidth / step))
    const scrollAmount = visibleCards * step

    if (direction === 'right') {
      const lastVisibleAfterScroll = Math.floor((container.scrollLeft + scrollAmount + container.clientWidth) / step)
      preloadImages(lastVisibleAfterScroll + 1, PRELOAD_AHEAD)
    }

    container.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' })
  }

  if (error) {
    return (
      <div className="category-row">
        <h2 className="category-title">{title}</h2>
        <ErrorState error={error} onRetry={onRetry} title={`Couldn't load ${title}`} />
      </div>
    )
  }

  if (items.length === 0) return null

  return (
    <div className="category-row">
      <h2 className="category-title">{title}</h2>
      <div className="category-slider-wrapper">
        <button
          type="button"
          className="category-arrow category-arrow-left"
          onClick={() => scroll('left')}
          aria-label={`Scroll ${title} left`}
        >
          <span aria-hidden="true">‹</span>
        </button>
        <div className="category-scroll-container" ref={scrollContainerRef}>
          {items.map((item, index) => {
            const name = displayTitle(item)
            return (
              <Link key={itemKey(item)} to={itemPath(item)} className="category-card" aria-label={name}>
                {item.poster_path ? (
                  <PosterImage
                    path={item.poster_path}
                    alt=""
                    size="medium"
                    sizes={CATEGORY_CARD_SIZES}
                    priority={index < priorityCount}
                    className="oi-fill"
                  />
                ) : (
                  <img src={moviePlaceholder} alt="" className="placeholder-img" width="160" height="240" loading="lazy" />
                )}
                <div className="category-card-overlay" aria-hidden="true">
                  <h4>{name}</h4>
                  <p className="category-rating">⭐ {formatRating(item.vote_average)}</p>
                </div>
              </Link>
            )
          })}
        </div>
        <button
          type="button"
          className="category-arrow category-arrow-right"
          onClick={() => scroll('right')}
          aria-label={`Scroll ${title} right`}
        >
          <span aria-hidden="true">›</span>
        </button>
      </div>
    </div>
  )
}
