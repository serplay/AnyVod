import { useNavigate, useSearchParams } from 'react-router'
import MovieList from './MovieList'
import { ErrorState, Loading } from './states'
import { useSearch } from '../api/hooks'
import type { MediaListItem } from '../api/types'
import { itemPath } from '../lib/media'
import { parseSearchParams, searchPath } from '../lib/searchParams'
import { getPageNumbers } from '../lib/pagination'

/** Results for the search described by the current URL (/search?q=...). */
export default function SearchResults() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const params = parseSearchParams(searchParams)
  const { data, error, isPending, isFetching, refetch } = useSearch(params)

  if (!params) {
    return (
      <div className="search-results">
        <div className="search-results-header">
          <h2>Search</h2>
          <p className="search-results-count">Type something above to search movies, TV shows and people.</p>
        </div>
      </div>
    )
  }

  const page = params.page ?? 1
  const results = data?.results ?? []
  const totalPages = data?.total_pages ?? 1
  const totalResults = data?.total_results ?? 0
  const isPersonSearch = params.type === 'person'

  function onCardSelect(item: MediaListItem) {
    navigate(isPersonSearch ? `/person/${item.id}` : itemPath(item))
  }

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return
    navigate(searchPath({ ...params, page: p }))
    window.scrollTo(0, 0)
  }

  return (
    <div className="search-results">
      <div className="search-results-header">
        <h2>Search Results for &quot;{params.query}&quot;</h2>
        {data && <p className="search-results-count">{totalResults.toLocaleString()} results found</p>}
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <Loading label="Searching…" />
      ) : (
        <div aria-busy={isFetching}>
          <MovieList movies={results} onSelect={onCardSelect} />
        </div>
      )}

      {!error && totalPages > 1 && (
        <nav className="pagination" aria-label="Search results pages">
          <button className="pagination-btn pagination-prev" onClick={() => goToPage(page - 1)} disabled={page <= 1}>
            ← Previous
          </button>

          <div className="pagination-numbers">
            {getPageNumbers(page, totalPages).map((p) =>
              typeof p === 'number' ? (
                <button
                  key={p}
                  className={`pagination-number ${page === p ? 'active' : ''}`}
                  aria-current={page === p ? 'page' : undefined}
                  onClick={() => goToPage(p)}
                >
                  {p}
                </button>
              ) : (
                <span key={p} className="pagination-ellipsis">
                  ...
                </span>
              ),
            )}
          </div>

          <button
            className="pagination-btn pagination-next"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
          >
            Next →
          </button>
        </nav>
      )}
    </div>
  )
}
