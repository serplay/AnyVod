import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Navigate, useLocation, useNavigate, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import VideoSchema from '../components/VideoSchema'
import Seo from '../components/Seo'
import PlayerFrame from '../components/PlayerFrame'
import EpisodePanel from '../components/EpisodePanel'
import {
  ArrowLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EpisodesIcon,
  ExitFullscreenIcon,
  FullscreenIcon,
  ReloadIcon,
} from '../components/icons'
import { truncate } from '../lib/seo'
import NotFound from './NotFound'
import { seasonQueryOptions, useDetails, useEmbed, useSeason } from '../api/hooks'
import type { MediaKind } from '../api/types'
import {
  displayTitle,
  formatYear,
  isMediaKind,
  parseNonNegativeInt,
  seasonsOf,
  tmdbImage,
  tmdbImageFor,
} from '../lib/media'
import {
  episodeLabel,
  episodePath,
  loadLastEpisode,
  nextEpisode,
  previousEpisode,
  saveLastEpisode,
  type EpisodeRef,
} from '../lib/episodes'

const DEFAULT_SEASON = 1
const DEFAULT_EPISODE = 1
const PANEL_STORAGE_KEY = 'anyvod:player-panel'

/**
 * Route entry for /player/:kind/:id and /player/:kind/:id/:season/:episode.
 * The URL is the single source of truth for which episode plays; changing
 * episode/season navigates (with `replace`, so Back leaves the player).
 * /player/tv/:id without an episode resumes the last episode opened.
 */
export default function PlayerRoute() {
  const params = useParams()
  const kind = params.kind
  const id = parseNonNegativeInt(params.id)
  const hasEpisodeParams = params.season !== undefined || params.episode !== undefined
  const season = parseNonNegativeInt(params.season)
  const episode = parseNonNegativeInt(params.episode)

  if (!isMediaKind(kind) || id === undefined || id === 0) return <NotFound />
  if (hasEpisodeParams && (kind !== 'tv' || season === undefined || episode === undefined || episode === 0)) {
    return <NotFound />
  }

  if (kind === 'movie') return <MoviePlayer key={`movie-${id}`} id={id} />
  if (!hasEpisodeParams) {
    const last = loadLastEpisode(id)
    if (last) return <Navigate to={episodePath(id, last)} replace />
  }
  return (
    <TvPlayer
      key={`tv-${id}`}
      id={id}
      current={{ season: season ?? DEFAULT_SEASON, episode: episode ?? DEFAULT_EPISODE }}
    />
  )
}

/**
 * Leave the player: back to wherever the user came from when that was inside
 * the app, otherwise (deep link, new tab) to the title's detail page.
 */
function useExitPlayer(kind: MediaKind, id: number) {
  const navigate = useNavigate()
  const location = useLocation()
  return () => {
    if (location.key !== 'default') void navigate(-1)
    else void navigate(`/${kind}/${id}`, { replace: true })
  }
}

/** Desktop preference: is the episode panel collapsed? (Phones always show it below the video.) */
function usePanelCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(PANEL_STORAGE_KEY) === 'collapsed'
    } catch {
      return false
    }
  })
  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem(PANEL_STORAGE_KEY, next ? 'collapsed' : 'open')
    } catch {
      // Blocked storage: the preference just doesn't persist.
    }
  }
  return [collapsed, toggle] as const
}

/** Locks orientation where the browser allows it (Android Chrome); `lock` is missing from older TS DOM types. */
type LockableOrientation = ScreenOrientation & { lock?: (orientation: string) => Promise<void> }

/**
 * Our own fullscreen for the stage, plus a landscape lock on phones.
 * Only offered where element fullscreen works (not iPhone Safari, which keeps
 * the embed's own button).
 */
function useStageFullscreen(stageRef: RefObject<HTMLDivElement | null>) {
  const supported = typeof document !== 'undefined' && document.fullscreenEnabled === true
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (!supported) return
    const update = () => setActive(document.fullscreenElement === stageRef.current)
    document.addEventListener('fullscreenchange', update)
    return () => document.removeEventListener('fullscreenchange', update)
  }, [supported, stageRef])

  const toggle = async () => {
    const stage = stageRef.current
    if (!stage) return
    if (document.fullscreenElement) {
      screen.orientation?.unlock?.()
      await document.exitFullscreen().catch(() => undefined)
      return
    }
    try {
      await stage.requestFullscreen()
      await (screen.orientation as LockableOrientation | undefined)?.lock?.('landscape')
    } catch {
      // Orientation lock is refused on desktops and some phones; fullscreen alone is fine.
    }
  }

  return { supported, active, toggle }
}

interface PlayerShellProps {
  className?: string
  title: string
  subtitle?: ReactNode
  onExit: () => void
  onReload: () => void
  /** Extra buttons on the right of the top bar. */
  actions?: ReactNode
  /** Below the video (TV: episode navigation). */
  below?: ReactNode
  /** Beside the video on wide screens, below it on phones. */
  aside?: ReactNode
  /** Head tags and structured data. */
  meta?: ReactNode
  children: ReactNode
}

function PlayerShell({ className = '', title, subtitle, onExit, onReload, actions, below, aside, meta, children }: PlayerShellProps) {
  const stageRef = useRef<HTMLDivElement>(null)
  const fullscreen = useStageFullscreen(stageRef)
  return (
    <div className={`player-page ${className}`.trim()}>
      {meta}
      <div className="player-bar">
        <button type="button" className="btn btn-icon" onClick={onExit} aria-label="Back" title="Back">
          <ArrowLeftIcon />
        </button>
        <div className="player-heading">
          <h1 className="player-title">{title}</h1>
          {subtitle ? <p className="player-subtitle">{subtitle}</p> : null}
        </div>
        <div className="player-bar-actions">
          {fullscreen.supported ? (
            <button
              type="button"
              className="btn btn-icon"
              onClick={() => void fullscreen.toggle()}
              aria-label={fullscreen.active ? 'Exit full screen' : 'Full screen'}
              title={fullscreen.active ? 'Exit full screen' : 'Full screen'}
            >
              {fullscreen.active ? <ExitFullscreenIcon /> : <FullscreenIcon />}
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-icon"
            onClick={onReload}
            aria-label="Reload player"
            title="Reload player (if the video stalls)"
          >
            <ReloadIcon />
          </button>
          {actions}
        </div>
      </div>
      <div className="player-layout">
        {/* A section, not <main>: the app shell already renders one. */}
        <section className="player-primary" aria-label="Player">
          <div className="player-stage" ref={stageRef}>
            {children}
          </div>
          {below}
        </section>
        {aside}
      </div>
    </div>
  )
}

function MoviePlayer({ id }: { id: number }) {
  const { data: details } = useDetails('movie', id)
  const embedQuery = useEmbed('movie', id)
  const onExit = useExitPlayer('movie', id)
  const [reloadToken, setReloadToken] = useState(0)
  const movieTitle = details ? displayTitle(details) : ''
  const year = formatYear(details?.release_date)
  const subtitle = [year, details?.runtime ? `${details.runtime} min` : undefined].filter(Boolean).join(' · ')

  return (
    <PlayerShell
      className="player-page-movie"
      title={movieTitle}
      subtitle={subtitle || undefined}
      onExit={onExit}
      onReload={() => setReloadToken((n) => n + 1)}
      meta={
        <>
          {/* Thin page: canonicalised to the detail page (robots.txt also disallows /player/). */}
          <Seo
            title={movieTitle ? `Watch ${movieTitle}` : 'Watch movie'}
            description={truncate(details?.overview) || undefined}
            path={`/movie/${id}`}
            image={tmdbImage(details?.poster_path ?? details?.backdrop_path, 'w780')}
            type="video.movie"
          />
          <VideoSchema
            name={movieTitle}
            description={`Watch ${movieTitle} online`}
            thumbnailUrl={tmdbImageFor(details?.poster_path, 'poster', 'large')}
            embedUrl={embedQuery.data?.embed_url || window.location.href}
            type="movie"
          />
        </>
      }
    >
      <PlayerFrame
        embed={embedQuery.data}
        error={embedQuery.error}
        onRetry={() => void embedQuery.refetch()}
        title={`Player: ${movieTitle || 'movie'}`}
        backdropUrl={tmdbImageFor(details?.backdrop_path, 'backdrop', 'medium')}
        reloadToken={reloadToken}
      />
    </PlayerShell>
  )
}

function TvPlayer({ id, current }: { id: number; current: EpisodeRef }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: tvDetails } = useDetails('tv', id)
  const { data: seasonData } = useSeason(id, current.season)
  const embedQuery = useEmbed('tv', id, current.season, current.episode)
  const onExit = useExitPlayer('tv', id)
  const [reloadToken, setReloadToken] = useState(0)
  const [panelCollapsed, togglePanel] = usePanelCollapsed()
  const panelId = useId()

  const showTitle = tvDetails ? displayTitle(tvDetails) : ''
  const seasons = seasonsOf(tvDetails)
  const episodeData = seasonData?.episodes.find((ep) => ep.episode_number === current.episode)
  const next = nextEpisode(current, seasons, seasonData?.episodes.length)
  const prev = previousEpisode(current, seasons)
  const nextData = next?.season === current.season ? seasonData?.episodes.find((ep) => ep.episode_number === next.episode) : undefined
  const { season, episode } = current

  useEffect(() => {
    saveLastEpisode(id, { season, episode })
  }, [id, season, episode])

  const goTo = (ref: EpisodeRef) => void navigate(episodePath(id, ref), { replace: true })

  const goToPrevious = async () => {
    if (!prev) return
    let target = prev.episode
    if (target === undefined) {
      try {
        const data = await queryClient.fetchQuery(seasonQueryOptions(id, prev.season))
        target = data.episodes.length
      } catch {
        // Unknown episode count; fall back to the first episode of that season.
      }
    }
    goTo({ season: prev.season, episode: Math.max(1, target ?? 1) })
  }

  const episodeTitle = `${showTitle || 'TV show'} S${season}E${episode}`

  return (
    <PlayerShell
      className={`player-page-tv${panelCollapsed ? ' is-panel-collapsed' : ''}`}
      title={showTitle}
      subtitle={
        <>
          <span className="player-subtitle-ep">{episodeLabel(current)}</span>
          {episodeData?.name ? <span> · {episodeData.name}</span> : null}
        </>
      }
      onExit={onExit}
      onReload={() => setReloadToken((n) => n + 1)}
      actions={
        <button
          type="button"
          className="btn btn-icon player-panel-toggle"
          onClick={togglePanel}
          aria-expanded={!panelCollapsed}
          aria-controls={panelId}
          aria-label={panelCollapsed ? 'Show episodes' : 'Hide episodes'}
          title={panelCollapsed ? 'Show episodes' : 'Hide episodes'}
        >
          <EpisodesIcon />
        </button>
      }
      below={
        <nav className="episode-nav" aria-label="Episode navigation">
          <button
            type="button"
            className="btn"
            onClick={() => void goToPrevious()}
            disabled={!prev}
            aria-label="Previous episode"
          >
            <ChevronLeftIcon />
            <span className="episode-nav-label-prev">Previous</span>
          </button>
          <button
            type="button"
            className="btn btn-primary episode-nav-next"
            onClick={() => next && goTo(next)}
            disabled={!next}
            aria-label={next ? `Next episode: ${episodeLabel(next)}${nextData?.name ? `, ${nextData.name}` : ''}` : 'Next episode'}
          >
            <span className="episode-nav-text">
              <span className="episode-nav-label">Next episode</span>
              {next ? (
                <span className="episode-nav-detail">
                  {episodeLabel(next)}
                  {nextData?.name ? ` · ${nextData.name}` : ''}
                </span>
              ) : null}
            </span>
            <ChevronRightIcon />
          </button>
        </nav>
      }
      aside={<EpisodePanel id={panelId} tvId={id} seasons={seasons} current={current} />}
      meta={
        <>
          <Seo
            title={`Watch ${showTitle || 'TV show'} S${season}E${episode}`}
            description={truncate(episodeData?.overview || tvDetails?.overview) || undefined}
            path={`/tv/${id}`}
            image={tmdbImage(tvDetails?.poster_path ?? tvDetails?.backdrop_path, 'w780')}
            type="video.tv_show"
          />
          <VideoSchema
            name={episodeData ? `${showTitle} - S${season}E${episode}: ${episodeData.name}` : showTitle}
            description={episodeData?.overview || `Watch ${showTitle} Season ${season} Episode ${episode}`}
            thumbnailUrl={tmdbImageFor(tvDetails?.poster_path, 'poster', 'large')}
            uploadDate={episodeData?.air_date ?? undefined}
            embedUrl={embedQuery.data?.embed_url || window.location.href}
            type="tv"
            seasonNumber={season}
            episodeNumber={episode}
            seriesName={showTitle}
            duration={episodeData?.runtime}
          />
        </>
      }
    >
      <PlayerFrame
        embed={embedQuery.data}
        error={embedQuery.error}
        onRetry={() => void embedQuery.refetch()}
        title={`Player: ${episodeTitle}`}
        backdropUrl={tmdbImageFor(tvDetails?.backdrop_path, 'backdrop', 'medium')}
        reloadToken={reloadToken}
      />
    </PlayerShell>
  )
}
