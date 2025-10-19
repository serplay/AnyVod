import { useEffect, useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import axios from 'axios'
import MovieList from './components/MovieList'
import Search from './components/Search'
import AppIcon from './assets/anyvod_logo.png'
import MoviePage from './components/MoviePage'
import PersonPage from './components/PersonPage'
import PlayerPage from './components/PlayerPage'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function App() {
  const [movies, setMovies] = useState([])
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [isSearch, setIsSearch] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    fetchPopular(page)
  }, [page])

  async function fetchPopular(p = 1) {
    try {
      const res = await axios.get(`${API_BASE}/tmdb/popular`, { params: { page: p } })
      setMovies(res.data.results || [])
    } catch (err) {
      console.error(err)
      alert('Failed to fetch popular movies from backend')
    }
  }

  async function doSearch(payload, p = 1) {
    try {
      const { query, filters } = payload
      setIsSearch(true)
      setQuery(query)
      const params = { query, page: p }
      if (filters) {
        if (filters.type) params.type = filters.type
        if (filters.year) params.year = filters.year
      }
      const res = await axios.get(`${API_BASE}/tmdb/search`, { params })
      setMovies(res.data.results || [])
      setPage(p)
    } catch (err) {
      console.error(err)
      alert('Search failed')
    }
  }

  function onCardSelect(item) {
    // navigate to appropriate route based on media type
    const isTv = item.media_type === 'tv' || !!item.first_air_date
    if (isTv) {
      navigate(`/tv/${item.id}`)
    } else {
      navigate(`/movie/${item.id}`)
    }
  }

  return (
    <div className="app">
      <header>
        <img src={AppIcon} alt="AnyVod Logo" style={{ height: '40px', marginRight: '10px' }} />
        <h1>AnyVod</h1>
      </header>
      <main>
        <Routes>
          <Route path="/" element={
            <>
              <Search onSearch={doSearch} onClear={() => { setIsSearch(false); setQuery(''); setPage(1); fetchPopular(1); }} />
              <MovieList movies={movies} onSelect={onCardSelect} />
              <footer>
                <button onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
                <span>Page {page}</span>
                <button onClick={() => setPage((p) => p + 1)}>Next</button>
              </footer>
            </>
          } />
          <Route path="/movie/:id" element={<MoviePage />} />
          <Route path="/tv/:id" element={<MoviePage />} />
          <Route path="/person/:id" element={<PersonPage />} />
          <Route path="/player/:kind/:id" element={<PlayerPage />} />
        </Routes>
      </main>
    </div>
  )
}
