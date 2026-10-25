import { lazy, Suspense } from 'react'
import { Route, Routes, useLocation } from 'react-router'
import { Analytics } from '@vercel/analytics/react'
import ScrollToTop from './components/ScrollTop'
import ErrorBoundary from './components/ErrorBoundary'
import TopBar from './components/TopBar'
import Footer from './components/Footer'
import { Loading } from './components/states'

const Home = lazy(() => import('./pages/Home'))
const SearchPage = lazy(() => import('./pages/SearchPage'))
const MoviePage = lazy(() => import('./pages/MoviePage'))
const PersonPage = lazy(() => import('./pages/PersonPage'))
const PlayerPage = lazy(() => import('./pages/PlayerPage'))
const NotFound = lazy(() => import('./pages/NotFound'))

/** Pages that open on a full-bleed picture: the top bar sits over it, transparent. */
const OVERLAY_PAGES = /^\/(?:$|movie\/|tv\/|person\/)/

export default function App() {
  const { pathname } = useLocation()
  // The player is full-viewport: no site header/footer around it.
  const isPlayer = pathname.startsWith('/player/')
  const overlay = OVERLAY_PAGES.test(pathname)

  const className = ['app', isPlayer ? 'app-player' : '', overlay ? 'has-overlay' : ''].filter(Boolean).join(' ')

  return (
    <div className={className}>
      <ScrollToTop />
      {isPlayer ? null : (
        <>
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          <TopBar overlay={overlay} hideSearch={pathname === '/search'} />
        </>
      )}
      <main id="main">
        <ErrorBoundary resetKey={pathname}>
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/movie/:id" element={<MoviePage kind="movie" />} />
              <Route path="/tv/:id" element={<MoviePage kind="tv" />} />
              <Route path="/person/:id" element={<PersonPage />} />
              <Route path="/player/:kind/:id" element={<PlayerPage />} />
              <Route path="/player/:kind/:id/:season/:episode" element={<PlayerPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      {isPlayer ? null : <Footer />}
      <Analytics />
    </div>
  )
}
