import React, { useState, useEffect } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function Search({ onSearch = () => {}, onClear = () => {} }) {
  const [q, setQ] = useState('')
  const [type, setType] = useState('All')
  const [year, setYear] = useState('')
  const [sortBy, setSortBy] = useState('relevance')
  const [minRating, setMinRating] = useState('')
  const [genre, setGenre] = useState('')
  const [genres, setGenres] = useState([])
  const [showFilters, setShowFilters] = useState(false)

  // Fetch genres when type changes
  useEffect(() => {
    fetchGenres()
  }, [type])

  async function fetchGenres() {
    try {
      if (type === 'person') {
        setGenres([])
        return
      }
      // Fetch movie genres by default, or TV genres if type is tv
      const endpoint = type === 'tv' 
        ? `${API_BASE}/tmdb/genres/tv` 
        : `${API_BASE}/tmdb/genres/movie`
      const res = await axios.get(endpoint)
      setGenres(res.data.genres || [])
    } catch (err) {
      console.error('Failed to fetch genres:', err)
      setGenres([])
    }
  }

  function submit(e) {
    e.preventDefault()
    const query = q.trim()
    if (!query) return
    
    document.title = `AnyVod - ${query.charAt(0).toUpperCase() + query.slice(1)}`
    
    onSearch({ 
      query, 
      filters: { 
        type: type === 'All' ? undefined : type.toLowerCase(),
        year: year ? Number(year) : undefined,
        sortBy,
        minRating: minRating ? Number(minRating) : undefined,
        genre: genre ? Number(genre) : undefined
      } 
    })
  }

  function clear() {
    setQ('')
    setYear('')
    setType('All')
    setSortBy('relevance')
    setMinRating('')
    setGenre('')
    document.title = 'AnyVod'
    onClear()
  }

  // Generate rating options (1-10 stars)
  const ratingOptions = [
    { value: '', label: 'Any' },
    { value: '9', label: '9+ ⭐' },
    { value: '8', label: '8+ ⭐' },
    { value: '7', label: '7+ ⭐' },
    { value: '6', label: '6+ ⭐' },
    { value: '5', label: '5+ ⭐' },
  ]

  const sortOptions = [
    { value: 'relevance', label: 'Relevance' },
    { value: 'popularity_desc', label: 'Most Popular' },
    { value: 'rating_desc', label: 'Rating: High to Low' },
    { value: 'rating_asc', label: 'Rating: Low to High' },
    { value: 'title_asc', label: 'Title: A-Z' },
    { value: 'title_desc', label: 'Title: Z-A' },
    { value: 'date_desc', label: 'Newest First' },
    { value: 'date_asc', label: 'Oldest First' },
  ]

  const hasActiveFilters = type !== 'All' || year || sortBy !== 'relevance' || minRating || genre

  return (
    <div className="search">
      <form className="search-form" onSubmit={submit}>
        <div className="search-input">
          <input
            aria-label="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search movies, TV shows, or people..."
          />
          <button className="search-btn" type="submit">Search</button>
        </div>

        <div className="search-controls">
          <button 
            type="button" 
            className={`filter-toggle-btn ${showFilters ? 'active' : ''} ${hasActiveFilters ? 'has-filters' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <span className="filter-icon">⚙</span>
            Filters
            {hasActiveFilters && <span className="filter-badge">●</span>}
          </button>
          
          {hasActiveFilters && (
            <button type="button" className="clear-btn" onClick={clear}>
              ✕ Clear All
            </button>
          )}
        </div>

        {showFilters && (
          <div className="search-filters-panel">
            <div className="filter-row">
              <label className="filter-item">
                <span className="filter-label">Type</span>
                <select value={type} onChange={(e) => { setType(e.target.value); setGenre(''); }}>
                  <option value="All">🎬 All</option>
                  <option value="movie">🎥 Movies</option>
                  <option value="tv">📺 TV Shows</option>
                  <option value="person">⭐ People</option>
                </select>
              </label>

              <label className="filter-item">
                <span className="filter-label">Sort By</span>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  {sortOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="filter-row">
              <label className="filter-item">
                <span className="filter-label">Year</span>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="e.g. 2024"
                  min="1900"
                  max="2100"
                />
              </label>

              <label className="filter-item">
                <span className="filter-label">Min Rating</span>
                <select value={minRating} onChange={(e) => setMinRating(e.target.value)}>
                  {ratingOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
            </div>

            {type !== 'person' && genres.length > 0 && (
              <div className="filter-row">
                <label className="filter-item filter-item-full">
                  <span className="filter-label">Genre</span>
                  <select value={genre} onChange={(e) => setGenre(e.target.value)}>
                    <option value="">All Genres</option>
                    {genres.map(g => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  )
}
