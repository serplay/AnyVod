import { useEffect, useState } from 'react'
import { Routes, Route, useNavigate } from 'react-router-dom'
import Search from './components/Search'
import Home from './components/Home'
import SearchResults from './components/SearchResults'
import AppIcon from './assets/anyvod_logo.png'
import MoviePage from './components/MoviePage'
import PersonPage from './components/PersonPage'
import PlayerPage from './components/PlayerPage'
import { Analytics } from '@vercel/analytics/react';

export default function App() {
  const [searchPayload, setSearchPayload] = useState(null)
  const navigate = useNavigate()

  function handleSearch(payload) {
    setSearchPayload(payload)
    // Update document title
    const query = payload.query
    document.title = `AnyVod - ${query.charAt(0).toUpperCase() + query.slice(1)}`
  }

  function handleClearSearch() {
    setSearchPayload(null)
    document.title = 'AnyVod'
  }

  return (
    <div className="app">
      <header>
        <div className="logo-container" onClick={() => { navigate('/'); handleClearSearch(); }}>
          <img src={AppIcon} alt="AnyVod Logo" style={{ height: '40px', marginRight: '10px' }} />
          <h1>AnyVod</h1>
        </div>
      </header>
      <main>
        <Routes>
          <Route path="/" element={
            <>
              <Search onSearch={handleSearch} onClear={handleClearSearch} />
              {searchPayload ? (
                <SearchResults searchPayload={searchPayload} onClear={handleClearSearch} />
              ) : (
                <Home />
              )}
            </>
          } />
          <Route path="/movie/:id" element={<MoviePage />} />
          <Route path="/tv/:id" element={<MoviePage />} />
          <Route path="/person/:id" element={<PersonPage />} />
          <Route path="/player/:kind/:id" element={<PlayerPage />} />
          <Route path="/player/:kind/:id/:season/:episode" element={<PlayerPage />} />
        </Routes>
        <Analytics />
      </main>
    </div>
  )
}
