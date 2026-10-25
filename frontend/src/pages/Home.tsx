import { useState } from 'react'
import { Link } from 'react-router'
import OptimizedImage from '../components/OptimizedImage'
import PosterCard, { Rating } from '../components/PosterCard'
import StillCard from '../components/StillCard'
import Rail from '../components/Rail'
import { ErrorState } from '../components/states'
import { InfoIcon, PlayIcon } from '../components/icons'
import Seo from '../components/Seo'
import { useCategory, useDetails, useTrending } from '../api/hooks'
import type { CategoryPath, MediaKind, MediaListItem } from '../api/types'
import { DEFAULT_TITLE, SITE_NAME } from '../config'
import { displayTitle, formatYear, getMediaKind, isPerson, itemKey, itemPath, releaseDate } from '../lib/media'
import { episodeLabel, episodePath, recentShows, type EpisodeRef } from '../lib/episodes'

/** Cards in the first row that load eagerly (roughly what fits above the fold). */
const FIRST_ROW_PRIORITY = 4
const CONTINUE_LIMIT = 10

function PosterRail({ title, items, error, onRetry, kind, priorityCount = 0 }: {
  title: string
  items: MediaListItem[] | undefined
  error: unknown
  onRetry: () => void
  /** List routes for one kind may omit media_type. */
  kind?: MediaKind
  priorityCount?: number
}) {
  return (
    <Rail title={title} error={error} onRetry={onRetry} loading={!items && !error}>
      {items && items.length > 0
        ? items.map((raw, index) => {
            const item = kind && !raw.media_type ? { ...raw, media_type: kind } : raw
            return (
              <li key={itemKey(item)}>
                <PosterCard item={item} href={itemPath(item)} priority={index < priorityCount} />
              </li>
            )
          })
        : null}
    </Rail>
  )
}

function Category({ title, path, kind }: { title: string; path: CategoryPath; kind: MediaKind }) {
  const { data, error, refetch } = useCategory(path)
  return <PosterRail title={title} items={data?.results} error={error} onRetry={() => void refetch()} kind={kind} />
}

function StillCategory({ title, path, kind }: { title: string; path: CategoryPath; kind: MediaKind }) {
  const { data, error, refetch } = useCategory(path)
  const items = data?.results.filter((item) => item.backdrop_path)
  return (
    <Rail title={title} variant="still" error={error} onRetry={() => void refetch()} loading={!data && !error}>
      {items && items.length > 0
        ? items.map((raw) => {
            const item = raw.media_type ? raw : { ...raw, media_type: kind }
            const year = formatYear(releaseDate(item))
            return (
              <li key={itemKey(item)}>
                <StillCard
                  href={itemPath(item)}
                  title={displayTitle(item)}
                  backdropPath={item.backdrop_path}
                  meta={
                    <span className="meta-line">
                      {year ? <span>{year}</span> : null}
                      <Rating value={item.vote_average} />
                    </span>
                  }
                />
              </li>
            )
          })
        : null}
    </Rail>
  )
}

function ContinueCard({ tvId, episode }: { tvId: number; episode: EpisodeRef }) {
  const { data } = useDetails('tv', tvId)
  return (
    <StillCard
      href={episodePath(tvId, episode)}
      title={data ? displayTitle(data) : 'Loading…'}
      backdropPath={data?.backdrop_path}
      meta={`Resume ${episodeLabel(episode)}`}
    />
  )
}

function ContinueWatching() {
  // Read once per visit to Home; the list only changes in the player.
  const [shows] = useState(() => recentShows(CONTINUE_LIMIT))
  if (shows.length === 0) return null
  return (
    <Rail title="Continue watching" variant="still">
      {shows.map(({ tvId, episode }) => (
        <li key={tvId}>
          <ContinueCard tvId={tvId} episode={episode} />
        </li>
      ))}
    </Rail>
  )
}

export default function Home() {
  const trending = useTrending()

  const trendingTitles = trending.data ? trending.data.results.filter((item) => !isPerson(item)) : undefined
  // Deterministic hero: the first trending title that has a backdrop.
  const heroItem = trendingTitles?.find((item) => !!item.backdrop_path)
  const heroKind = heroItem ? getMediaKind(heroItem) : 'movie'
  const { data: hero } = useDetails(heroKind, heroItem?.id)
  const heroBackdrop = heroItem?.backdrop_path ?? hero?.backdrop_path
  const heroTitle = hero ? displayTitle(hero) : heroItem ? displayTitle(heroItem) : ''
  const heroYear = formatYear(hero ? releaseDate(hero) : heroItem ? releaseDate(heroItem) : undefined)
  const heroGenres = hero?.genres?.slice(0, 3).map((g) => g.name).join(', ')

  return (
    <>
      <Seo title={DEFAULT_TITLE} path="/" />
      <h1 className="visually-hidden">{SITE_NAME}: watch movies and TV shows</h1>

      <section className={`home-hero${heroItem ? '' : ' is-loading'}`} aria-label="Featured">
        {heroBackdrop ? (
          <OptimizedImage
            tmdbPath={heroBackdrop}
            tmdbType="backdrop"
            tmdbSize="large"
            sizes="100vw"
            priority
            alt=""
            className="home-hero-art"
          />
        ) : null}
        <div className="home-hero-body">
          {heroItem ? (
            <>
              <h2 className="home-hero-title">{heroTitle}</h2>
              <p className="meta-line">
                <Rating value={heroItem.vote_average} />
                {heroYear ? <span>{heroYear}</span> : null}
                {heroGenres ? <span>{heroGenres}</span> : null}
              </p>
              {hero?.overview ? <p className="home-hero-overview">{hero.overview}</p> : null}
              <div className="btn-row home-hero-actions">
                <Link to={`/player/${heroKind}/${heroItem.id}`} className="btn btn-primary">
                  <PlayIcon />
                  Play
                </Link>
                <Link to={`/${heroKind}/${heroItem.id}`} className="btn">
                  <InfoIcon />
                  Details
                </Link>
              </div>
            </>
          ) : trending.error ? (
            <ErrorState error={trending.error} onRetry={() => void trending.refetch()} />
          ) : (
            <div className="home-hero-skeleton" role="status" aria-label="Loading featured title">
              <span className="skeleton home-hero-skeleton-title" />
              <span className="skeleton home-hero-skeleton-line" />
              <span className="skeleton home-hero-skeleton-btn" />
            </div>
          )}
        </div>
      </section>

      <div className="home-rails">
        <ContinueWatching />
        <PosterRail
          title="Trending now"
          items={trendingTitles}
          error={trending.error}
          onRetry={() => void trending.refetch()}
          priorityCount={FIRST_ROW_PRIORITY}
        />
        <Category title="Popular movies" path="popular" kind="movie" />
        <StillCategory title="Now in theaters" path="movie/now_playing" kind="movie" />
        <Category title="Popular TV shows" path="tv/popular" kind="tv" />
        <Category title="Top rated movies" path="movie/top_rated" kind="movie" />
        <StillCategory title="On the air this week" path="tv/on_the_air" kind="tv" />
        <Category title="Top rated TV shows" path="tv/top_rated" kind="tv" />
        <Category title="Coming soon" path="movie/upcoming" kind="movie" />
      </div>
    </>
  )
}
