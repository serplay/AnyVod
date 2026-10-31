import { useNavigate, useSearchParams } from 'react-router'
import PosterCard, { GRID_POSTER_SIZES } from './PosterCard'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'
import { ErrorState, Loading } from './states'
import { useSearch } from '../api/hooks'
import type { MediaListItem } from '../api/types'
import { itemKey, itemPath } from '../lib/media'
import { isFilteredPerPage, parseSearchParams, searchPath } from '../lib/searchParams'
import { getPageNumbers } from '../lib/pagination'

/** Results for the search described by the current URL (/search?q=...). */
export default function SearchResults() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const params = parseSearchParams(searchParams)
  const { data, error, isPending, isFetching, refetch } = useSearch(params)

  if (!params) {
    return (
      <div className="search-results-header">
        <h1 className="search-title">Search</h1>
        <p className="search-results-count">Find movies, TV shows and people.</p>
      </div>
    )
  }

  const page = params.page ?? 1
  const isPersonSearch = params.type === 'person'
  // Person-only searches may omit media_type; tag them so cards link to
  // /person/:id and use profile_path.
  const results: MediaListItem[] = isPersonSearch
    ? (data?.results ?? []).map((r) => ({ ...r, media_type: 'person' }))
    : (data?.results ?? [])
  const totalPages = data?.total_pages ?? 1
  const totalResults = data?.total_results ?? 0
  const filteredPerPage = isFilteredPerPage(params)
  const matches = results.length

  const goToPage = (p: number) => {
    if (p < 1 || p > totalPages || p === page) return
    navigate(searchPath({ ...params, page: p }))
    window.scrollTo(0, 0)
  }

  return (
    <div className="search-results">
      <div className="search-results-header">
        <h1 className="search-title">
          <span className="visually-hidden">Results for</span> {params.query}
        </h1>
        {data && (
          <p className="search-results-count">
            {filteredPerPage
              ? `${matches} ${matches === 1 ? 'match' : 'matches'}${
                  data.filtered_from ? ` out of ${data.filtered_from} results` : ''
                } on page ${page} of ${totalPages}`
              : `${totalResults.toLocaleString()} results found`}
          </p>
        )}
        {data && (filteredPerPage || params.sort_by) && (
          <p className="search-results-count">
            {filteredPerPage
              ? 'Filters and sorting apply to each page of results; try the next page for more matches.'
              : 'Sorting applies to one page of results at a time.'}
          </p>
        )}
      </div>

      {error ? (
        <ErrorState error={error} onRetry={() => void refetch()} />
      ) : isPending ? (
        <Loading label="Searching…" />
      ) : (
        <div aria-busy={isFetching}>
          {results.length > 0 ? (
            <div className="poster-grid">
              {results.map((item) => (
                <PosterCard key={itemKey(item)} item={item} href={itemPath(item)} sizes={GRID_POSTER_SIZES} />
              ))}
            </div>
          ) : (
            <p className="search-empty">Nothing found. Try another title, or fewer filters.</p>
          )}
        </div>
      )}

      {!error && totalPages > 1 && (
        <nav className="pagination" aria-label="Search results pages">
          <button
            className="btn pagination-step"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            <ChevronLeftIcon />
            <span className="pagination-step-label">Previous</span>
          </button>

          <span className="pagination-compact" aria-hidden="true">
            Page {page} of {totalPages}
          </span>

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
                  …
                </span>
              ),
            )}
          </div>

          <button
            className="btn pagination-step"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
          >
            <span className="pagination-step-label">Next</span>
            <ChevronRightIcon />
          </button>
        </nav>
      )}
    </div>
  )
}
