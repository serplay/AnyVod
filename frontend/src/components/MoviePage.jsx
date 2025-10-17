import React, { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w342'

function Tabs({ tabs, active, onChange }) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button key={t} className={`tab-btn ${active === t ? 'active' : ''}`} onClick={() => onChange(t)}>{t}</button>
      ))}
    </div>
  )
}

function YouTubeEmbed({ videoKey }) {
  if (!videoKey) return null
  const src = `https://www.youtube.com/embed/${videoKey}`
  return (
    <div className="player" style={{ marginTop: 12, position: 'relative', paddingTop: '56.25%' }}>
      <iframe src={src} title="trailer" style={{ position: 'absolute', top:0, left:0, width: '100%', height: '100%' }} frameBorder={0} allowFullScreen />
    </div>
  )
}

export default function MoviePage() {
  const { id } = useParams()
  const [details, setDetails] = useState(null)
  const [streams, setStreams] = useState(null)
  const [seasonDetails, setSeasonDetails] = useState(null)
  const [activeTab, setActiveTab] = useState('Overview')
  const [trailerKey, setTrailerKey] = useState(null)
  const playerRef = React.useRef(null)
  const navigate = useNavigate()
  const [similar, setSimilar] = useState([])

  const isTv = !!details?.number_of_seasons || details?.media_type === 'tv'

  useEffect(() => {
    fetchDetails()
    fetchStreams()
    // eslint-disable-next-line
  }, [id])

  async function fetchDetails() {
    try {
      // first try movie then tv if movie returns 404
      let res = null
      try {
        res = await axios.get(`${API_BASE}/tmdb/movie/${id}`)
      } catch (err) {
        res = await axios.get(`${API_BASE}/tmdb/tv/${id}`)
      }
      setDetails(res.data)
      // fetch similar titles
      try {
        const simEndpoint = res.data.media_type === 'tv' || res.data.number_of_seasons ? `${API_BASE}/tmdb/tv/${res.data.id}/similar` : `${API_BASE}/tmdb/movie/${res.data.id}/similar`
        const simRes = await axios.get(simEndpoint)
        setSimilar(simRes.data.results || [])
      } catch (e) {
        // ignore
      }
      // pick a trailer (youtube/vimeo)
      const vids = (res.data.videos && res.data.videos.results) || []
      const trailer = vids.find(v => /trailer/i.test(v.type) && /youtube|vimeo/i.test(v.site)) || vids.find(v => /youtube|vimeo/i.test(v.site))
      if (trailer && trailer.site.toLowerCase().includes('youtube')) {
        setTrailerKey(trailer.key)
      } else if (trailer && trailer.site.toLowerCase().includes('vimeo')) {
        setTrailerKey(null) // Vimeo handling could be added
      }
    } catch (err) {
      console.error(err)
    }
  }

  async function fetchStreams() {
    try {
      // ask backend for vidsrc embed
      const isProbablyTv = !!details?.number_of_seasons
      const endpoint = isProbablyTv ? `${API_BASE}/vidsrc/embed/tv` : `${API_BASE}/vidsrc/embed/movie`
      const params = { tmdb: id }
      const res = await axios.get(endpoint, { params })
      setStreams(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  async function fetchSeason(seasonNumber) {
    try {
      const res = await axios.get(`${API_BASE}/tmdb/tv/${id}/season/${seasonNumber}`)
      setSeasonDetails(res.data)
    } catch (err) {
      console.error(err)
    }
  }

  if (!details) return <div className="details">Loading...</div>

  const tabs = ['Overview']
  if (details.seasons && details.seasons.length > 0) tabs.push('Episodes')

  return (
    <div className="details-page">
      {/* Hero */}
      <div className="movie-hero" style={{ backgroundImage: details.backdrop_path ? `url(https://image.tmdb.org/t/p/original${details.backdrop_path})` : 'none' }}>
        <div className="hero-dim">
          <div className="hero-inner">
            <div className="hero-poster">
              {details.poster_path && <img src={`https://image.tmdb.org/t/p/w342${details.poster_path}`} alt={details.title || details.name} />}
            </div>
            <div className="hero-meta">
              <h1 className="hero-title">{details.title || details.name}</h1>
              <div className="hero-genres">
                {details.genres?.map(g => <span key={g.id}>{g.name}</span>)}
              </div>
              <p className="hero-overview">{details.overview}</p>
              <div className="hero-ctas">
                <button className="play-btn" onClick={() => navigate(`/player/${isTv ? 'tv' : 'movie'}/${details.id}`)}>Play</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="details" style={{ maxWidth: 1100, margin: '20px auto' }}>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <h2 style={{ display: 'none' }}>{details.title || details.name}</h2>
            <div style={{ color: 'var(--muted)' }}>{details.tagline}</div>
            <div style={{ marginTop: 8 }}>
              {details.genres?.map(g => <span key={g.id} style={{ marginRight: 8, color: 'var(--muted)' }}>{g.name}</span>)}
            </div>
            <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

            {/* Cast marquee — always visible */}
            <div className="cast-marquee" aria-label="Cast members">
              <div className="cast-track">
                {details.credits?.cast?.slice(0, 40).map(c => (
                  <div key={c.id} className="cast-card">
                    <Link to={`/person/${c.id}`} className="cast-link">
                      {c.profile_path ? (
                        <img src={`https://image.tmdb.org/t/p/w185${c.profile_path}`} alt={c.name} style={{ width: 100, borderRadius: 8 }} />
                      ) : (
                        <div style={{ width: 100, height: 140, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }} />
                      )}
                      <div style={{ fontSize: 13, color: 'var(--muted)' }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: 'rgba(159,176,200,0.7)' }}>{c.character}</div>
                    </Link>
                  </div>
                ))}
                {details.credits?.cast?.slice(0, 40).map(c => (
                  <div key={`dup-${c.id}`} className="cast-card">
                    <Link to={`/person/${c.id}`} className="cast-link">
                      {c.profile_path ? (
                        <img src={`https://image.tmdb.org/t/p/w185${c.profile_path}`} alt={c.name} style={{ width: 100, borderRadius: 8 }} />
                      ) : (
                        <div style={{ width: 100, height: 140, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }} />
                      )}
                      <div style={{ fontSize: 13, color: 'var(--muted)' }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: 'rgba(159,176,200,0.7)' }}>{c.character}</div>
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              {activeTab === 'Overview' && (
                <div>
                  <p>{details.overview}</p>
                  <div style={{ marginTop: 8 }}>
                    <strong>Runtime:</strong> {details.runtime || details.episode_run_time?.[0] || 'N/A'}
                  </div>
                </div>
              )}

              {/* Similar movies */}
              <div style={{ marginTop: 14 }}>
                <h3>Similar</h3>
                <div className="movie-grid">
                  {similar.slice(0, 12).map(s => (
                    <div key={s.id} className="movie-card" onClick={() => navigate(`/${s.media_type || (s.title ? 'movie' : 'tv')}/${s.id}`)}>
                      {s.poster_path ? (
                        <img src={`https://image.tmdb.org/t/p/w342${s.poster_path}`} alt={s.title || s.name} />
                      ) : (
                        <div className="poster-placeholder">No Image</div>
                      )}
                      <div className="meta"><h3>{s.title || s.name}</h3></div>
                    </div>
                  ))}
                </div>
              </div>

              {activeTab === 'Episodes' && (
                <div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    {details.seasons?.map(s => (
                      <button key={s.id} className="clear-btn" onClick={() => fetchSeason(s.season_number)}>{s.name || `Season ${s.season_number}`}</button>
                    ))}
                  </div>
                  {seasonDetails && (
                    <div style={{ marginTop: 12 }}>
                      <h3>{seasonDetails.name}</h3>
                      <div>{seasonDetails.overview}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginTop: 12 }}>
                        {seasonDetails.episodes.map(ep => (
                          <div key={ep.id} style={{ background: 'rgba(255,255,255,0.02)', padding: 8, borderRadius: 8 }}>
                            <strong>{ep.episode_number}. {ep.name}</strong>
                            <div style={{ fontSize: 13, color: 'var(--muted)' }}>{ep.overview}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'More' && (
                <div>
                  <div><strong>Release Date:</strong> {details.release_date || details.first_air_date}</div>
                  <div style={{ marginTop: 8 }}>
                    <strong>Vote:</strong> {details.vote_average} ({details.vote_count} votes)
                  </div>
                </div>
              )}
            </div>

            <div ref={playerRef} className="player-wrap-container" style={{ marginTop: 16 }}>
              {trailerKey && (
                <div className="player-wrap">
                  <YouTubeEmbed videoKey={trailerKey} />
                </div>
              )}

              {streams?.embed_url ? (
                <div style={{ marginTop: 16 }}>
                  <h3>Player</h3>
                  <div className="player-wrap">
                    <iframe title="vidsrc-player" src={streams.embed_url} frameBorder={0} allowFullScreen />
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: 12, color: 'var(--muted)' }}>Loading player...</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
