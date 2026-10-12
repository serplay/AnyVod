import { useRef, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router'
import { PosterImage, ProfileImage, StillImage } from '../components/OptimizedImage'
import VideoSchema from '../components/VideoSchema'
import { ErrorState, Loading } from '../components/states'
import NotFound from './NotFound'
import moviePlaceholder from '../assets/movie.png'
import { useAvailability, useDetails, useSeason, useSimilar } from '../api/hooks'
import { ApiError } from '../api/client'
import type { MediaKind } from '../api/types'
import {
  displayTitle,
  formatRating,
  itemKey,
  itemPath,
  parseNonNegativeInt,
  pickTrailerKey,
  releaseDate,
  seasonsOf,
  tmdbImageFor,
} from '../lib/media'
import { onActivateKey } from '../lib/a11y'

function YouTubeEmbed({ videoKey }: { videoKey: string | undefined }) {
  if (!videoKey) return null
  const src = `https://www.youtube.com/embed/${videoKey}?autoplay=0&rel=0`
  return (
    <div className="trailer-embed">
      <iframe
        src={src}
        title="trailer"
        frameBorder={0}
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      />
    </div>
  )
}

/** Route entry: validates the id and remounts the page per title so per-title state resets. */
export default function MoviePageRoute({ kind }: { kind: MediaKind }) {
  const { id: rawId } = useParams()
  const id = parseNonNegativeInt(rawId)
  if (id === undefined || id === 0) return <NotFound />
  return <MoviePage key={`${kind}-${id}`} kind={kind} id={id} />
}

function MoviePage({ kind, id }: { kind: MediaKind; id: number }) {
  const navigate = useNavigate()
  const isTv = kind === 'tv'
  const detailsQuery = useDetails(kind, id)
  const details = detailsQuery.data
  const { data: similarData } = useSimilar(kind, id)
  const availabilityQuery = useAvailability(kind, id)
  const castContainerRef = useRef<HTMLDivElement>(null)

  const seasons = isTv ? seasonsOf(details) : []
  const defaultSeason = (seasons.find((s) => s.season_number > 0) ?? seasons[0])?.season_number ?? null
  const [chosenSeason, setChosenSeason] = useState<number | null>(null)
  const selectedSeason = chosenSeason ?? defaultSeason
  const seasonQuery = useSeason(isTv && details ? id : undefined, selectedSeason)
  const seasonDetails = seasonQuery.data

  const similar = similarData?.results ?? []
  const trailerKey = pickTrailerKey(details)
  const checkingAvailability = availabilityQuery.isPending
  // A failed availability check is treated as "not available".
  const available = availabilityQuery.data?.available === true

  if (detailsQuery.error) {
    if (detailsQuery.error instanceof ApiError && detailsQuery.error.status === 404) {
      return <NotFound message={`We couldn't find that ${isTv ? 'show' : 'movie'}.`} />
    }
    return (
      <div className="movie-page">
        <ErrorState error={detailsQuery.error} onRetry={() => void detailsQuery.refetch()} />
      </div>
    )
  }

  // Arrow scroll handlers
  const scrollCast = (direction: 'left' | 'right') => {
    castContainerRef.current?.scrollBy({
      left: direction === 'left' ? -600 : 600,
      behavior: 'smooth',
    })
  }

  const rating = formatRating(details?.vote_average || undefined) ?? 'N/A'
  const voteCount = details?.vote_count || 0
  const title = details ? displayTitle(details) : ''
  const backdrop = tmdbImageFor(details?.backdrop_path, 'backdrop', 'large')

  return (
    <div className="movie-page">
      {/* Video Structured Data for SEO */}
      {details && (
        <VideoSchema
          name={title}
          description={details.overview}
          thumbnailUrl={
            tmdbImageFor(details.backdrop_path, 'backdrop', 'large') ?? tmdbImageFor(details.poster_path, 'poster', 'large')
          }
          uploadDate={releaseDate(details)}
          duration={details.runtime || details.episode_run_time?.[0]}
          embedUrl={`${window.location.origin}/player/${kind}/${id}`}
          type={kind}
        />
      )}

      {/* Hero Banner with fixed dimensions to prevent CLS */}
      <div
        className={`movie-hero ${!details ? 'movie-hero-skeleton' : ''}`}
        style={{ backgroundImage: backdrop ? `url(${backdrop})` : 'none' }}
      >
        <div className="hero-overlay">
          <div className="hero-content">
            <div className="hero-poster">
              {details ? (
                details.poster_path ? (
                  <PosterImage
                    path={details.poster_path}
                    alt={title}
                    size="large"
                    priority={true}
                    style={{ width: 280, height: 420, borderRadius: 12 }}
                  />
                ) : (
                  <img src={moviePlaceholder} alt={title} className="placeholder-img" width="280" height="420" />
                )
              ) : (
                <div className="poster-skeleton" style={{ width: 280, height: 420 }}></div>
              )}
            </div>

            <div className="hero-info">
              {details ? (
                <>
                  <h1 className="movie-title">{title}</h1>

                  {/* Rating */}
                  <div className="movie-rating">
                    <span className="rating-star">⭐</span>
                    <span className="rating-value">{rating}</span>
                    <span className="rating-count">({voteCount} votes)</span>
                  </div>

                  {/* Genres */}
                  <div className="movie-genres">
                    {details.genres?.map((g) => (
                      <span key={g.id} className="genre-tag">
                        {g.name}
                      </span>
                    ))}
                  </div>

                  {/* Overview */}
                  <p className="movie-overview">{details.overview}</p>

                  {/* Play Button with Availability Check */}
                  <div className="play-section">
                    {checkingAvailability ? (
                      <button className="play-button checking" disabled>
                        <span className="spinner"></span> Checking...
                      </button>
                    ) : available ? (
                      <button className="play-button" onClick={() => navigate(`/player/${kind}/${details.id}`)}>
                        ▶ Play Now
                      </button>
                    ) : (
                      <button className="play-button unavailable" disabled>
                        ✗ Not Available
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="skeleton-title" style={{ width: '60%', height: 40, background: 'rgba(255,255,255,0.08)', borderRadius: 8, marginBottom: 16 }}></div>
                  <div className="skeleton-meta" style={{ width: '40%', height: 24, background: 'rgba(255,255,255,0.06)', borderRadius: 6, marginBottom: 16 }}></div>
                  <div className="skeleton-genres" style={{ width: '50%', height: 32, background: 'rgba(255,255,255,0.05)', borderRadius: 6, marginBottom: 16 }}></div>
                  <div className="skeleton-overview" style={{ width: '90%', height: 80, background: 'rgba(255,255,255,0.05)', borderRadius: 6, marginBottom: 24 }}></div>
                  <div className="skeleton-button" style={{ width: 160, height: 48, background: 'rgba(255,255,255,0.08)', borderRadius: 6 }}></div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="movie-content">
        {/* Trailer Section */}
        {trailerKey && (
          <div className="section trailer-section">
            <h2 className="section-title">Trailer</h2>
            <YouTubeEmbed videoKey={trailerKey} />
          </div>
        )}

        {/* Seasons & Episodes Section (TV Shows Only) */}
        {isTv && seasons.length > 0 && details && (
          <div className="section seasons-section">
            <h2 className="section-title">Seasons & Episodes</h2>

            {/* Season Selector */}
            <div className="season-selector">
              {seasons.map((season) => (
                <button
                  key={season.season_number}
                  className={`season-btn ${selectedSeason === season.season_number ? 'active' : ''}`}
                  aria-pressed={selectedSeason === season.season_number}
                  onClick={() => setChosenSeason(season.season_number)}
                >
                  {season.season_number === 0 ? season.name || 'Specials' : `Season ${season.season_number}`}
                </button>
              ))}
            </div>

            {/* Episodes List */}
            {seasonQuery.error ? (
              <ErrorState error={seasonQuery.error} onRetry={() => void seasonQuery.refetch()} />
            ) : seasonQuery.isPending ? (
              <Loading label="Loading episodes…" />
            ) : (
              seasonDetails?.episodes && (
                <div className="episodes-container">
                  <div className="season-info">
                    <h3>{seasonDetails.name}</h3>
                    {seasonDetails.overview && <p className="season-overview">{seasonDetails.overview}</p>}
                  </div>
                  <div className="episodes-grid">
                    {seasonDetails.episodes.map((episode) => {
                      const play = () => navigate(`/player/tv/${details.id}/${selectedSeason}/${episode.episode_number}`)
                      return (
                        <div
                          key={episode.id}
                          className="episode-card"
                          role="button"
                          tabIndex={0}
                          onClick={play}
                          onKeyDown={onActivateKey(play)}
                        >
                          <div className="episode-image-container">
                            {episode.still_path ? (
                              <StillImage
                                path={episode.still_path}
                                alt={episode.name}
                                size="medium"
                                style={{ width: '100%', height: '100%' }}
                              />
                            ) : (
                              <div className="episode-placeholder">
                                <span>E{episode.episode_number}</span>
                              </div>
                            )}
                            <div className="episode-number-badge">Episode {episode.episode_number}</div>
                            <div className="episode-play-overlay">
                              <span className="play-icon">▶</span>
                            </div>
                          </div>
                          <div className="episode-info">
                            <h4 className="episode-title">{episode.name}</h4>
                            <div className="episode-meta">
                              {!!episode.runtime && <span>{episode.runtime}min</span>}
                              {episode.vote_average > 0 && (
                                <span className="episode-rating">⭐ {formatRating(episode.vote_average)}</span>
                              )}
                            </div>
                            {episode.overview && (
                              <p className="episode-overview">
                                {episode.overview.length > 150 ? episode.overview.slice(0, 150) + '...' : episode.overview}
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            )}
          </div>
        )}

        {/* Cast Section */}
        {details?.credits?.cast && details.credits.cast.length > 0 && (
          <div className="section cast-section">
            <h2 className="section-title">Cast</h2>
            <div className="cast-slider-wrapper">
              <button className="cast-arrow cast-arrow-left" onClick={() => scrollCast('left')} aria-label="Scroll left">
                ‹
              </button>
              <div className="cast-scroll-container" ref={castContainerRef}>
                <div className="cast-track">
                  {details.credits.cast.slice(0, 30).map((c) => (
                    <Link key={c.id} to={`/person/${c.id}`} className="cast-card">
                      {c.profile_path ? (
                        <ProfileImage
                          path={c.profile_path}
                          alt={c.name}
                          size="medium"
                          className="cast-photo"
                          style={{ width: 140, height: 210, borderRadius: 10 }}
                        />
                      ) : (
                        <div className="cast-photo-placeholder">
                          <span>{c.name.charAt(0)}</span>
                        </div>
                      )}
                      <div className="cast-name">{c.name}</div>
                      <div className="cast-character">{c.character}</div>
                    </Link>
                  ))}
                </div>
              </div>
              <button className="cast-arrow cast-arrow-right" onClick={() => scrollCast('right')} aria-label="Scroll right">
                ›
              </button>
            </div>
          </div>
        )}

        {/* Similar Movies Section */}
        {similar.length > 0 && (
          <div className="section similar-section">
            <h2 className="section-title">Similar {isTv ? 'Shows' : 'Movies'}</h2>
            <div className="similar-grid">
              {similar.slice(0, 12).map((s) => {
                // Similar results are always the same kind as the page.
                const item = { ...s, media_type: s.media_type ?? kind }
                const name = displayTitle(s)
                const open = () => navigate(itemPath(item))
                return (
                  <div
                    key={itemKey(item)}
                    className="similar-card"
                    role="button"
                    tabIndex={0}
                    onClick={open}
                    onKeyDown={onActivateKey(open)}
                  >
                    {s.poster_path ? (
                      <PosterImage path={s.poster_path} alt={name} size="medium" className="similar-poster" />
                    ) : (
                      <img src={moviePlaceholder} alt={name} className="similar-poster placeholder-img" />
                    )}
                    <div className="similar-info">
                      <h3 className="similar-title">{name}</h3>
                      {!!s.vote_average && s.vote_average > 0 && (
                        <div className="similar-rating">⭐ {formatRating(s.vote_average)}</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
