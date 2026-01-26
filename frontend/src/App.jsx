import { useEffect, useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import Search from './components/Search'
import Home from './components/Home'
import SearchResults from './components/SearchResults'
import AppIcon from './assets/anyvod_logo.png'
import MoviePage from './components/MoviePage'
import PersonPage from './components/PersonPage'
import PlayerPage from './components/PlayerPage'
import { Analytics } from '@vercel/analytics/react';

// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation()
  
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  
  return null
}

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
      <ScrollToTop />
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
      <footer className="app-footer">
        <div className="footer-content">
          <span className="footer-text">Contact</span>
          <div className="footer-icons">
            <a href="mailto:serplay2017@gmail.com" className="footer-icon" title="Email" aria-label="Send email">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/>
              </svg>
            </a>
            <a href="https://discord.com/users/1465142433162461226" target="_blank" rel="noopener noreferrer" className="footer-icon" title="Discord" aria-label="Discord profile">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
