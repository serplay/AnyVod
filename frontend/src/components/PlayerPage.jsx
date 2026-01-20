import React, { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function PlayerPage() {
  const { kind, id, season, episode } = useParams()
  const navigate = useNavigate()
  const [embed, setEmbed] = useState(null)
  const [movieTitle, setMovieTitle] = useState('')
  const [posterPath, setPosterPath] = useState('')
  const [tvDetails, setTvDetails] = useState(null)
  const [currentSeason, setCurrentSeason] = useState(season ? parseInt(season) : null)
  const [currentEpisode, setCurrentEpisode] = useState(episode ? parseInt(episode) : null)
  const [seasonData, setSeasonData] = useState(null)
  const [episodeSearch, setEpisodeSearch] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const episodeListRef = useRef(null)

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch movie/TV details for title
        try {
          const detailsEndpoint = kind === 'tv' ? `${API_BASE}/tmdb/tv/${id}` : `${API_BASE}/tmdb/movie/${id}`
          const detailsRes = await axios.get(detailsEndpoint)
          const details = detailsRes.data
          setMovieTitle(details.title || details.name || '')
          setPosterPath(details.poster_path || '')
          
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

  // Scroll to current episode when season data loads
  useEffect(() => {
    if (episodeListRef.current && currentEpisode) {
      const activeEpisode = episodeListRef.current.querySelector('.episode-item.active')
      if (activeEpisode) {
        activeEpisode.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [seasonData, currentEpisode])

  const handleBack = () => {
    navigate(`/${kind}/${id}`, { replace: true })
  }

  const selectEpisode = (epNum) => {
    setCurrentEpisode(epNum)
    navigate(`/player/tv/${id}/${currentSeason}/${epNum}`, { replace: true })
  }

  const selectSeason = (seasonNum) => {
    setCurrentSeason(seasonNum)
    setCurrentEpisode(1)
    navigate(`/player/tv/${id}/${seasonNum}/1`, { replace: true })
  }

  const goToPreviousEpisode = () => {
    if (!seasonData || currentEpisode === null) return
    
    if (currentEpisode > 1) {
      selectEpisode(currentEpisode - 1)
    } else if (currentSeason > 1) {
      const prevSeason = currentSeason - 1
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
      selectEpisode(currentEpisode + 1)
    } else if (currentSeason < tvDetails.number_of_seasons) {
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

  // Filter episodes based on search
  const filteredEpisodes = seasonData?.episodes?.filter(ep => {
    if (!episodeSearch) return true
    const searchLower = episodeSearch.toLowerCase()
    return (
      ep.name?.toLowerCase().includes(searchLower) ||
      ep.episode_number?.toString().includes(searchLower)
    )
  }) || []

  // Generate season tabs
  const seasonTabs = tvDetails?.number_of_seasons 
    ? Array.from({ length: tvDetails.number_of_seasons }, (_, i) => i + 1)
    : []

  // For movies, show a simpler layout
  if (kind === 'movie') {
    return (
      <div className="player-page player-page-movie">
        <div className="player-header-movie">
          <button className="player-back-btn" onClick={handleBack} title="Back">
            ✕
          </button>
          <h2 className="player-title-movie">{movieTitle}</h2>
        </div>
        <div className="player-main-movie">
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
      </div>
    )
  }

  // TV Show layout with sidebar
  return (
    <div className={`player-page player-page-tv ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Episode Sidebar */}
      <aside className={`episode-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-title-row">
            <span className="sidebar-label">List of episodes:</span>
            <button 
              className="sidebar-collapse-btn"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? 'Expand' : 'Collapse'}
            >
              {sidebarCollapsed ? '▶' : '◀'}
            </button>
          </div>
          {!sidebarCollapsed && (
            <div className="episode-search">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Number of Ep"
                value={episodeSearch}
                onChange={(e) => setEpisodeSearch(e.target.value)}
                className="episode-search-input"
              />
            </div>
          )}
        </div>

        {!sidebarCollapsed && (
          <div className="episode-list" ref={episodeListRef}>
            {filteredEpisodes.map((ep) => (
              <div
                key={ep.episode_number}
                className={`episode-item ${currentEpisode === ep.episode_number ? 'active' : ''}`}
                onClick={() => selectEpisode(ep.episode_number)}
              >
                <span className="episode-number">{ep.episode_number}</span>
                <span className="episode-name">{ep.name || `Episode ${ep.episode_number}`}</span>
                {currentEpisode === ep.episode_number && (
                  <span className="episode-playing-icon">▶</span>
                )}
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* Collapsed sidebar toggle */}
      {sidebarCollapsed && (
        <button 
          className="sidebar-expand-btn"
          onClick={() => setSidebarCollapsed(false)}
          title="Show episodes"
        >
          ▶
        </button>
      )}

      {/* Main Content */}
      <main className="player-main">
        {/* Top header bar */}
        <div className="player-top-bar">
          <button className="player-back-btn" onClick={handleBack} title="Back to details">
            ✕
          </button>
          <h1 className="player-show-title">{movieTitle}</h1>
        </div>

        {/* Video Player */}
        <div className="player-video-container">
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

        {/* Player Controls */}
        <div className="player-controls-bar">
          <div className="player-controls-left">
            <span className="now-watching">
              You are watching <strong>Episode {currentEpisode}</strong>
            </span>
            <span className="server-hint">If current server doesn't work, please try other servers.</span>
          </div>
          <div className="player-controls-center">
            <button 
              className="control-btn prev-btn"
              onClick={goToPreviousEpisode}
              disabled={!canGoPrevious()}
            >
              ◀ Prev
            </button>
            <button 
              className="control-btn next-btn"
              onClick={goToNextEpisode}
              disabled={!canGoNext()}
            >
              Next ▶
            </button>
          </div>
        </div>

        {/* Season Selector */}
        {seasonTabs.length > 1 && (
          <div className="season-selector">
            <span className="season-label">Seasons:</span>
            <div className="season-tabs">
              {seasonTabs.map(sNum => (
                <button
                  key={sNum}
                  className={`season-tab ${currentSeason === sNum ? 'active' : ''}`}
                  onClick={() => selectSeason(sNum)}
                >
                  Season {sNum}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
