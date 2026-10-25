import { useEffect, useRef } from 'react'

/**
 * Fades and lifts an element in the first time it scrolls into view.
 * Content is visible by default: only elements that start below the fold get
 * armed, so nothing stays hidden if this never runs (no JS, no IntersectionObserver).
 */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    if (el.getBoundingClientRect().top < window.innerHeight) return

    el.classList.add('reveal-armed')
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return
        el.classList.add('reveal-in')
        el.classList.remove('reveal-armed')
        observer.disconnect()
      },
      { rootMargin: '0px 0px -10% 0px' },
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      el.classList.remove('reveal-armed')
    }
  }, [])

  return ref
}
