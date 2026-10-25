import { useState } from 'react'
import { ErrorState } from './states'
import type { EmbedResponse } from '../api/types'

interface PlayerFrameProps {
  embed: EmbedResponse | undefined
  error: unknown
  onRetry: () => void
  /** Accessible name of the iframe, e.g. "Player: Show S1E2". */
  title: string
  /** Shown dimmed behind the spinner until the embed has loaded. */
  backdropUrl?: string
  /** Bump to force the iframe to reload (the embed host sometimes stalls). */
  reloadToken?: number
}

/** A 16:9 box with the embed iframe, or its loading / error state. */
export default function PlayerFrame({ embed, error, onRetry, title, backdropUrl, reloadToken = 0 }: PlayerFrameProps) {
  return (
    <div className="player-screen">
      {error ? (
        <ErrorState error={error} onRetry={onRetry} title="Couldn't load the player" className="player-state" />
      ) : embed?.embed_url ? (
        // Keyed so a new episode or a reload starts with a fresh iframe and loading state.
        <EmbedIframe key={`${embed.embed_url}#${reloadToken}`} src={embed.embed_url} title={title} backdropUrl={backdropUrl} />
      ) : (
        <LoadingCover backdropUrl={backdropUrl} />
      )}
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
