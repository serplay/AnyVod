import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function PlayerPage() {
  const { kind, id } = useParams()
  const navigate = useNavigate()
  const [embed, setEmbed] = useState(null)
  const [movieTitle, setMovieTitle] = useState('')
  const [showHeader, setShowHeader] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch embed URL
        const embedEndpoint = kind === 'tv' ? `${API_BASE}/vidsrc/embed/tv` : `${API_BASE}/vidsrc/embed/movie`
        const embedRes = await axios.get(embedEndpoint, { params: { tmdb: id } })
        setEmbed(embedRes.data)

        // Fetch movie/TV details for title
        try {
          const detailsEndpoint = kind === 'tv' ? `${API_BASE}/tmdb/tv/${id}` : `${API_BASE}/tmdb/movie/${id}`
          const detailsRes = await axios.get(detailsEndpoint)
          setMovieTitle(detailsRes.data.title || detailsRes.data.name || '')
        } catch (err) {
          console.error('Failed to fetch title:', err)
        }
      } catch (err) {
        console.error(err)
      }
    }
    fetchData()
  }, [kind, id])

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

  return (
    <div className="player-page">
      {/* Transparent overlay to capture mouse events */}
      <div className="player-mouse-overlay" onMouseMove={handleMouseMove}></div>
      
      {/* Header with back button and title */}
      <div className={`player-header ${showHeader ? 'visible' : ''}`}>
        <button className="player-back-btn" onClick={handleBack} title="Back">
          ✕
        </button>
        <h2 className="player-title">{movieTitle}</h2>
      </div>

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
