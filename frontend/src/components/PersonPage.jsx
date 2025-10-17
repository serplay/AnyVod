import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function PersonPage() {
  const { id } = useParams()
  const [person, setPerson] = useState(null)
  const [credits, setCredits] = useState(null)

  useEffect(() => {
    fetchPerson()
    // eslint-disable-next-line
  }, [id])

  async function fetchPerson() {
    try {
      const res = await axios.get(`${API_BASE}/tmdb/person/${id}`)
      setPerson(res.data)
      const creditsRes = await axios.get(`${API_BASE}/tmdb/person/${id}/combined_credits`)
      setCredits(creditsRes.data)
    } catch (err) {
      console.error(err)
    }
  }

  if (!person) return <div className="details">Loading person...</div>

  return (
    <div className="details-page">
      <div className="details" style={{ maxWidth: 900, margin: '20px auto' }}>
        <div style={{ display: 'flex', gap: 16 }}>
          {person.profile_path && <img src={`https://image.tmdb.org/t/p/w342${person.profile_path}`} alt={person.name} style={{ width: 220, borderRadius: 8 }} />}
          <div>
            <h2>{person.name}</h2>
            <div style={{ color: 'var(--muted)' }}>{person.place_of_birth} — {person.birthday}</div>
            <p style={{ marginTop: 12 }}>{person.biography}</p>
          </div>
        </div>

        {credits && (
          <div style={{ marginTop: 16 }}>
            <h3>Known For</h3>
            <div className="movie-grid">
              {credits.cast?.slice(0, 12).map(c => (
                <div key={c.credit_id} className="movie-card">
                  <Link to={`/${c.media_type}/${c.id}`}>
                    {c.poster_path ? (
                      <img src={`https://image.tmdb.org/t/p/w342${c.poster_path}`} alt={c.title || c.name} />
                    ) : (
                      <div className="poster-placeholder">No Image</div>
                    )}
                    <div className="meta">
                      <h3 style={{ fontSize: 14 }}>{c.title || c.name}</h3>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>{c.character}</div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
