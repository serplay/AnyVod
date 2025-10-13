import React from 'react'

export default function MovieList({ movies = [], onSelect = () => {} }) {
  return (
    <div className="movie-grid">
      {movies.map((m) => (
        <div key={m.id} className="movie-card" onClick={() => onSelect(m)}>
          {m.poster_path ? (
            <img src={`https://image.tmdb.org/t/p/w342${m.poster_path}`} alt={m.title} />
          ) : (
            <div className="poster-placeholder">No Image</div>
          )}
          <div className="meta">
            <h3>{m.title ? m.title : m.name}</h3>
            <p>{m.release_date ? m.release_date : m.first_air_date}</p>
          </div>
        </div>
      ))}
    </div>
  )
}
