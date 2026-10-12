import { useRef } from 'react'
import { useNavigate } from 'react-router'
import { PosterImage } from './OptimizedImage'
import { ErrorState } from './states'
import moviePlaceholder from '../assets/movie.png'
import type { MediaListItem } from '../api/types'
import { displayTitle, formatRating, itemKey, itemPath, tmdbImageFor } from '../lib/media'
import { onActivateKey } from '../lib/a11y'

interface CategoryRowProps {
  title: string
  items?: MediaListItem[]
  error?: unknown
  onRetry?: () => void
}

export default function CategoryRow({ title, items = [], error, onRetry }: CategoryRowProps) {
  const navigate = useNavigate()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  // Indexes already preloaded; a ref because it never affects rendering.
  const preloadedRef = useRef<Set<number>>(new Set())

  // Preload images by creating Image objects
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
    const viewportWidth = window.innerWidth
    const scrollAmount = viewportWidth < 480 ? 300 : viewportWidth < 768 ? 500 : 800

    // Calculate current visible range based on scroll position
    const cardWidth = 170 // approximate card width including gap
    const currentScrollLeft = container.scrollLeft

    if (direction === 'right') {
      // Preload the next 4 images beyond what will be visible after scroll
      const afterScrollLastVisible = Math.floor((currentScrollLeft + scrollAmount + container.clientWidth) / cardWidth)
      preloadImages(afterScrollLastVisible + 1, 4)
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
        <button className="category-arrow category-arrow-left" onClick={() => scroll('left')} aria-label={`Scroll ${title} left`}>
          ‹
        </button>
        <div className="category-scroll-container" ref={scrollContainerRef}>
          {items.map((item, index) => {
            const name = displayTitle(item)
            const open = () => navigate(itemPath(item))
            return (
              <div
                key={itemKey(item)}
                className="category-card"
                role="button"
                tabIndex={0}
                aria-label={name}
                onClick={open}
                onKeyDown={onActivateKey(open)}
                itemType="https://schema.org/Movie"
              >
                {item.poster_path ? (
                  <PosterImage
                    path={item.poster_path}
                    alt={name}
                    size="medium"
                    priority={index < 8}
                    style={{ width: '100%', height: '100%' }}
                  />
                ) : (
                  <img src={moviePlaceholder} alt={name} className="placeholder-img" width="160" height="240" />
                )}
                <div className="category-card-overlay">
                  <h4>{name}</h4>
                  <p className="category-rating">⭐ {formatRating(item.vote_average)}</p>
                </div>
              </div>
            )
          })}
        </div>
        <button className="category-arrow category-arrow-right" onClick={() => scroll('right')} aria-label={`Scroll ${title} right`}>
          ›
        </button>
      </div>
    </div>
  )
}
