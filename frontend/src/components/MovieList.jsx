import React, { useRef } from 'react'
import moviePlaceholder from '../assets/movie.png'

export default function MovieList({ movies = [], onSelect = () => {} }) {
  const handleMove = (e) => {
    const card = e.currentTarget
    const inner = card.querySelector('.movie-card-inner')
    const rect = card.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const cx = rect.width / 2
    const cy = rect.height / 2
    const dx = (x - cx) / cx
    const dy = (y - cy) / cy
    const max = 12 // max degrees
    const tiltX = (-dy * max).toFixed(2)
    const tiltY = (dx * max).toFixed(2)
    inner.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateZ(8px)`
  }

  const handleLeave = (e) => {
    const inner = e.currentTarget.querySelector('.movie-card-inner')
    inner.style.transform = ''
  }

  return (
    <div className="movie-grid">
      {movies.map((m) => (
        <div
          key={m.id}
          className="movie-card"
          onClick={() => onSelect(m)}
          onMouseMove={handleMove}
          onMouseLeave={handleLeave}
          itemtype="https://schema.org/Movie"
        >
          <div className="movie-card-inner">
            {m.poster_path ? (
              <img src={`https://image.tmdb.org/t/p/w342${m.poster_path}.webp`} alt={m.title} loading="lazy" />
            ) : (
              <img src={moviePlaceholder} alt={m.title || m.name} className="placeholder-img" />
            )}
            <div className="meta">
              <h3>{m.title ? m.title : m.name}</h3>
              <p>{m.release_date ? m.release_date : m.first_air_date}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
