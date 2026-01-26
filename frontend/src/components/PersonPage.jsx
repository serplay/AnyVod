import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import moviePlaceholder from '../assets/movie.png'
import { ProfileImage, PosterImage } from './OptimizedImage'
import ScrollToTop from './ScrollTop'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function PersonPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [person, setPerson] = useState(null)
  const [credits, setCredits] = useState(null)

  useEffect(() => {
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
    fetchPerson()
  }, [id])

  if (!person) return <div className="person-loading">Loading...</div>

  // Calculate age if birthday exists
  const calculateAge = (birthday) => {
    if (!birthday) return null
    const today = new Date()
    const birthDate = new Date(birthday)
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }
    return age
  }

  const age = calculateAge(person.birthday)

  // Sort and get top credits by popularity
  const topCredits = credits?.cast
    ? [...credits.cast]
        .filter(c => c.poster_path)
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
        .slice(0, 18)
    : []

  return (
    <div className="person-page">
      {/* Hero Section */}
      <div className="person-hero">
        <div className="person-hero-gradient"></div>
        <div className="person-hero-content">
          <div className="person-profile-container">
            {person.profile_path ? (
              <ProfileImage
                path={person.profile_path}
                alt={person.name}
                size="large"
                className="person-profile-img"
                style={{ width: 320, height: 480 }}
              />
            ) : (
              <div className="person-profile-placeholder">
                {person.name.charAt(0)}
              </div>
            )}
          </div>

          <div className="person-info">
            <h1 className="person-name">{person.name}</h1>
            
            <div className="person-meta">
              {person.known_for_department && (
                <span className="person-tag">{person.known_for_department}</span>
              )}
              {age && <span className="person-detail">Age: {age}</span>}
              {person.place_of_birth && (
                <span className="person-detail">📍 {person.place_of_birth}</span>
              )}
            </div>

            {person.biography && (
              <div className="person-bio-preview">
                {person.biography.slice(0, 300)}
                {person.biography.length > 300 ? '...' : ''}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="person-content">
        {/* Personal Info */}
        <section className="person-section">
          <h2 className="person-section-title">Personal Info</h2>
          <div className="person-info-grid">
            {person.birthday && (
              <div className="info-item">
                <div className="info-label">Birthday</div>
                <div className="info-value">{person.birthday}</div>
              </div>
            )}
            {person.place_of_birth && (
              <div className="info-item">
                <div className="info-label">Place of Birth</div>
                <div className="info-value">{person.place_of_birth}</div>
              </div>
            )}
            {person.known_for_department && (
              <div className="info-item">
                <div className="info-label">Known For</div>
                <div className="info-value">{person.known_for_department}</div>
              </div>
            )}
            {person.popularity && (
              <div className="info-item">
                <div className="info-label">Popularity</div>
                <div className="info-value">{person.popularity.toFixed(1)}</div>
              </div>
            )}
          </div>
        </section>

        {/* Known For / Credits */}
        {topCredits.length > 0 && (
          <section className="person-section">
            <h2 className="person-section-title">Known For</h2>
            <div className="person-credits-grid">
              {topCredits.map(credit => (
                <div 
                  key={credit.credit_id} 
                  className="person-credit-card"
                  onClick={() => {
                    navigate(`/${credit.media_type}/${credit.id}`)
                    window.scrollTo(0, 0)
                  }}
                >
                  {credit.poster_path ? (
                    <PosterImage
                      path={credit.poster_path}
                      alt={credit.title || credit.name}
                      size="medium"
                      className="credit-poster"
                    />
                  ) : (
                    <img 
                      src={moviePlaceholder} 
                      alt={credit.title || credit.name}
                      className="credit-poster placeholder-img"
                    />
                  )}
                  <div className="credit-info">
                    <h3 className="credit-title">{credit.title || credit.name}</h3>
                    {credit.character && (
                      <div className="credit-character">as {credit.character}</div>
                    )}
                    {credit.vote_average > 0 && (
                      <div className="credit-rating">
                        ⭐ {credit.vote_average.toFixed(1)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
