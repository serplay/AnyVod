import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router'

/** `/player/:kind/:id[/...]` -> `"kind/id"`, otherwise undefined. */
function playerTitleKey(pathname: string): string | undefined {
  const match = /^\/player\/([^/]+)\/([^/]+)(?:\/|$)/.exec(pathname)
  return match ? `${match[1]}/${match[2]}` : undefined
}

/**
 * True when moving between two paths should keep the scroll position:
 * switching episodes/seasons within the same `/player/:kind/:id`.
 */
function isSamePlayerTitle(from: string, to: string): boolean {
  const a = playerTitleKey(from)
  return a !== undefined && a === playerTitleKey(to)
}

/** Scroll to top on route (pathname) changes, except episode changes inside the player. */
export default function ScrollToTop() {
  const { pathname } = useLocation()
  const previous = useRef(pathname)

  useEffect(() => {
    const from = previous.current
    previous.current = pathname
    if (from === pathname || isSamePlayerTitle(from, pathname)) return
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}
