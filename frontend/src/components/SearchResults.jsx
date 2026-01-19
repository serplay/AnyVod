import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import MovieList from './MovieList'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function SearchResults({ searchPayload, onClear }) {
  const [results, setResults] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalResults, setTotalResults] = useState(0)
  const [isPersonSearch, setIsPersonSearch] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (searchPayload?.query) {
      setPage(1) // Reset to page 1 when search payload changes
    }
  }, [searchPayload])

  useEffect(() => {
    if (searchPayload?.query) {
      performSearch(page)
    }
  }, [searchPayload, page])

  async function performSearch(p) {
    try {
      const { query, filters } = searchPayload
      const params = { query, page: p }
      
      if (filters) {
        if (filters.type) params.type = filters.type
        if (filters.year) params.year = filters.year
        if (filters.sortBy) params.sort_by = filters.sortBy
        if (filters.minRating) params.min_rating = filters.minRating
        if (filters.genre) params.genre = filters.genre
      }
      
      setIsPersonSearch(filters?.type === 'person')
      
      const res = await axios.get(`${API_BASE}/tmdb/search`, { params })
      setResults(res.data.results || [])
      setTotalPages(res.data.total_pages || 1)
      setTotalResults(res.data.total_results || 0)
    } catch (err) {
      console.error('Search failed:', err)
    }
  }

  function onCardSelect(item) {
    // Handle person results
    if (item.media_type === 'person' || isPersonSearch) {
      navigate(`/person/${item.id}`)
      return
    }
    
    // Determine if TV show based on media_type or presence of first_air_date (TV) vs release_date (movie)
    const isTv = item.media_type === 'tv' || (item.first_air_date && !item.release_date)
    if (isTv) {
      navigate(`/tv/${item.id}`)
    } else {
      navigate(`/movie/${item.id}`)
    }
  }

  const handlePrevPage = () => {
    if (page > 1) setPage(page - 1)
    window.scrollTo(0, 0)
  }

  const handleNextPage = () => {
    if (page < totalPages) setPage(page + 1)
    window.scrollTo(0, 0)
  }

  const handlePageJump = (p) => {
    setPage(p)
    window.scrollTo(0, 0)
  }

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = []
    const maxVisible = 7
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      // Always show first page
      pages.push(1)
      
      if (page > 3) {
        pages.push('...')
      }
      
      // Show pages around current page
      const start = Math.max(2, page - 1)
      const end = Math.min(totalPages - 1, page + 1)
      
      for (let i = start; i <= end; i++) {
        pages.push(i)
      }
      
      if (page < totalPages - 2) {
        pages.push('...')
      }
      
      // Always show last page
      pages.push(totalPages)
    }
    
    return pages
  }

  return (
    <div className="search-results">
      <div className="search-results-header">
        <h2>Search Results for "{searchPayload?.query}"</h2>
        <p className="search-results-count">{totalResults.toLocaleString()} results found</p>
        <button className="clear-search-btn" onClick={onClear}>
          ✕ Clear Search
        </button>
      </div>
      
      <MovieList movies={results} onSelect={onCardSelect} />
      
      {totalPages > 1 && (
        <div className="pagination">
          <button 
            className="pagination-btn pagination-prev"
            onClick={handlePrevPage} 
            disabled={page === 1}
          >
            ← Previous
          </button>
          
          <div className="pagination-numbers">
            {getPageNumbers().map((p, idx) => (
              p === '...' ? (
                <span key={`ellipsis-${idx}`} className="pagination-ellipsis">...</span>
              ) : (
                <button
                  key={p}
                  className={`pagination-number ${page === p ? 'active' : ''}`}
                  onClick={() => handlePageJump(p)}
                >
                  {p}
                </button>
              )
            ))}
          </div>
          
          <button 
            className="pagination-btn pagination-next"
            onClick={handleNextPage} 
            disabled={page >= totalPages}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  )
}
