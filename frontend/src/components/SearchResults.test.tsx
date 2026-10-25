import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import type { UseQueryResult } from '@tanstack/react-query'
import SearchResults from './SearchResults'
import NotFound from '../pages/NotFound'
import { useSearch } from '../api/hooks'
import type { MediaListItem, Paged, SearchParams } from '../api/types'

vi.mock('../api/hooks', () => ({ useSearch: vi.fn() }))

const useSearchMock = vi.mocked(useSearch)

function mockResult(partial: Partial<UseQueryResult<Paged<MediaListItem>>>) {
  useSearchMock.mockReturnValue({
    data: undefined,
    error: null,
    isPending: false,
    isFetching: false,
    refetch: vi.fn(),
    ...partial,
  } as UseQueryResult<Paged<MediaListItem>>)
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/search" element={<SearchResults />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('SearchResults', () => {
  beforeEach(() => {
    useSearchMock.mockReset()
  })

  it('derives search params from the URL and renders results', () => {
    mockResult({
      data: {
        page: 2,
        total_pages: 3,
        total_results: 45,
        results: [
          { id: 1, title: 'Dune', poster_path: null, release_date: '2021-09-15', media_type: 'movie' },
          { id: 1, name: 'Dune: Prophecy', poster_path: null, first_air_date: '2024-11-17', media_type: 'tv' },
        ],
      },
    })

    renderAt('/search?q=dune&type=movie&genres=878,12&year=2021&min_rating=7&sort_by=rating_desc&page=2')

    const expected: SearchParams = {
      query: 'dune',
      type: 'movie',
      genres: [878, 12],
      year: 2021,
      min_rating: 7,
      sort_by: 'rating_desc',
      page: 2,
    }
    expect(useSearchMock).toHaveBeenCalledWith(expected)
    expect(screen.getByRole('heading', { name: 'Search Results for "dune"' })).toBeInTheDocument()
    // genres/min_rating are applied per page, so TMDB's total isn't the match count
    expect(screen.getByText('2 matches on page 2 of 3')).toBeInTheDocument()
    expect(screen.queryByText('45 results found')).not.toBeInTheDocument()
    expect(screen.getByText('Dune')).toBeInTheDocument()
    expect(screen.getByText('Dune: Prophecy')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '2' })).toHaveAttribute('aria-current', 'page')
  })

  it('shows the TMDB total when no per-page filters are active', () => {
    mockResult({ data: { page: 1, total_pages: 3, total_results: 45, results: [] } })
    renderAt('/search?q=dune&type=movie&year=2021')
    expect(screen.getByText('45 results found')).toBeInTheDocument()
    expect(screen.queryByText(/one page of results at a time/)).not.toBeInTheDocument()
  })

  it('shows an error state with retry', () => {
    mockResult({ error: new Error('boom') })
    renderAt('/search?q=x')
    expect(screen.getByRole('alert')).toHaveTextContent('boom')
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('shows a loading state while pending', () => {
    mockResult({ isPending: true })
    renderAt('/search?q=x')
    expect(screen.getByRole('status')).toHaveTextContent('Searching')
  })

  it('does not search without a query', () => {
    mockResult({})
    renderAt('/search')
    expect(useSearchMock).toHaveBeenCalledWith(null)
  })
})

describe('NotFound', () => {
  it('renders for unknown routes', () => {
    mockResult({})
    renderAt('/nope')
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/')
  })
})
