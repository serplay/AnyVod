import { useId, useRef, useState, type CSSProperties } from 'react'
import { useParams, Link, useNavigate } from 'react-router'
import { PosterImage, ProfileImage, StillImage } from '../components/OptimizedImage'
import TrailerFacade from '../components/TrailerFacade'
import VideoSchema from '../components/VideoSchema'
import Seo from '../components/Seo'
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
  formatYear,
  releaseDate,
  seasonsOf,
  tmdbImage,
  tmdbImageFor,
} from '../lib/media'
import { truncate } from '../lib/seo'

/** Rendered widths (movie-card.css, episodes.css, responsive.css, mobile.css). */
const SIMILAR_CARD_SIZES = '(max-width: 480px) 50vw, 220px'
const EPISODE_STILL_SIZES = '(max-width: 768px) 100vw, 300px'

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
  const castListId = useId()
  const availabilityReasonId = useId()

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
  const unavailableReason = availabilityQuery.error
    ? "We couldn't check whether this title is available. Please try again later."
    : availabilityQuery.data?.reason || 'This title is not available to stream right now.'

  if (detailsQuery.error) {
    if (detailsQuery.error instanceof ApiError && detailsQuery.error.status === 404) {
      return <NotFound message={`We couldn't find that ${isTv ? 'show' : 'movie'}.`} />
    }
    return (
      <div className="movie-page">
        <ErrorState error={detailsQuery.error} onRetry={() => void detailsQuery.refetch()} headingLevel="h1" />
      </div>
    )
  }

  const scrollCast = (direction: 'left' | 'right') => {
    const container = castContainerRef.current
    if (!container) return
    const amount = Math.max(200, container.clientWidth * 0.8)
    container.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  const rating = formatRating(details?.vote_average || undefined) ?? 'N/A'
  const voteCount = details?.vote_count ?? 0
  const title = details ? displayTitle(details) : ''
  const backdrop = tmdbImageFor(details?.backdrop_path, 'backdrop', 'large')
  // Dynamic value passed as a custom property; ui.css applies it as the background.
  const heroStyle = backdrop ? ({ '--hero-bg': `url(${JSON.stringify(backdrop)})` } as CSSProperties) : undefined

  const year = formatYear(details ? releaseDate(details) : undefined)
  const seoTitle = details ? (year ? `${title} (${year})` : title) : isTv ? 'TV Show' : 'Movie'

  return (
    <div className="movie-page">
      <Seo
        title={seoTitle}
        description={truncate(details?.overview) || undefined}
        path={`/${kind}/${id}`}
        image={tmdbImage(details?.poster_path ?? details?.backdrop_path, 'w780')}
        type={isTv ? 'video.tv_show' : 'video.movie'}
      />
      {/* Video Structured Data for SEO */}
      {details ? (
        <VideoSchema
          name={title}
          description={details.overview}
          thumbnailUrl={
            tmdbImageFor(details.backdrop_path, 'backdrop', 'large') ?? tmdbImageFor(details.poster_path, 'poster', 'large')
          }
          uploadDate={releaseDate(details)}
          duration={details.runtime ?? details.episode_run_time?.[0]}
          embedUrl={`${window.location.origin}/player/${kind}/${id}`}
          type={kind}
        />
      ) : null}

      {/* Hero Banner with fixed dimensions to prevent CLS */}
      <div className={`movie-hero ${!details ? 'movie-hero-skeleton' : ''}`} style={heroStyle}>
        <div className="hero-overlay">
          <div className="hero-content">
            <div className="hero-poster">
              {details ? (
                details.poster_path ? (
                  <PosterImage
                    path={details.poster_path}
                    alt={title}
                    size="large"
                    sizes="280px"
                    priority
                    className="oi-hero-poster"
                  />
                ) : (
                  <img src={moviePlaceholder} alt={title} className="placeholder-img" width="280" height="420" />
                )
              ) : (
                <div className="poster-skeleton poster-skeleton-hero"></div>
              )}
            </div>

            <div className="hero-info">
              {details ? (
                <>
                  <h1 className="movie-title">{title}</h1>

                  {/* Rating */}
                  <div className="movie-rating">
                    <span className="rating-star" aria-hidden="true">
                      ⭐
                    </span>
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
                        <span aria-hidden="true">▶</span> Play Now
                      </button>
                    ) : (
                      <>
                        <button className="play-button unavailable" disabled aria-describedby={availabilityReasonId}>
                          <span aria-hidden="true">✗</span> Not Available
                        </button>
                        <p className="availability-reason" id={availabilityReasonId}>
                          {unavailableReason}
                        </p>
                      </>
                    )}
                  </div>
                </>
              ) : (
                <div role="status">
                  <h1 className="visually-hidden">Loading {isTv ? 'show' : 'movie'}…</h1>
                  <div className="movie-skeleton skeleton-title"></div>
                  <div className="movie-skeleton skeleton-meta"></div>
                  <div className="movie-skeleton skeleton-genres"></div>
                  <div className="movie-skeleton skeleton-overview"></div>
                  <div className="movie-skeleton skeleton-button"></div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="movie-content">
        {/* Trailer Section */}
        {trailerKey ? (
          <div className="section trailer-section">
            <h2 className="section-title">Trailer</h2>
            <TrailerFacade key={trailerKey} videoKey={trailerKey} title={title} />
          </div>
        ) : null}

        {/* Seasons & Episodes Section (TV Shows Only) */}
        {isTv && seasons.length > 0 && details ? (
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
            ) : seasonDetails?.episodes ? (
              <div className="episodes-container">
                <div className="season-info">
                  <h3>{seasonDetails.name}</h3>
                  {seasonDetails.overview ? <p className="season-overview">{seasonDetails.overview}</p> : null}
                </div>
                <div className="episodes-grid">
                  {seasonDetails.episodes.map((episode) => (
                    <Link
                      key={episode.id}
                      to={`/player/tv/${details.id}/${selectedSeason}/${episode.episode_number}`}
                      className="episode-card"
                    >
                      <div className="episode-image-container">
                        {episode.still_path ? (
                          <StillImage
                            path={episode.still_path}
                            alt=""
                            size="medium"
                            sizes={EPISODE_STILL_SIZES}
                            className="oi-fill"
                          />
                        ) : (
                          <div className="episode-placeholder" aria-hidden="true">
                            <span>E{episode.episode_number}</span>
                          </div>
                        )}
                        <div className="episode-number-badge">Episode {episode.episode_number}</div>
                        <div className="episode-play-overlay" aria-hidden="true">
                          <span className="play-icon">▶</span>
                        </div>
                      </div>
                      <div className="episode-info">
                        <h4 className="episode-title">{episode.name}</h4>
                        <div className="episode-meta">
                          {episode.runtime != null && episode.runtime > 0 ? <span>{episode.runtime}min</span> : null}
                          {episode.vote_average > 0 ? (
                            <span className="episode-rating">⭐ {formatRating(episode.vote_average)}</span>
                          ) : null}
                        </div>
                        {episode.overview ? (
                          <p className="episode-overview">
                            {episode.overview.length > 150 ? episode.overview.slice(0, 150) + '...' : episode.overview}
                          </p>
                        ) : null}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Cast Section */}
        {details?.credits?.cast != null && details.credits.cast.length > 0 ? (
          <div className="section cast-section">
            <h2 className="section-title">Cast</h2>
            <div className="cast-slider-wrapper">
              <button
                type="button"
                className="cast-arrow cast-arrow-left"
                onClick={() => scrollCast('left')}
                aria-label="Scroll cast left"
                aria-controls={castListId}
              >
                <span aria-hidden="true">‹</span>
              </button>
              <div className="cast-scroll-container" ref={castContainerRef} id={castListId}>
                <div className="cast-track">
                  {details.credits.cast.slice(0, 30).map((c) => (
                    <Link key={c.id} to={`/person/${c.id}`} className="cast-card">
                      {c.profile_path ? (
                        <ProfileImage path={c.profile_path} alt="" size="medium" sizes="140px" className="cast-photo" />
                      ) : (
                        <div className="cast-photo-placeholder" aria-hidden="true">
                          <span>{c.name?.charAt(0)}</span>
                        </div>
                      )}
                      <div className="cast-name">{c.name}</div>
                      <div className="cast-character">{c.character}</div>
                    </Link>
                  ))}
                </div>
              </div>
              <button
                type="button"
                className="cast-arrow cast-arrow-right"
                onClick={() => scrollCast('right')}
                aria-label="Scroll cast right"
                aria-controls={castListId}
              >
                <span aria-hidden="true">›</span>
              </button>
            </div>
          </div>
        ) : null}

        {/* Similar Movies Section */}
        {similar.length > 0 ? (
          <div className="section similar-section">
            <h2 className="section-title">Similar {isTv ? 'Shows' : 'Movies'}</h2>
            <div className="similar-grid">
              {similar.slice(0, 12).map((s) => {
                // Similar results are always the same kind as the page.
                const item = { ...s, media_type: s.media_type ?? kind }
                const name = displayTitle(s)
                return (
                  <Link key={itemKey(item)} to={itemPath(item)} className="similar-card">
                    {s.poster_path ? (
                      <PosterImage
                        path={s.poster_path}
                        alt=""
                        size="medium"
                        sizes={SIMILAR_CARD_SIZES}
                        className="similar-poster"
                      />
                    ) : (
                      <img src={moviePlaceholder} alt="" className="similar-poster placeholder-img" loading="lazy" />
                    )}
                    <div className="similar-info">
                      <h3 className="similar-title">{name}</h3>
                      {s.vote_average != null && s.vote_average > 0 ? (
                        <div className="similar-rating">⭐ {formatRating(s.vote_average)}</div>
                      ) : null}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
