import { useState } from 'react'

interface PlayerFrameProps {
  /** Embed URL, from `embedUrl()` in lib/embed.ts. */
  src: string
  /** Accessible name of the iframe, e.g. "Player: Show S1E2". */
  title: string
  /** Shown dimmed behind the spinner until the embed has loaded. */
  backdropUrl?: string
  /** Bump to force the iframe to reload (the embed host sometimes stalls). */
  reloadToken?: number
}

/** A 16:9 box with the embed iframe, under a loading cover until it has loaded. */
export default function PlayerFrame({ src, title, backdropUrl, reloadToken = 0 }: PlayerFrameProps) {
  return (
    <div className="player-screen">
      {/* Keyed so a new episode or a reload starts with a fresh iframe and loading state. */}
      <EmbedIframe key={`${src}#${reloadToken}`} src={src} title={title} backdropUrl={backdropUrl} />
    </div>
  )
}

function EmbedIframe({ src, title, backdropUrl }: { src: string; title: string; backdropUrl?: string }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <>
      {loaded ? null : <LoadingCover backdropUrl={backdropUrl} />}
      <iframe
        title={title}
        src={src}
        className="player-iframe"
        allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
        referrerPolicy="origin"
        allowFullScreen
        onLoad={() => setLoaded(true)}
      />
    </>
  )
}

function LoadingCover({ backdropUrl }: { backdropUrl?: string }) {
  return (
    <div className="player-cover" role="status" aria-live="polite">
      {backdropUrl ? <img src={backdropUrl} alt="" className="player-cover-img" /> : null}
      <span className="spinner" aria-hidden="true" />
      <span className="visually-hidden">Loading player…</span>
    </div>
  )
}
