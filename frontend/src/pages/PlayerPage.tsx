import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import VideoSchema from '../components/VideoSchema'
import { ErrorState } from '../components/states'
import NotFound from './NotFound'
import { seasonQueryOptions, useDetails, useEmbed, useSeason } from '../api/hooks'
import type { EmbedResponse, MediaKind } from '../api/types'
import { displayTitle, isMediaKind, parseNonNegativeInt, seasonsOf, tmdbImageFor } from '../lib/media'
import { onActivateKey } from '../lib/a11y'

const DEFAULT_SEASON = 1
const DEFAULT_EPISODE = 1

/**
 * Route entry for /player/:kind/:id and /player/:kind/:id/:season/:episode.
 * The URL is the single source of truth for which episode plays; changing
 * episode/season navigates, which avoids racing duplicated state.
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
  return (
    <TvPlayer
      key={`tv-${id}`}
      id={id}
      season={season ?? DEFAULT_SEASON}
      episode={episode ?? DEFAULT_EPISODE}
    />
  )
}

function PlayerFrame({ embed, error, onRetry }: { embed: EmbedResponse | undefined; error: unknown; onRetry: () => void }) {
  if (error) return <ErrorState error={error} onRetry={onRetry} title="Couldn't load the player" />
  if (embed?.embed_url) {
    return <iframe title="player" src={embed.embed_url} className="player-iframe" allowFullScreen frameBorder={0} />
  }
  return <div className="player-loading">Loading player...</div>
}

function useBackToDetails(kind: MediaKind, id: number) {
  const navigate = useNavigate()
  return () => navigate(`/${kind}/${id}`, { replace: true })
}

function MoviePlayer({ id }: { id: number }) {
  const { data: details } = useDetails('movie', id)
  const embedQuery = useEmbed('movie', id)
  const handleBack = useBackToDetails('movie', id)
  const movieTitle = details ? displayTitle(details) : ''

  return (
    <div className="player-page player-page-movie">
      {/* Video Structured Data for SEO */}
      <VideoSchema
        name={movieTitle}
        description={`Watch ${movieTitle} online`}
        thumbnailUrl={tmdbImageFor(details?.poster_path, 'poster', 'large')}
        embedUrl={embedQuery.data?.embed_url || window.location.href}
        type="movie"
      />

      <div className="player-header-movie">
        <button className="player-back-btn" onClick={handleBack} title="Back" aria-label="Back to details">
          ✕
        </button>
        <h2 className="player-title-movie">{movieTitle}</h2>
      </div>
      <div className="player-main-movie">
        <PlayerFrame embed={embedQuery.data} error={embedQuery.error} onRetry={() => void embedQuery.refetch()} />
      </div>
    </div>
  )
}

function TvPlayer({ id, season: currentSeason, episode: currentEpisode }: { id: number; season: number; episode: number }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: tvDetails } = useDetails('tv', id)
  const { data: seasonData } = useSeason(id, currentSeason)
  const embedQuery = useEmbed('tv', id, currentSeason, currentEpisode)
  const handleBack = useBackToDetails('tv', id)
  const [episodeSearch, setEpisodeSearch] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const episodeListRef = useRef<HTMLDivElement>(null)

  const movieTitle = tvDetails ? displayTitle(tvDetails) : ''
  const posterUrl = tmdbImageFor(tvDetails?.poster_path, 'poster', 'large')
  const seasons = seasonsOf(tvDetails)
  // Prev/next walks regular seasons only; Specials (season 0) is reachable via its tab.
  const navSeasons = seasons.filter((s) => s.season_number > 0)
  const navIndex = navSeasons.findIndex((s) => s.season_number === currentSeason)
  const prevSeason = navIndex > 0 ? navSeasons[navIndex - 1] : undefined
  const nextSeason = navIndex >= 0 ? navSeasons[navIndex + 1] : undefined
  const totalEpisodes = seasonData?.episodes.length ?? 0

  // Scroll to current episode when season data loads
  useEffect(() => {
    const active = episodeListRef.current?.querySelector('.episode-item.active')
    active?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [seasonData, currentEpisode])

  const goTo = (seasonNum: number, epNum: number) => {
    navigate(`/player/tv/${id}/${seasonNum}/${epNum}`, { replace: true })
  }

  const selectEpisode = (epNum: number) => goTo(currentSeason, epNum)
  const selectSeason = (seasonNum: number) => goTo(seasonNum, 1)

  const goToPreviousEpisode = async () => {
    if (currentEpisode > 1) {
      selectEpisode(currentEpisode - 1)
      return
    }
    if (!prevSeason) return
    let lastEp = prevSeason.episode_count
    if (lastEp <= 0) {
      try {
        const prev = await queryClient.fetchQuery(seasonQueryOptions(id, prevSeason.season_number))
        lastEp = prev.episodes.length
      } catch {
        // Unknown episode count; fall back to the first episode of that season.
      }
    }
    goTo(prevSeason.season_number, Math.max(1, lastEp))
  }

  const goToNextEpisode = () => {
    if (!seasonData) return
    if (currentEpisode < totalEpisodes) {
      selectEpisode(currentEpisode + 1)
    } else if (nextSeason) {
      goTo(nextSeason.season_number, 1)
    }
  }

  const canGoPrevious = currentEpisode > 1 || !!prevSeason
  const canGoNext = !!seasonData && (currentEpisode < totalEpisodes || !!nextSeason)

  // Filter episodes based on search
  const searchLower = episodeSearch.toLowerCase()
  const filteredEpisodes =
    seasonData?.episodes.filter(
      (ep) =>
        !episodeSearch ||
        ep.name?.toLowerCase().includes(searchLower) ||
        ep.episode_number.toString().includes(searchLower),
    ) ?? []

  // Get current episode data for structured data
  const currentEpisodeData = seasonData?.episodes.find((ep) => ep.episode_number === currentEpisode)

  return (
    <div className={`player-page player-page-tv ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Video Structured Data for SEO */}
      <VideoSchema
        name={
          currentEpisodeData
            ? `${movieTitle} - S${currentSeason}E${currentEpisode}: ${currentEpisodeData.name}`
            : movieTitle
        }
        description={currentEpisodeData?.overview || `Watch ${movieTitle} Season ${currentSeason} Episode ${currentEpisode}`}
        thumbnailUrl={posterUrl}
        embedUrl={embedQuery.data?.embed_url || window.location.href}
        type="tv"
        seasonNumber={currentSeason}
        episodeNumber={currentEpisode}
        seriesName={movieTitle}
        duration={currentEpisodeData?.runtime}
      />

      {/* Episode Sidebar */}
      <aside className={`episode-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-title-row">
            <span className="sidebar-label">List of episodes:</span>
            <button
              className="sidebar-collapse-btn"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? 'Expand' : 'Collapse'}
              aria-label={sidebarCollapsed ? 'Expand episode list' : 'Collapse episode list'}
            >
              {sidebarCollapsed ? '▶' : '◀'}
            </button>
          </div>
          {!sidebarCollapsed && (
            <div className="episode-search">
              <span className="search-icon" aria-hidden="true">
                🔍
              </span>
              <input
                type="text"
                aria-label="Filter episodes"
                placeholder="Number of Ep"
                value={episodeSearch}
                onChange={(e) => setEpisodeSearch(e.target.value)}
                className="episode-search-input"
              />
            </div>
          )}
        </div>

        {!sidebarCollapsed && (
          <div className="episode-list" ref={episodeListRef}>
            {filteredEpisodes.map((ep) => {
              const select = () => selectEpisode(ep.episode_number)
              return (
                <div
                  key={ep.episode_number}
                  className={`episode-item ${currentEpisode === ep.episode_number ? 'active' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-current={currentEpisode === ep.episode_number ? 'true' : undefined}
                  onClick={select}
                  onKeyDown={onActivateKey(select)}
                >
                  <span className="episode-number">{ep.episode_number}</span>
                  <span className="episode-name">{ep.name || `Episode ${ep.episode_number}`}</span>
                  {currentEpisode === ep.episode_number && <span className="episode-playing-icon">▶</span>}
                </div>
              )
            })}
          </div>
        )}
      </aside>

      {/* Collapsed sidebar toggle */}
      {sidebarCollapsed && (
        <button
          className="sidebar-expand-btn"
          onClick={() => setSidebarCollapsed(false)}
          title="Show episodes"
          aria-label="Show episodes"
        >
          ▶
        </button>
      )}

      {/* Main Content */}
      <main className="player-main">
        {/* Top header bar */}
        <div className="player-top-bar">
          <button className="player-back-btn" onClick={handleBack} title="Back to details" aria-label="Back to details">
            ✕
          </button>
          <h1 className="player-show-title">{movieTitle}</h1>
        </div>

        {/* Video Player */}
        <div className="player-video-container">
          <PlayerFrame embed={embedQuery.data} error={embedQuery.error} onRetry={() => void embedQuery.refetch()} />
        </div>

        {/* Player Controls */}
        <div className="player-controls-bar">
          <div className="player-controls-left">
            <span className="now-watching">
              You are watching <strong>Episode {currentEpisode}</strong>
            </span>
            <span className="server-hint">If current server doesn&apos;t work, please try other servers.</span>
          </div>
          <div className="player-controls-center">
            <button className="control-btn prev-btn" onClick={() => void goToPreviousEpisode()} disabled={!canGoPrevious}>
              ◀ Prev
            </button>
            <button className="control-btn next-btn" onClick={goToNextEpisode} disabled={!canGoNext}>
              Next ▶
            </button>
          </div>
        </div>

        {/* Season Selector */}
        {seasons.length > 1 && (
          <div className="season-selector">
            <span className="season-label">Seasons:</span>
            <div className="season-tabs">
              {seasons.map((s) => (
                <button
                  key={s.season_number}
                  className={`season-tab ${currentSeason === s.season_number ? 'active' : ''}`}
                  aria-pressed={currentSeason === s.season_number}
                  onClick={() => selectSeason(s.season_number)}
                >
                  {s.season_number === 0 ? s.name || 'Specials' : `Season ${s.season_number}`}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Mobile Episode Section - shows below video on mobile */}
        <div className="mobile-episode-section">
          <div className="mobile-section-header">
            <span className="mobile-section-title">Episodes</span>
            <div className="mobile-episode-search">
              <span aria-hidden="true">🔍</span>
              <input
                type="text"
                aria-label="Filter episodes"
                placeholder="Search..."
                value={episodeSearch}
                onChange={(e) => setEpisodeSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="mobile-episode-grid">
            {filteredEpisodes.map((ep) => {
              const select = () => selectEpisode(ep.episode_number)
              return (
                <div
                  key={ep.episode_number}
                  className={`mobile-episode-card ${currentEpisode === ep.episode_number ? 'active' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-current={currentEpisode === ep.episode_number ? 'true' : undefined}
                  onClick={select}
                  onKeyDown={onActivateKey(select)}
                >
                  <div className="ep-num">{ep.episode_number}</div>
                  <div className="ep-name">{ep.name || `Episode ${ep.episode_number}`}</div>
                  {currentEpisode === ep.episode_number && <div className="ep-playing">▶ Playing</div>}
                </div>
              )
            })}
          </div>
        </div>
      </main>
    </div>
  )
}
