import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import axios from 'axios'

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
  const [details, setDetails] = useState(null)
  const [similar, setSimilar] = useState([])
  const [trailerKey, setTrailerKey] = useState(null)
  const castContainerRef = React.useRef(null)

  const isTv = !!details?.number_of_seasons || details?.media_type === 'tv'

  useEffect(() => {
    fetchDetails()
  }, [id])

  async function fetchDetails() {
    try {
      // Try movie first, then TV
      let res = null
      try {
        res = await axios.get(`${API_BASE}/tmdb/movie/${id}`)
      } catch (err) {
        res = await axios.get(`${API_BASE}/tmdb/tv/${id}`)
      }
      setDetails(res.data)

      // Fetch similar titles
      try {
        const simEndpoint = res.data.media_type === 'tv' || res.data.number_of_seasons 
          ? `${API_BASE}/tmdb/tv/${res.data.id}/similar` 
          : `${API_BASE}/tmdb/movie/${res.data.id}/similar`
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

  // Arrow scroll handlers
  const scrollCast = (direction) => {
    if (!castContainerRef.current) return
    const scrollAmount = 600
    castContainerRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    })
  }

  if (!details) return <div className="details">Loading...</div>

  const rating = details.vote_average ? details.vote_average.toFixed(1) : 'N/A'
  const voteCount = details.vote_count || 0

  return (
    <div className="movie-page">
      {/* Hero Banner */}
      <div 
        className="movie-hero" 
        style={{ 
          backgroundImage: details.backdrop_path 
            ? `url(https://image.tmdb.org/t/p/original${details.backdrop_path})` 
            : 'none' 
        }}
      >
        <div className="hero-overlay">
          <div className="hero-content">
            <div className="hero-poster">
              {details.poster_path && (
                <img 
                  src={`https://image.tmdb.org/t/p/w500${details.poster_path}`} 
                  alt={details.title || details.name} 
                />
              )}
            </div>
            
            <div className="hero-info">
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

              {/* Play Button */}
              <button 
                className="play-button" 
                onClick={() => navigate(`/player/${isTv ? 'tv' : 'movie'}/${details.id}`)}
              >
                ▶ Play Now
              </button>
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

        {/* Cast Section */}
        {details.credits?.cast && details.credits.cast.length > 0 && (
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
                          src={`https://image.tmdb.org/t/p/w185${c.profile_path}`} 
                          alt={c.name} 
                          className="cast-photo"
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
                          src={`https://image.tmdb.org/t/p/w185${c.profile_path}`} 
                          alt={c.name} 
                          className="cast-photo"
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
                    const type = s.media_type || (s.title ? 'movie' : 'tv')
                    navigate(`/${type}/${s.id}`)
                    window.scrollTo(0, 0)
                  }}
                >
                  {s.poster_path ? (
                    <img 
                      src={`https://image.tmdb.org/t/p/w342${s.poster_path}`} 
                      alt={s.title || s.name} 
                      className="similar-poster"
                    />
                  ) : (
                    <div className="similar-placeholder">
                      <span>{(s.title || s.name)?.charAt(0)}</span>
                    </div>
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
