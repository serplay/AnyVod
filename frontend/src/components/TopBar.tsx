import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { LogoMark, SearchIcon } from './icons'
import { SITE_NAME } from '../config'
import { searchPath } from '../lib/searchParams'

/** Scroll distance after which an overlay bar turns solid. */
const SOLID_AFTER = 80

interface TopBarProps {
  /** Transparent over a full-bleed picture until the page scrolls. */
  overlay?: boolean
  /** Hide the inline search field (the search page has its own). */
  hideSearch?: boolean
}

function useScrolledPast(px: number, enabled: boolean) {
  const [past, setPast] = useState(false)
  useEffect(() => {
    if (!enabled) return
    const update = () => setPast(window.scrollY > px)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [px, enabled])
  return enabled && past
}

export default function TopBar({ overlay = false, hideSearch = false }: TopBarProps) {
  const navigate = useNavigate()
  const scrolled = useScrolledPast(SOLID_AFTER, overlay)

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const query = String(new FormData(e.currentTarget).get('q') ?? '').trim()
    if (query) void navigate(searchPath({ query }))
  }

  const className = ['topbar', overlay && !scrolled ? 'is-overlay' : ''].filter(Boolean).join(' ')

  return (
    <header className={className}>
      <Link to="/" className="topbar-brand" aria-label={`${SITE_NAME} home`}>
        <LogoMark className="topbar-mark" />
        {/* Not an <h1>: each page renders its own single <h1>. */}
        <span className="topbar-name">{SITE_NAME}</span>
      </Link>
      {hideSearch ? null : (
        <>
          <form className="topbar-search" role="search" onSubmit={submit}>
            <SearchIcon width={18} height={18} />
            <input name="q" type="search" aria-label="Search" placeholder="Search movies, shows, people" enterKeyHint="search" />
          </form>
          <Link to="/search" className="btn btn-icon topbar-search-link" aria-label="Search">
            <SearchIcon />
          </Link>
        </>
      )}
    </header>
  )
}
