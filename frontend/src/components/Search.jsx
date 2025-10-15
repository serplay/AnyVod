import React, { useState } from 'react'

export default function Search({ onSearch = () => {}, onClear = () => {} }) {
  const [q, setQ] = useState('')
  const [type, setType] = useState('movie') // movie or tv
  const [year, setYear] = useState('')

  function submit(e) {
    e.preventDefault()
    const query = q.trim()
    if (!query) return
    // update document title
    document.title = `AnyVod - ${query.charAt(0).toUpperCase() + query.slice(1)}`
    // call onSearch with query and filters object
    onSearch({ query, filters: { type, year: year ? Number(year) : undefined } })
  }

  function clear() {
    setQ('')
    setYear('')
    setType('movie')
    document.title = 'AnyVod'
    onClear()
  }

  return (
    <div className="search">
      <form className="search-form" onSubmit={submit}>
        <div className="search-input">
          <input
            aria-label="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search movies or TV shows..."
          />
          <button className="search-btn" type="submit">Search</button>
        </div>

        <div className="search-filters">
          <label>
            Type
            <select value={type} onChange={(e) => setType(e.target.value)}>
              <option value="movie">Movie</option>
              <option value="tv">TV</option>
              <option value="All">All</option>
            </select>
          </label>

          <label>
            Year
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="e.g. 2022"
              min="1900"
              max="2100"
            />
          </label>

          <button type="button" className="clear-btn" onClick={clear}>Clear</button>
        </div>
      </form>
    </div>
  )
}
