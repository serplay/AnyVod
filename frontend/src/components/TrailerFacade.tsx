import { useState } from 'react'

interface TrailerFacadeProps {
  videoKey: string
  /** Title of the movie/show, used for the accessible names. */
  title: string
}

/**
 * Click-to-load YouTube trailer: shows the video thumbnail and a play button,
 * and only mounts the (privacy-enhanced, youtube-nocookie.com) iframe on click,
 * so the page doesn't pay for YouTube's player until the user asks for it.
 */
export default function TrailerFacade({ videoKey, title }: TrailerFacadeProps) {
  const [active, setActive] = useState(false)
  const key = encodeURIComponent(videoKey)
  const label = title ? `${title} trailer` : 'Trailer'

  return (
    <div className="trailer-embed">
      {active ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${key}?autoplay=1&rel=0`}
          title={`YouTube video player: ${label}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        <button type="button" className="trailer-facade" onClick={() => setActive(true)} aria-label={`Play ${label}`}>
          <img
            className="trailer-facade-thumb"
            src={`https://i.ytimg.com/vi/${key}/hqdefault.jpg`}
            alt=""
            loading="lazy"
            decoding="async"
          />
          <span className="trailer-facade-play" aria-hidden="true">
            ▶
          </span>
        </button>
      )}
    </div>
  )
}
