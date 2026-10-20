import { useNavigate } from 'react-router'
import CategoryRow from '../components/CategoryRow'
import OptimizedImage from '../components/OptimizedImage'
import Search from '../components/Search'
import { ErrorState } from '../components/states'
import Seo from '../components/Seo'
import { useCategory, useDetails, useTrending } from '../api/hooks'
import type { CategoryPath } from '../api/types'
import { DEFAULT_TITLE, SITE_NAME } from '../config'
import { displayTitle, formatRating, formatYear, getMediaKind, isPerson, releaseDate } from '../lib/media'

/** Cards in the first row that load eagerly (roughly what fits above the fold). */
const FIRST_ROW_PRIORITY = 4

function Category({ title, path }: { title: string; path: CategoryPath }) {
  const { data, error, refetch } = useCategory(path)
  return <CategoryRow title={title} items={data?.results} error={error} onRetry={() => void refetch()} />
}

export default function Home() {
  const navigate = useNavigate()
  const trending = useTrending()

  const trendingTitles = (trending.data?.results ?? []).filter((item) => !isPerson(item))
  // Deterministic hero: the first trending title that has a backdrop.
  const heroItem = trendingTitles.find((item) => !!item.backdrop_path)
  const heroKind = heroItem ? getMediaKind(heroItem) : 'movie'
  const { data: hero } = useDetails(heroKind, heroItem?.id)
  const heroBackdrop = heroItem?.backdrop_path ?? hero?.backdrop_path

  const handleHeroPlay = () => {
    if (hero) navigate(`/player/${heroKind}/${hero.id}`)
  }

  const handleHeroInfo = () => {
    if (hero) navigate(`/${heroKind}/${hero.id}`)
  }

  return (
    <>
      <Seo title={DEFAULT_TITLE} path="/" />
      <h1 className="visually-hidden">{SITE_NAME}: watch movies and TV shows</h1>
      <Search />
      <div className="home-page">
        {/* Hero banner with fixed dimensions to prevent CLS */}
        <div className={`hero-banner-home ${!hero ? 'hero-banner-skeleton' : ''}`}>
          {heroBackdrop ? (
            <OptimizedImage
              tmdbPath={heroBackdrop}
              tmdbType="backdrop"
              tmdbSize="large"
              sizes="100vw"
              priority
              alt=""
              className="hero-banner-backdrop"
            />
          ) : null}
          {hero ? (
            <div className="hero-banner-overlay">
              <div className="hero-banner-content">
                <h2 className="hero-banner-title">{displayTitle(hero)}</h2>
                <div className="hero-banner-meta">
                  <span className="hero-banner-rating">⭐ {formatRating(hero.vote_average)}</span>
                  <span className="hero-banner-year">{formatYear(releaseDate(hero))}</span>
                  {hero.genres != null && hero.genres.length > 0 ? (
                    <span className="hero-banner-genres">
                      {hero.genres
                        .slice(0, 3)
                        .map((g) => g.name)
                        .join(' • ')}
                    </span>
                  ) : null}
                </div>
                <p className="hero-banner-overview">
                  {hero.overview && hero.overview.length > 200 ? hero.overview.slice(0, 200) + '...' : hero.overview}
                </p>
                <div className="hero-banner-buttons">
                  <button type="button" className="hero-btn hero-btn-play" onClick={handleHeroPlay}>
                    <span aria-hidden="true">▶</span> Play
                  </button>
                  <button type="button" className="hero-btn hero-btn-info" onClick={handleHeroInfo}>
                    <span aria-hidden="true">ℹ</span> More Info
                  </button>
                </div>
              </div>
            </div>
          ) : trending.error ? (
            <div className="hero-banner-overlay">
              <ErrorState error={trending.error} onRetry={() => void trending.refetch()} />
            </div>
          ) : (
            <div className="hero-banner-overlay hero-banner-loading">
              <div className="hero-banner-content">
                <div className="skeleton-title"></div>
                <div className="skeleton-meta"></div>
                <div className="skeleton-overview"></div>
                <div className="skeleton-buttons"></div>
              </div>
            </div>
          )}
        </div>

        <div className="categories-container">
          <CategoryRow
            title="Trending Now"
            items={trendingTitles}
            error={trending.error}
            onRetry={() => void trending.refetch()}
            priorityCount={FIRST_ROW_PRIORITY}
          />
          <Category title="Popular Movies" path="popular" />
          <Category title="Popular TV Shows" path="tv/popular" />
          <Category title="Top Rated Movies" path="movie/top_rated" />
          <Category title="Top Rated TV Shows" path="tv/top_rated" />
          <Category title="Now Playing in Theaters" path="movie/now_playing" />
          <Category title="Coming Soon" path="movie/upcoming" />
        </div>
      </div>
    </>
  )
}
