import { useState } from 'react'
import { useNavigate } from 'react-router'
import CategoryRow from '../components/CategoryRow'
import Search from '../components/Search'
import { ErrorState } from '../components/states'
import { useCategory, useDetails, useTrending } from '../api/hooks'
import type { CategoryPath } from '../api/types'
import { displayTitle, formatRating, formatYear, getMediaKind, isPerson, releaseDate, tmdbImageFor } from '../lib/media'

const HERO_CANDIDATES = 5

function Category({ title, path }: { title: string; path: CategoryPath }) {
  const { data, error, refetch } = useCategory(path)
  return <CategoryRow title={title} items={data?.results} error={error} onRetry={() => void refetch()} />
}

export default function Home() {
  const navigate = useNavigate()
  const trending = useTrending()
  // Pick the hero once per mount from the first few trending titles.
  const [heroIndex] = useState(() => Math.floor(Math.random() * HERO_CANDIDATES))

  const candidates = (trending.data?.results ?? []).filter((item) => !isPerson(item)).slice(0, HERO_CANDIDATES)
  const heroItem = candidates.length > 0 ? candidates[heroIndex % candidates.length] : undefined
  const heroKind = heroItem ? getMediaKind(heroItem) : 'movie'
  const { data: hero } = useDetails(heroKind, heroItem?.id)

  const handleHeroPlay = () => {
    if (hero) navigate(`/player/${heroKind}/${hero.id}`)
  }

  const handleHeroInfo = () => {
    if (hero) navigate(`/${heroKind}/${hero.id}`)
  }

  const backdrop = tmdbImageFor(hero?.backdrop_path, 'backdrop', 'large')

  return (
    <>
      <Search />
      <div className="home-page">
        {/* Hero banner with fixed dimensions to prevent CLS */}
        <div
          className={`hero-banner-home ${!hero ? 'hero-banner-skeleton' : ''}`}
          style={{ backgroundImage: backdrop ? `url(${backdrop})` : 'none' }}
        >
          {hero ? (
            <div className="hero-banner-overlay" itemType="https://schema.org/Movie">
              <div className="hero-banner-content">
                <h1 className="hero-banner-title">{displayTitle(hero)}</h1>
                <div className="hero-banner-meta">
                  <span className="hero-banner-rating">⭐ {formatRating(hero.vote_average)}</span>
                  <span className="hero-banner-year">{formatYear(releaseDate(hero))}</span>
                  {hero.genres && hero.genres.length > 0 && (
                    <span className="hero-banner-genres">
                      {hero.genres
                        .slice(0, 3)
                        .map((g) => g.name)
                        .join(' • ')}
                    </span>
                  )}
                </div>
                <p className="hero-banner-overview">
                  {hero.overview && hero.overview.length > 200 ? hero.overview.slice(0, 200) + '...' : hero.overview}
                </p>
                <div className="hero-banner-buttons">
                  <button className="hero-btn hero-btn-play" onClick={handleHeroPlay}>
                    ▶ Play
                  </button>
                  <button className="hero-btn hero-btn-info" onClick={handleHeroInfo}>
                    ℹ More Info
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
          <CategoryRow title="Trending Now" items={trending.data?.results} />
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
