import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import CategoryRow from './CategoryRow'
import { getTMDBImageUrl } from './OptimizedImage'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function Home() {
  const [hero, setHero] = useState(null)
  const [trending, setTrending] = useState([])
  const [popularMovies, setPopularMovies] = useState([])
  const [popularTV, setPopularTV] = useState([])
  const [topRatedMovies, setTopRatedMovies] = useState([])
  const [topRatedTV, setTopRatedTV] = useState([])
  const [upcoming, setUpcoming] = useState([])
  const [nowPlaying, setNowPlaying] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    fetchAllCategories()
  }, [])

  async function fetchAllCategories() {
    try {
      // Fetch trending for hero
      const trendingRes = await axios.get(`${API_BASE}/tmdb/trending/all/day`)
      const trendingData = trendingRes.data.results || []
      setTrending(trendingData)
      
      // Pick a random trending item for hero
      if (trendingData.length > 0) {
        const randomHero = trendingData[Math.floor(Math.random() * Math.min(5, trendingData.length))]
        // Fetch full details for hero
        const isTv = randomHero.media_type === 'tv' || !!randomHero.first_air_date
        const detailsRes = await axios.get(`${API_BASE}/tmdb/${isTv ? 'tv' : 'movie'}/${randomHero.id}`)
        setHero({ ...detailsRes.data, isTv })
      }

      // Fetch all categories in parallel
      const [popMovies, popTV, topMovies, topTV, upcomingRes, nowPlayingRes] = await Promise.all([
        axios.get(`${API_BASE}/tmdb/popular`),
        axios.get(`${API_BASE}/tmdb/tv/popular`),
        axios.get(`${API_BASE}/tmdb/movie/top_rated`),
        axios.get(`${API_BASE}/tmdb/tv/top_rated`),
        axios.get(`${API_BASE}/tmdb/movie/upcoming`),
        axios.get(`${API_BASE}/tmdb/movie/now_playing`)
      ])

      setPopularMovies(popMovies.data.results || [])
      setPopularTV(popTV.data.results || [])
      setTopRatedMovies(topMovies.data.results || [])
      setTopRatedTV(topTV.data.results || [])
      setUpcoming(upcomingRes.data.results || [])
      setNowPlaying(nowPlayingRes.data.results || [])
    } catch (err) {
      console.error('Failed to fetch categories:', err)
    }
  }

  const handleHeroPlay = () => {
    if (hero) {
      navigate(`/player/${hero.isTv ? 'tv' : 'movie'}/${hero.id}`)
    }
  }

  const handleHeroInfo = () => {
    if (hero) {
      navigate(`/${hero.isTv ? 'tv' : 'movie'}/${hero.id}`)
    }
  }

  return (
    <div className="home-page">
      {/* Hero banner with fixed dimensions to prevent CLS */}
      <div className={`hero-banner-home ${!hero ? 'hero-banner-skeleton' : ''}`} style={{
        backgroundImage: hero?.backdrop_path 
          ? `url(${getTMDBImageUrl(hero.backdrop_path, 'backdrop', 'large')})` 
          : 'none'
      }}>
        {hero ? (
          <div className="hero-banner-overlay" itemtype="https://schema.org/Movie">
            <div className="hero-banner-content">
              <h1 className="hero-banner-title">{hero.title || hero.name}</h1>
              <div className="hero-banner-meta">
                <span className="hero-banner-rating">⭐ {hero.vote_average?.toFixed(1)}</span>
                <span className="hero-banner-year">
                  {(hero.release_date || hero.first_air_date)?.split('-')[0]}
                </span>
                {hero.genres && hero.genres.length > 0 && (
                  <span className="hero-banner-genres">
                    {hero.genres.slice(0, 3).map(g => g.name).join(' • ')}
                  </span>
                )}
              </div>
              <p className="hero-banner-overview">
                {hero.overview && hero.overview.length > 200 
                  ? hero.overview.slice(0, 200) + '...' 
                  : hero.overview}
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
        <CategoryRow title="Trending Now" items={trending} />
        <CategoryRow title="Popular Movies" items={popularMovies} />
        <CategoryRow title="Popular TV Shows" items={popularTV} />
        <CategoryRow title="Top Rated Movies" items={topRatedMovies} />
        <CategoryRow title="Top Rated TV Shows" items={topRatedTV} />
        <CategoryRow title="Now Playing in Theaters" items={nowPlaying} />
        <CategoryRow title="Coming Soon" items={upcoming} />
      </div>
    </div>
  )
}
