import React, { useEffect, useState } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function MovieDetails({ movie, onClose }) {
  const [details, setDetails] = useState(null)
  const [streams, setStreams] = useState(null)
  const [playing, setPlaying] = useState(null)

  useEffect(() => {
    fetchDetails()
    fetchStreams()
    // eslint-disable-next-line
  }, [movie])

  async function fetchDetails() {
    try {
      const res = await axios.get(`${API_BASE}/tmdb/movie/${movie.id}`)
      setDetails(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  async function fetchStreams() {
    try {
      // Request a vidsrc embed URL from backend using tmdb id
      const res = await axios.get(`${API_BASE}/vidsrc/embed/movie`, { params: { tmdb: movie.id } })
      // backend returns { embed_url }
      setStreams(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  function chooseStream(s) {
    // s.url expected
    setPlaying(s.url || s.file || null)
  }

  return (
    <div className="details-overlay">
      <div className="details">
        <button className="close" onClick={onClose}>Close</button>
        <h2>{movie.title}</h2>
        {details?.overview && <p>{details.overview}</p>}

        {streams ? (
          <div>
            <h3>Player</h3>
            {streams.embed_url ? (
              <div style={{ position: 'relative', paddingTop: '56.25%' }}>
                <iframe
                  title="vidsrc-player"
                  src={streams.embed_url}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                  allowFullScreen
                  frameBorder={0}
                />
              </div>
            ) : (
              <p>No embed URL returned from backend</p>
            )}
          </div>
        ) : (
          <p>Loading player...</p>
        )}
      </div>
    </div>
  )
}
