import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom'
import axios from 'axios'
import moviePlaceholder from '../assets/movie.png'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

function YouTubeEmbed({ videoKey }) {
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

export default function MoviePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [details, setDetails] = useState(null)
  const [similar, setSimilar] = useState([])
  const [trailerKey, setTrailerKey] = useState(null)
  const [selectedSeason, setSelectedSeason] = useState(1)
  const [seasonDetails, setSeasonDetails] = useState(null)
  const [availability, setAvailability] = useState(null)
  const [checkingAvailability, setCheckingAvailability] = useState(false)
  const castContainerRef = React.useRef(null)

  // Determine if TV show based on URL path using React Router's location
  const isTv = location.pathname.startsWith('/tv/')

  useEffect(() => {
    fetchDetails()
  }, [id, isTv])

  useEffect(() => {
    if (isTv && details && selectedSeason) {
      fetchSeasonDetails(selectedSeason)
    }
  }, [selectedSeason, details, isTv])

  useEffect(() => {
    if (details && id) {
      checkAvailability()
    }
  }, [details, id, isTv])

  async function checkAvailability() {
    setCheckingAvailability(true)
    try {
      const endpoint = isTv 
        ? `${API_BASE}/vidsrc/tv/availability/${id}`
        : `${API_BASE}/vidsrc/movie/availability/${id}`
      const res = await axios.get(endpoint)
      setAvailability(res.data)
    } catch (err) {
      console.error('Failed to check availability:', err)
      setAvailability({ available: false, reason: 'check failed' })
    } finally {
      setCheckingAvailability(false)
    }
  }

  async function fetchDetails() {
    try {
      // Fetch based on route type
      const endpoint = isTv ? `${API_BASE}/tmdb/tv/${id}` : `${API_BASE}/tmdb/movie/${id}`
      const res = await axios.get(endpoint)
      setDetails(res.data)

      // Fetch similar titles
      try {
        const simEndpoint = isTv 
          ? `${API_BASE}/tmdb/tv/${id}/similar` 
          : `${API_BASE}/tmdb/movie/${id}/similar`
        const simRes = await axios.get(simEndpoint)
        setSimilar(simRes.data.results || [])
      } catch (e) {
        console.error('Failed to fetch similar:', e)
      }

      // Pick a trailer (YouTube preferred)
      const vids = (res.data.videos && res.data.videos.results) || []
      const trailer = vids.find(v => /trailer/i.test(v.type) && /youtube/i.test(v.site)) 
        || vids.find(v => /youtube/i.test(v.site))
      if (trailer && trailer.site.toLowerCase().includes('youtube')) {
        setTrailerKey(trailer.key)
      }
    } catch (err) {
      console.error('Failed to fetch details:', err)
    }
  }

  async function fetchSeasonDetails(seasonNumber) {
    if (!isTv || !details) return
    try {
      const res = await axios.get(`${API_BASE}/tmdb/tv/${id}/season/${seasonNumber}`)
      setSeasonDetails(res.data)
    } catch (err) {
      console.error('Failed to fetch season details:', err)
    }
  }

  // Arrow scroll handlers
  const scrollCast = (direction) => {
    if (!castContainerRef.current) return
    const scrollAmount = 600
    castContainerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    })
  }

  const rating = details?.vote_average ? details.vote_average.toFixed(1) : 'N/A'
  const voteCount = details?.vote_count || 0

  return (
    <div className="movie-page">
      {/* Hero Banner with fixed dimensions to prevent CLS */}
      <div 
        className={`movie-hero ${!details ? 'movie-hero-skeleton' : ''}`}
        style={{ 
          backgroundImage: details?.backdrop_path 
            ? `url(https://image.tmdb.org/t/p/w1280${details.backdrop_path}.webp)` 
            : 'none' 
        }}
      >
        <div className="hero-overlay">
          <div className="hero-content">
            <div className="hero-poster">
              {details ? (
                details.poster_path ? (
                  <img 
                    src={`https://image.tmdb.org/t/p/w500${details.poster_path}.webp`} 
                    alt={details.title || details.name}
                    width="280"
                    height="420"
                    loading="eager"
                  />
                ) : (
                  <img 
                    src={moviePlaceholder} 
                    alt={details.title || details.name} 
                    className="placeholder-img"
                    width="280"
                    height="420"
                  />
                )
              ) : (
                <div className="poster-skeleton" style={{ width: 280, height: 420 }}></div>
              )}
            </div>
            
            <div className="hero-info">
              {details ? (
                <>
                  <h1 className="movie-title">{details.title || details.name}</h1>
                  
                  {/* Rating */}
                  <div className="movie-rating">
                    <span className="rating-star">⭐</span>
                    <span className="rating-value">{rating}</span>
                    <span className="rating-count">({voteCount} votes)</span>
                  </div>

                  {/* Genres */}
                  <div className="movie-genres">
                    {details.genres?.map(g => (
                      <span key={g.id} className="genre-tag">{g.name}</span>
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
                    ) : availability?.available ? (
                      <button 
                        className="play-button" 
                        onClick={() => navigate(`/player/${isTv ? 'tv' : 'movie'}/${details.id}`)}
                      >
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
            <YouTubeEmbed videoKey={trailerKey}/>
          </div>
        )}

        {/* Seasons & Episodes Section (TV Shows Only) */}
        {isTv && details?.number_of_seasons > 0 && (
          <div className="section seasons-section">
            <h2 className="section-title">Seasons & Episodes</h2>
            
            {/* Season Selector */}
            <div className="season-selector">
              {Array.from({ length: details.number_of_seasons }, (_, i) => i + 1).map(seasonNum => (
                <button
                  key={seasonNum}
                  className={`season-btn ${selectedSeason === seasonNum ? 'active' : ''}`}
                  onClick={() => setSelectedSeason(seasonNum)}
                >
                  Season {seasonNum}
                </button>
              ))}
            </div>

            {/* Episodes List */}
            {seasonDetails && seasonDetails.episodes && (
              <div className="episodes-container">
                <div className="season-info">
                  <h3>{seasonDetails.name}</h3>
                  {seasonDetails.overview && <p className="season-overview">{seasonDetails.overview}</p>}
                </div>
                <div className="episodes-grid">
                  {seasonDetails.episodes.map(episode => (
                    <div 
                      key={episode.id} 
                      className="episode-card"
                      onClick={() => navigate(`/player/tv/${details.id}/${selectedSeason}/${episode.episode_number}`)}
                    >
                      <div className="episode-image-container">
                        {episode.still_path ? (
                          <img
                            src={`https://image.tmdb.org/t/p/w300${episode.still_path}.webp`}
                            alt={episode.name}
                            className="episode-image"
                            loading="lazy"
                          />
                        ) : (
                          <div className="episode-placeholder">
                            <span>E{episode.episode_number}</span>
                          </div>
                        )}
                        <div className="episode-number-badge">
                          Episode {episode.episode_number}
                        </div>
                        <div className="episode-play-overlay">
                          <span className="play-icon">▶</span>
                        </div>
                      </div>
                      <div className="episode-info">
                        <h4 className="episode-title">{episode.name}</h4>
                        <div className="episode-meta">
                          {episode.runtime && <span>{episode.runtime}min</span>}
                          {episode.vote_average > 0 && (
                            <span className="episode-rating">⭐ {episode.vote_average.toFixed(1)}</span>
                          )}
                        </div>
                        {episode.overview && (
                          <p className="episode-overview">
                            {episode.overview.length > 150 
                              ? episode.overview.slice(0, 150) + '...' 
                              : episode.overview}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Cast Section */}
        {details?.credits?.cast && details.credits.cast.length > 0 && (
          <div className="section cast-section">
            <h2 className="section-title">Cast</h2>
            <div className="cast-slider-wrapper">
              <button 
                className="cast-arrow cast-arrow-left" 
                onClick={() => scrollCast('left')}
                aria-label="Scroll left"
              >
                ‹
              </button>
              <div 
                className="cast-scroll-container"
                ref={castContainerRef}
              >
                <div className="cast-track">
                  {details.credits.cast.slice(0, 30).map(c => (
                    <Link 
                      key={c.id} 
                      to={`/person/${c.id}`} 
                      className="cast-card"
                    >
                      {c.profile_path ? (
                        <img 
                          src={`https://image.tmdb.org/t/p/w185${c.profile_path}.webp`} 
                          alt={c.name} 
                          className="cast-photo"
                          loading="lazy"
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
                  {/* Duplicate for loop */}
                  {details.credits.cast.slice(0, 30).map(c => (
                    <Link 
                      key={`dup-${c.id}`} 
                      to={`/person/${c.id}`} 
                      className="cast-card"
                    >
                      {c.profile_path ? (
                        <img 
                          src={`https://image.tmdb.org/t/p/w185${c.profile_path}.webp`} 
                          alt={c.name} 
                          className="cast-photo"
                          loading="lazy"
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
              <button 
                className="cast-arrow cast-arrow-right" 
                onClick={() => scrollCast('right')}
                aria-label="Scroll right"
              >
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
              {similar.slice(0, 12).map(s => (
                <div 
                  key={s.id} 
                  className="similar-card"
                  onClick={() => {
                    // Determine type: use media_type if available, or check for first_air_date vs release_date
                    const isShowTv = s.media_type === 'tv' || (s.first_air_date && !s.release_date) || (!s.title && s.name)
                    const type = isShowTv ? 'tv' : 'movie'
                    navigate(`/${type}/${s.id}`)
                    window.scrollTo(0, 0)
                  }}
                >
                  {s.poster_path ? (
                    <img 
                      src={`https://image.tmdb.org/t/p/w342${s.poster_path}.webp`} 
                      alt={s.title || s.name} 
                      className="similar-poster"
                      loading="lazy"
                    />
                  ) : (
                    <img 
                      src={moviePlaceholder} 
                      alt={s.title || s.name} 
                      className="similar-poster placeholder-img"
                    />
                  )}
                  <div className="similar-info">
                    <h3 className="similar-title">{s.title || s.name}</h3>
                    {s.vote_average > 0 && (
                      <div className="similar-rating">
                        ⭐ {s.vote_average.toFixed(1)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
