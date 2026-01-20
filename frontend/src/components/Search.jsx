import React, { useState, useEffect, useRef } from 'react'
import axios from 'axios'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function Search({ onSearch = () => {}, onClear = () => {} }) {
  const [q, setQ] = useState('')
  const [type, setType] = useState('All')
  const [type, setType] = useState('All')
  const [year, setYear] = useState('')
  const [sortBy, setSortBy] = useState('Default')
  const [minRating, setMinRating] = useState('All')
  const [selectedGenres, setSelectedGenres] = useState([])
  const [genres, setGenres] = useState([])
  const [showFilters, setShowFilters] = useState(false)
  
  // Dropdown states
  const [activeDropdown, setActiveDropdown] = useState(null)

  // Fetch genres when type changes
  useEffect(() => {
    fetchGenres()
  }, [type])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (!e.target.closest('.filter-dropdown')) {
        setActiveDropdown(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  async function fetchGenres() {
    try {
      if (type === 'person') {
        setGenres([])
        return
      }
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
    if (e) e.preventDefault()
    const query = q.trim()
    if (!query) return
    
    
    document.title = `AnyVod - ${query.charAt(0).toUpperCase() + query.slice(1)}`
    
    onSearch({ 
      query, 
      filters: { 
        type: type === 'All' ? undefined : type.toLowerCase(),
        year: year ? Number(year) : undefined,
        sortBy: sortBy === 'Default' ? 'relevance' : sortBy,
        minRating: minRating !== 'All' ? Number(minRating) : undefined,
        genre: selectedGenres.length === 1 ? selectedGenres[0] : undefined,
        genres: selectedGenres.length > 1 ? selectedGenres : undefined
      } 
    })
  }

  function clear() {
    setQ('')
    setYear('')
    setType('All')
    setSortBy('Default')
    setMinRating('All')
    setSelectedGenres([])
    document.title = 'AnyVod'
    onClear()
  }

  function toggleGenre(genreId) {
    setSelectedGenres(prev => 
      prev.includes(genreId) 
        ? prev.filter(id => id !== genreId)
        : [...prev, genreId]
    )
  }

  function toggleDropdown(name) {
    setActiveDropdown(activeDropdown === name ? null : name)
  }

  function selectOption(setter, value) {
    setter(value)
    setActiveDropdown(null)
  }

  const typeOptions = ['All', 'Movies', 'TV Shows']
  const ratingOptions = ['All', '9+', '8+', '7+', '6+', '5+']
  const sortOptions = [
    { value: 'Default', label: 'Default' },
    { value: 'popularity_desc', label: 'Popular' },
    { value: 'rating_desc', label: 'Top Rated' },
    { value: 'title_asc', label: 'A-Z' },
    { value: 'title_desc', label: 'Z-A' },
    { value: 'date_desc', label: 'Newest' },
    { value: 'date_asc', label: 'Oldest' },
  ]

  const hasActiveFilters = type !== 'All' || year || sortBy !== 'Default' || minRating !== 'All' || selectedGenres.length > 0

  // Helper to get display value for type
  const getTypeDisplay = () => {
    if (type === 'movie') return 'Movies'
    if (type === 'tv') return 'TV Shows'
    if (type === 'person') return 'People'
    return type
  }

  return (
    <div className="search">
      <form className="search-form" onSubmit={submit}>
        <div className="search-input">
          <input
            aria-label="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search movies, TV shows, or people..."
            placeholder="Search movies, TV shows, or people..."
          />
          <button className="search-btn" type="submit">Search</button>
          <button 
            type="button" 
            className={`filter-toggle-btn ${showFilters ? 'active' : ''} ${hasActiveFilters ? 'has-filters' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            Filter
            {hasActiveFilters && <span className="filter-count">{
              (type !== 'All' ? 1 : 0) + 
              (year ? 1 : 0) + 
              (sortBy !== 'Default' ? 1 : 0) + 
              (minRating !== 'All' ? 1 : 0) + 
              selectedGenres.length
            }</span>}
          </button>
        </div>

        {showFilters && (
          <div className="search-filters-panel">
            <div className="filter-section">
              <span className="filter-section-title">Filter</span>
              <div className="filter-pills">
                {/* Type Filter */}
                <div className="filter-dropdown">
                  <button 
                    type="button" 
                    className="filter-pill"
                    onClick={(e) => { e.stopPropagation(); toggleDropdown('type'); }}
                  >
                    <span className="pill-label">Type</span>
                    <span className="pill-value">{getTypeDisplay()}</span>
                  </button>
                  {activeDropdown === 'type' && (
                    <div className="dropdown-menu">
                      {typeOptions.map(opt => (
                        <button 
                          key={opt} 
                          type="button"
                          className={`dropdown-item ${(opt === 'Movies' && type === 'movie') || (opt === 'TV Shows' && type === 'tv') || (opt === 'People' && type === 'person') || opt === type ? 'active' : ''}`}
                          onClick={() => {
                            const val = opt === 'Movies' ? 'movie' : opt === 'TV Shows' ? 'tv' : opt === 'People' ? 'person' : 'All'
                            selectOption(setType, val)
                            setSelectedGenres([])
                          }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Rating Filter */}
                <div className="filter-dropdown">
                  <button 
                    type="button" 
                    className="filter-pill"
                    onClick={(e) => { e.stopPropagation(); toggleDropdown('rating'); }}
                  >
                    <span className="pill-label">Score</span>
                    <span className="pill-value">{minRating}</span>
                  </button>
                  {activeDropdown === 'rating' && (
                    <div className="dropdown-menu">
                      {ratingOptions.map(opt => (
                        <button 
                          key={opt} 
                          type="button"
                          className={`dropdown-item ${minRating === opt ? 'active' : ''}`}
                          onClick={() => selectOption(setMinRating, opt)}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sort Filter */}
                <div className="filter-dropdown">
                  <button 
                    type="button" 
                    className="filter-pill"
                    onClick={(e) => { e.stopPropagation(); toggleDropdown('sort'); }}
                  >
                    <span className="pill-label">Sort</span>
                    <span className="pill-value">{sortOptions.find(o => o.value === sortBy)?.label || 'Default'}</span>
                  </button>
                  {activeDropdown === 'sort' && (
                    <div className="dropdown-menu">
                      {sortOptions.map(opt => (
                        <button 
                          key={opt.value} 
                          type="button"
                          className={`dropdown-item ${sortBy === opt.value ? 'active' : ''}`}
                          onClick={() => selectOption(setSortBy, opt.value)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Year Filter */}
                <div className="filter-dropdown">
                  <button 
                    type="button" 
                    className="filter-pill"
                    onClick={(e) => { e.stopPropagation(); toggleDropdown('year'); }}
                  >
                    <span className="pill-label">Year</span>
                    <span className="pill-value">{year || 'All'}</span>
                  </button>
                  {activeDropdown === 'year' && (
                    <div className="dropdown-menu dropdown-menu-input">
                      <input
                        type="number"
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        placeholder="Enter year"
                        min="1900"
                        max="2100"
                        autoFocus
                      />
                      <button 
                        type="button" 
                        className="dropdown-item"
                        onClick={() => { setYear(''); setActiveDropdown(null); }}
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Genre Tags */}
            {type !== 'person' && genres.length > 0 && (
              <div className="filter-section">
                <span className="filter-section-title">Genre</span>
                <div className="genre-tags">
                  {genres.map(g => (
                    <button
                      key={g.id}
                      type="button"
                      className={`genre-tag ${selectedGenres.includes(g.id) ? 'active' : ''}`}
                      onClick={() => toggleGenre(g.id)}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Filter Action Button */}
            <div className="filter-actions">
              <button type="submit" className="filter-apply-btn">
                Filter
              </button>
              {hasActiveFilters && (
                <button type="button" className="filter-clear-btn" onClick={clear}>
                  Clear All
                </button>
              )}
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
