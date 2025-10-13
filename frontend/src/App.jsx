import { useEffect, useState } from 'react'
import axios from 'axios'
import MovieList from './components/MovieList'
import MovieDetails from './components/MovieDetails'
import Search from './components/Search'
import AppIcon from './assets/anyvod_logo.png'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function App() {
  const [movies, setMovies] = useState([])
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState(null)
  const [query, setQuery] = useState('')
  const [isSearch, setIsSearch] = useState(false)

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

  return (
    <div className="app">
      <header>
        <img src={AppIcon} alt="AnyVod Logo" style={{ height: '40px', marginRight: '10px' }} />
        <h1>AnyVod</h1>
      </header>
      <main>
        <Search onSearch={doSearch} onClear={() => { setIsSearch(false); setQuery(''); setPage(1); fetchPopular(1); }} />
        <MovieList movies={movies} onSelect={setSelected} />
        {selected && <MovieDetails movie={selected} onClose={() => setSelected(null)} />}
      </main>
      <footer>
        <button onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</button>
        <span>Page {page}</span>
        <button onClick={() => setPage((p) => p + 1)}>Next</button>
      </footer>
    </div>
  )
}
