import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function PlayerPage() {
  const { kind, id, season, episode } = useParams()
  const navigate = useNavigate()
  const [embed, setEmbed] = useState(null)
  const [movieTitle, setMovieTitle] = useState('')
  const [showHeader, setShowHeader] = useState(true)
  const [tvDetails, setTvDetails] = useState(null)
  const [currentSeason, setCurrentSeason] = useState(season ? parseInt(season) : null)
  const [currentEpisode, setCurrentEpisode] = useState(episode ? parseInt(episode) : null)
  const [seasonData, setSeasonData] = useState(null)

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch movie/TV details for title
        try {
          const detailsEndpoint = kind === 'tv' ? `${API_BASE}/tmdb/tv/${id}` : `${API_BASE}/tmdb/movie/${id}`
          const detailsRes = await axios.get(detailsEndpoint)
          const details = detailsRes.data
          setMovieTitle(details.title || details.name || '')
          
          if (kind === 'tv') {
            setTvDetails(details)
            // If no season/episode specified, start at S1E1
            if (!currentSeason && !currentEpisode) {
              setCurrentSeason(1)
              setCurrentEpisode(1)
            }
          }
        } catch (err) {
          console.error('Failed to fetch title:', err)
        }

        // Fetch embed URL
        const embedEndpoint = kind === 'tv' ? `${API_BASE}/vidsrc/embed/tv` : `${API_BASE}/vidsrc/embed/movie`
        const params = kind === 'tv' && currentSeason && currentEpisode
          ? { tmdb: id, season: currentSeason, episode: currentEpisode }
          : { tmdb: id }
        const embedRes = await axios.get(embedEndpoint, { params })
        setEmbed(embedRes.data)
      } catch (err) {
        console.error(err)
      }
    }
    fetchData()
  }, [kind, id, currentSeason, currentEpisode])

  // Fetch season details to know total episodes
  useEffect(() => {
    if (kind === 'tv' && currentSeason && id) {
      fetchSeasonData(currentSeason)
    }
  }, [kind, id, currentSeason])

  async function fetchSeasonData(seasonNum) {
    try {
      const res = await axios.get(`${API_BASE}/tmdb/tv/${id}/season/${seasonNum}`)
      setSeasonData(res.data)
    } catch (err) {
      console.error('Failed to fetch season data:', err)
    }
  }

  // Auto-hide header after 3 seconds
  useEffect(() => {
    let timeout
    if (showHeader) {
      timeout = setTimeout(() => {
        setShowHeader(false)
      }, 3000)
    }
    return () => {
      if (timeout) clearTimeout(timeout)
    }
  }, [showHeader])

  // Show header on mouse move
  const handleMouseMove = () => {
    setShowHeader(true)
  }

  const handleBack = () => {
    navigate(-1)
  }

  const goToPreviousEpisode = () => {
    if (!seasonData || currentEpisode === null) return
    
    if (currentEpisode > 1) {
      // Previous episode in same season
      setCurrentEpisode(currentEpisode - 1)
      navigate(`/player/tv/${id}/${currentSeason}/${currentEpisode - 1}`, { replace: true })
    } else if (currentSeason > 1) {
      // Last episode of previous season
      const prevSeason = currentSeason - 1
      // We need to fetch previous season to know its episode count
      axios.get(`${API_BASE}/tmdb/tv/${id}/season/${prevSeason}`)
        .then(res => {
          const lastEp = res.data.episodes?.length || 1
          setCurrentSeason(prevSeason)
          setCurrentEpisode(lastEp)
          navigate(`/player/tv/${id}/${prevSeason}/${lastEp}`, { replace: true })
        })
        .catch(err => console.error('Failed to fetch previous season:', err))
    }
  }

  const goToNextEpisode = () => {
    if (!seasonData || currentEpisode === null || !tvDetails) return
    
    const totalEpisodes = seasonData.episodes?.length || 0
    
    if (currentEpisode < totalEpisodes) {
      // Next episode in same season
      setCurrentEpisode(currentEpisode + 1)
      navigate(`/player/tv/${id}/${currentSeason}/${currentEpisode + 1}`, { replace: true })
    } else if (currentSeason < tvDetails.number_of_seasons) {
      // First episode of next season
      const nextSeason = currentSeason + 1
      setCurrentSeason(nextSeason)
      setCurrentEpisode(1)
      navigate(`/player/tv/${id}/${nextSeason}/1`, { replace: true })
    }
  }

  const canGoPrevious = () => {
    return currentSeason > 1 || (currentEpisode && currentEpisode > 1)
  }

  const canGoNext = () => {
    if (!seasonData || !tvDetails || currentEpisode === null) return false
    const totalEpisodes = seasonData.episodes?.length || 0
    return currentEpisode < totalEpisodes || currentSeason < tvDetails.number_of_seasons
  }

  return (
    <div className="player-page">
      {/* Transparent overlay to capture mouse events */}
      <div className="player-mouse-overlay" onMouseMove={handleMouseMove}></div>
      
      {/* Header with back button and title */}
      <div className={`player-header ${showHeader ? 'visible' : ''}`}>
        <button className="player-back-btn" onClick={handleBack} title="Back">
          ✕
        </button>
        <h2 className="player-title">
          {movieTitle}
          {kind === 'tv' && currentSeason && currentEpisode && (
            <span className="episode-info-badge"> S{currentSeason}E{currentEpisode}</span>
          )}
        </h2>
      </div>

      {/* Episode Navigation (TV Shows only) */}
      {kind === 'tv' && currentSeason && currentEpisode && (
        <div className={`episode-nav ${showHeader ? 'visible' : ''}`}>
          <button 
            className="episode-nav-btn prev-episode-btn" 
            onClick={goToPreviousEpisode}
            disabled={!canGoPrevious()}
            title="Previous Episode"
          >
            ⏮ Previous
          </button>
          <button 
            className="episode-nav-btn next-episode-btn" 
            onClick={goToNextEpisode}
            disabled={!canGoNext()}
            title="Next Episode"
          >
            Next ⏭
          </button>
        </div>
      )}

      {embed?.embed_url ? (
        <iframe 
          title="player" 
          src={embed.embed_url} 
          className="player-iframe"
          allowFullScreen 
          frameBorder={0}
        />
      ) : (
        <div className="player-loading">Loading player...</div>
      )}
    </div>
  )
}
