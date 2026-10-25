import { useId, useState } from 'react'
import { useParams, Link } from 'react-router'
import OptimizedImage, { ProfileImage } from '../components/OptimizedImage'
import PosterCard, { GRID_POSTER_SIZES, Rating } from '../components/PosterCard'
import EpisodeRow, { SeasonSelect } from '../components/EpisodeRow'
import VideoSchema from '../components/VideoSchema'
import Seo from '../components/Seo'
import { ErrorState } from '../components/states'
import { CloseIcon, PlayIcon } from '../components/icons'
import NotFound from './NotFound'
import { useAvailability, useDetails, useSeason, useSimilar } from '../api/hooks'
import { ApiError } from '../api/client'
import type { MediaDetails, MediaKind } from '../api/types'
import {
  displayTitle,
  formatRuntime,
  formatYear,
  itemKey,
  itemPath,
  parseNonNegativeInt,
  pickTrailerKey,
  releaseDate,
  seasonsOf,
  tmdbImage,
  tmdbImageFor,
} from '../lib/media'
import { episodeLabel, episodePath, loadLastEpisode } from '../lib/episodes'
import { truncate } from '../lib/seo'

const SIMILAR_LIMIT = 12
const CAST_LIMIT = 24

/** Route entry: validates the id and remounts the page per title so per-title state resets. */
export default function MoviePageRoute({ kind }: { kind: MediaKind }) {
  const { id: rawId } = useParams()
  const id = parseNonNegativeInt(rawId)
  if (id === undefined || id === 0) return <NotFound />
  return <MoviePage key={`${kind}-${id}`} kind={kind} id={id} />
}

interface StageProps {
  details: MediaDetails | undefined
  title: string
  /** An episode still shown over the backdrop while an episode row is hovered or focused. */
  still: string | null
  showStill: boolean
  trailerKey: string | undefined
  trailerOpen: boolean
  onCloseTrailer: () => void
}

/** The fixed picture: backdrop, an episode preview, or the trailer playing in place. */
function Stage({ details, title, still, showStill, trailerKey, trailerOpen, onCloseTrailer }: StageProps) {
  const backdrop = details?.backdrop_path
  const poster = details?.poster_path
  return (
    <div className="stage">
      {backdrop ? (
        <OptimizedImage
          tmdbPath={backdrop}
          tmdbType="backdrop"
          tmdbSize="large"
          sizes="(min-width: 1200px) 45vw, 100vw"
          priority
          alt=""
          className="stage-art"
        />
      ) : poster ? (
        <OptimizedImage tmdbPath={poster} tmdbType="poster" tmdbSize="large" sizes="(min-width: 1200px) 45vw, 100vw" priority alt="" className="stage-art" />
      ) : null}
      {still ? (
        <img
          src={tmdbImageFor(still, 'still', 'original')}
          alt=""
          className={`stage-preview${showStill ? ' is-shown' : ''}`}
          decoding="async"
        />
      ) : null}
      {trailerOpen && trailerKey ? (
        <div className="stage-trailer">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailerKey)}?autoplay=1&rel=0`}
            title={`YouTube video player: ${title} trailer`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
          <button type="button" className="btn btn-icon stage-trailer-close" onClick={onCloseTrailer} aria-label="Close trailer">
            <CloseIcon />
          </button>
        </div>
      ) : null}
    </div>
  )
}

function MoviePage({ kind, id }: { kind: MediaKind; id: number }) {
  const isTv = kind === 'tv'
  const detailsQuery = useDetails(kind, id)
  const details = detailsQuery.data
  const { data: similarData } = useSimilar(kind, id)
  const availabilityQuery = useAvailability(kind, id)
  const availabilityReasonId = useId()
  const [trailerOpen, setTrailerOpen] = useState(false)
  const [still, setStill] = useState<string | null>(null)
  const [showStill, setShowStill] = useState(false)

  const seasons = isTv ? seasonsOf(details) : []
  const defaultSeason = (seasons.find((s) => s.season_number > 0) ?? seasons[0])?.season_number ?? null
  const [chosenSeason, setChosenSeason] = useState<number | null>(null)
  const selectedSeason = chosenSeason ?? defaultSeason
  const seasonQuery = useSeason(isTv && details ? id : undefined, selectedSeason)
  const episodes = seasonQuery.data?.episodes

  const similar = similarData?.results ?? []
  const trailerKey = pickTrailerKey(details)
  const checkingAvailability = availabilityQuery.isPending
  // A failed availability check is treated as "not available".
  const available = availabilityQuery.data?.available === true
  const unavailableReason = availabilityQuery.error
    ? "We couldn't check whether this title is available. Please try again later."
    : availabilityQuery.data?.reason || 'This title is not available to stream right now.'
  const lastEpisode = isTv ? loadLastEpisode(id) : undefined

  if (detailsQuery.error) {
    if (detailsQuery.error instanceof ApiError && detailsQuery.error.status === 404) {
      return <NotFound message={`We couldn't find that ${isTv ? 'show' : 'movie'}.`} />
    }
    return (
      <div className="page">
        <ErrorState error={detailsQuery.error} onRetry={() => void detailsQuery.refetch()} headingLevel="h1" />
      </div>
    )
  }

  const title = details ? displayTitle(details) : ''
  const year = formatYear(details ? releaseDate(details) : undefined)
  const seoTitle = details ? (year ? `${title} (${year})` : title) : isTv ? 'TV Show' : 'Movie'
  const length = isTv
    ? details?.number_of_seasons
      ? `${details.number_of_seasons} ${details.number_of_seasons === 1 ? 'season' : 'seasons'}`
      : undefined
    : formatRuntime(details?.runtime)
  const genres = details?.genres?.slice(0, 3).map((g) => g.name).join(', ')
  const cast = details?.credits?.cast.slice(0, CAST_LIMIT) ?? []

  const previewStill = (path: string | null) => {
    if (path) setStill(path)
    setShowStill(!!path)
  }

  return (
    <>
      <Seo
        title={seoTitle}
        description={truncate(details?.overview) || undefined}
        path={`/${kind}/${id}`}
        image={tmdbImage(details?.poster_path ?? details?.backdrop_path, 'w780')}
        type={isTv ? 'video.tv_show' : 'video.movie'}
      />
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

      <div className="stage-page">
        <Stage
          details={details}
          title={title}
          still={still}
          showStill={showStill && !trailerOpen}
          trailerKey={trailerKey}
          trailerOpen={trailerOpen}
          onCloseTrailer={() => setTrailerOpen(false)}
        />

        <div className="stage-body">
          {details ? (
            <header className="title-head">
              <h1 className="title-name">{title}</h1>
              <p className="meta-line">
                {year ? <span>{year}</span> : null}
                {length ? <span>{length}</span> : null}
                <Rating value={details.vote_average} />
              </p>
              {genres ? <p className="title-genres">{genres}</p> : null}
              <div className="btn-row title-actions">
                {checkingAvailability ? (
                  <button type="button" className="btn btn-primary" disabled>
                    <span className="spinner" aria-hidden="true" />
                    Checking…
                  </button>
                ) : available ? (
                  <Link
                    to={lastEpisode ? episodePath(id, lastEpisode) : `/player/${kind}/${id}`}
                    className="btn btn-primary"
                  >
                    <PlayIcon />
                    {lastEpisode ? `Resume ${episodeLabel(lastEpisode)}` : 'Play'}
                  </Link>
                ) : (
                  <button type="button" className="btn btn-primary" disabled aria-describedby={availabilityReasonId}>
                    Not available
                  </button>
                )}
                {trailerKey ? (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => setTrailerOpen((open) => !open)}
                    aria-pressed={trailerOpen}
                  >
                    {trailerOpen ? 'Close trailer' : 'Trailer'}
                  </button>
                ) : null}
              </div>
              {!checkingAvailability && !available ? (
                <p className="title-note" id={availabilityReasonId}>
                  {unavailableReason}
                </p>
              ) : null}
              {details.overview ? <p className="title-overview">{details.overview}</p> : null}
            </header>
          ) : (
            <div className="title-head" role="status">
              <h1 className="visually-hidden">Loading {isTv ? 'show' : 'movie'}…</h1>
              <span className="skeleton title-skeleton-name" />
              <span className="skeleton title-skeleton-line" />
              <span className="skeleton title-skeleton-btn" />
              <span className="skeleton title-skeleton-text" />
            </div>
          )}

          {isTv && seasons.length > 0 && details && selectedSeason !== null ? (
            <section className="title-section" aria-labelledby="episodes-heading">
              <div className="title-section-head">
                <h2 className="section-title" id="episodes-heading">
                  Episodes
                </h2>
                {seasons.length > 1 ? (
                  <SeasonSelect seasons={seasons} value={selectedSeason} onChange={setChosenSeason} />
                ) : null}
              </div>
              {seasonQuery.error ? (
                <ErrorState error={seasonQuery.error} onRetry={() => void seasonQuery.refetch()} title="Couldn't load episodes" />
              ) : !episodes ? (
                <ol className="episode-list" aria-busy="true" aria-label="Loading episodes">
                  {Array.from({ length: 4 }, (_, i) => (
                    <li key={i} className="episode-row-skeleton skeleton" />
                  ))}
                </ol>
              ) : episodes.length === 0 ? (
                <p className="title-note">No episodes listed for this season.</p>
              ) : (
                <ol className="episode-list">
                  {episodes.map((ep) => (
                    <li key={ep.id}>
                      <EpisodeRow
                        episode={ep}
                        to={episodePath(id, { season: selectedSeason, episode: ep.episode_number })}
                        current={lastEpisode?.season === selectedSeason && lastEpisode.episode === ep.episode_number}
                        showOverview
                        onPreview={previewStill}
                      />
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ) : null}

          {cast.length > 0 ? (
            <section className="title-section" aria-labelledby="cast-heading">
              <h2 className="section-title title-section-head" id="cast-heading">
                Cast
              </h2>
              <ul className="cast-list">
                {cast.map((c) => (
                  <li key={c.id}>
                    <Link to={`/person/${c.id}`} className="cast-card">
                      <span className="cast-photo">
                        {c.profile_path ? (
                          <ProfileImage path={c.profile_path} alt="" size="medium" sizes="104px" className="oi-fill" />
                        ) : (
                          <span className="cast-initial" aria-hidden="true">
                            {c.name?.charAt(0)}
                          </span>
                        )}
                      </span>
                      <span className="cast-name">{c.name}</span>
                      {c.character ? <span className="cast-character">{c.character}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>

      {similar.length > 0 ? (
        <section className="title-more" aria-labelledby="more-heading">
          <h2 className="section-title title-section-head" id="more-heading">
            More like this
          </h2>
          <div className="poster-grid">
            {similar.slice(0, SIMILAR_LIMIT).map((s) => {
              // Similar results are always the same kind as the page.
              const item = { ...s, media_type: s.media_type ?? kind }
              return <PosterCard key={itemKey(item)} item={item} href={itemPath(item)} sizes={GRID_POSTER_SIZES} />
            })}
          </div>
        </section>
      ) : null}
    </>
  )
}
