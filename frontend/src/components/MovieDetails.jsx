import React, { useEffect, useState } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w342'

export default function MovieDetails({ movie, onClose }) {
  const [details, setDetails] = useState(null)
  const [streams, setStreams] = useState(null)
  const [seasonDetails, setSeasonDetails] = useState(null)

  const isTv = movie.media_type === 'tv' || !!movie.first_air_date

  useEffect(() => {
    fetchDetails()
    fetchStreams()
    // eslint-disable-next-line
  }, [movie])

  async function fetchDetails() {
    try {
      const url = isTv ? `${API_BASE}/tmdb/tv/${movie.id}` : `${API_BASE}/tmdb/movie/${movie.id}`
      const res = await axios.get(url)
      setDetails(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  async function fetchStreams() {
    try {
      const endpoint = isTv ? `${API_BASE}/vidsrc/embed/tv` : `${API_BASE}/vidsrc/embed/movie`
      const params = isTv ? { tmdb: movie.id } : { tmdb: movie.id }
      const res = await axios.get(endpoint, { params })
      setStreams(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  async function fetchSeason(seasonNumber) {
    try {
      const res = await axios.get(`${API_BASE}/tmdb/tv/${movie.id}/season/${seasonNumber}`)
      setSeasonDetails(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  return (
    <div className="details-overlay">
      <div className="details">
        <button className="close" onClick={onClose}>Close</button>

        <div className="details-top" style={{ display: 'flex', gap: 16 }}>
          {details?.poster_path && (
            <img src={`${TMDB_IMAGE_BASE}${details.poster_path}`} alt={details.title || details.name} style={{ width: 200, borderRadius: 8 }} />
          )}
          <div>
            <h2>{details?.title || details?.name || movie.title || movie.name}</h2>
            {details?.genres && (
              <div style={{ marginBottom: 8 }}>
                {details.genres.map((g) => (
                  <span key={g.id} style={{ marginRight: 8, color: 'var(--muted)', fontSize: 13 }}>{g.name}</span>
                ))}
              </div>
            )}
            {details?.overview && <p style={{ maxWidth: 640 }}>{details.overview}</p>}
            {isTv ? (
              <div style={{ marginTop: 8 }}>
                <strong>Seasons:</strong>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                  {details?.seasons?.map((s) => (
                    <button key={s.id} onClick={() => fetchSeason(s.season_number)} className="clear-btn">{s.name || `Season ${s.season_number}`}</button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ marginTop: 8 }}>
                <strong>Runtime:</strong> {details?.runtime ? `${details.runtime} min` : 'N/A'}
              </div>
            )}
          </div>
        </div>

        {/* Cast */}
        {details?.credits?.cast && (
          <div style={{ marginTop: 16 }}>
            <h3>Cast</h3>
            <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
              {details.credits.cast.slice(0, 12).map((c) => (
                <div key={c.cast_id || c.credit_id} style={{ width: 110, textAlign: 'center' }}>
                  {c.profile_path ? (
                    <img src={`https://image.tmdb.org/t/p/w185${c.profile_path}`} alt={c.name} style={{ width: 100, borderRadius: 8 }} />
                  ) : (
                    <div style={{ width: 100, height: 140, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }} />
                  )}
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: 'rgba(159,176,200,0.7)' }}>{c.character}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Season details */}
        {seasonDetails && (
          <div style={{ marginTop: 16 }}>
            <h3>{seasonDetails.name}</h3>
            <div>{seasonDetails.overview}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginTop: 12 }}>
              {seasonDetails.episodes.map((ep) => (
                <div key={ep.id} style={{ background: 'rgba(255,255,255,0.02)', padding: 8, borderRadius: 8 }}>
                  <strong>{ep.episode_number}. {ep.name}</strong>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>{ep.overview}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Player */}
        {streams ? (
          <div style={{ marginTop: 16 }}>
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
