import { useId, useRef, type ReactNode } from 'react'
import { ErrorState } from './states'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'
import { useReveal } from '../lib/useReveal'

interface RailProps {
  title: string
  /** `still` rails hold 16:9 cards, `poster` rails 2:3 ones. */
  variant?: 'poster' | 'still'
  error?: unknown
  onRetry?: () => void
  /** Shown while the row's data is loading. */
  loading?: boolean
  children?: ReactNode
}

/** A titled horizontal row of cards. Swipe on touch; arrow buttons on pointer devices. */
export default function Rail({ title, variant = 'poster', error, onRetry, loading = false, children }: RailProps) {
  const trackRef = useRef<HTMLUListElement>(null)
  const revealRef = useReveal<HTMLElement>()
  const headingId = useId()
  const trackId = useId()

  const scroll = (direction: -1 | 1) => {
    const track = trackRef.current
    if (!track) return
    // Page by whole cards: the visible width minus the left padding.
    const padding = parseFloat(window.getComputedStyle(track).paddingLeft) || 0
    track.scrollBy({ left: direction * (track.clientWidth - padding * 2), behavior: 'smooth' })
  }

  if (!error && !loading && !children) return null

  return (
    <section ref={revealRef} className={`rail rail-${variant}`} aria-labelledby={headingId}>
      <div className="rail-head">
        <h2 className="rail-title section-title" id={headingId}>
          {title}
        </h2>
        {error || loading ? null : (
          <div className="rail-arrows">
            <button type="button" className="btn btn-icon" onClick={() => scroll(-1)} aria-label={`Scroll ${title} left`} aria-controls={trackId}>
              <ChevronLeftIcon />
            </button>
            <button type="button" className="btn btn-icon" onClick={() => scroll(1)} aria-label={`Scroll ${title} right`} aria-controls={trackId}>
              <ChevronRightIcon />
            </button>
          </div>
        )}
      </div>
      {error ? (
        <div className="rail-error">
          <ErrorState error={error} onRetry={onRetry} title={`Couldn't load ${title}`} />
        </div>
      ) : (
        <ul className="rail-track" ref={trackRef} id={trackId} aria-busy={loading || undefined}>
          {loading
            ? Array.from({ length: 8 }, (_, i) => (
                <li key={i} aria-hidden="true">
                  <span className="rail-skeleton skeleton" />
                </li>
              ))
            : children}
        </ul>
      )}
    </section>
  )
}
