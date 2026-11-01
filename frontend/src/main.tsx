import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { createQueryClient } from './api/queryClient'
import { removeSeoFallback } from './lib/seo'
import './styles/index.css'

removeSeoFallback()

const queryClient = createQueryClient()
restorePrerenderSeed()

/**
 * Prerendered pages (scripts/prerender.ts) carry the data they were built from. Loading it into
 * the cache renders the page at once; React Query refetches it in the background once stale.
 */
function restorePrerenderSeed() {
  const el = document.getElementById('prerender-data')
  if (!el) return
  try {
    const seed = JSON.parse(el.textContent ?? '') as { key?: unknown; data?: unknown; at?: unknown }
    if (Array.isArray(seed.key) && seed.data !== undefined && typeof seed.at === 'number') {
      queryClient.setQueryData(seed.key, seed.data, { updatedAt: seed.at })
    }
  } catch {
    // A broken seed only costs the head start; the page fetches as usual.
  }
  el.remove()
}

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Missing #root element')

createRoot(rootEl).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
