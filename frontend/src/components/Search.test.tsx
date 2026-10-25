import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import type { UseQueryResult } from '@tanstack/react-query'
import Search from './Search'
import { useGenres } from '../api/hooks'
import type { GenreList } from '../api/types'

vi.mock('../api/hooks', () => ({ useGenres: vi.fn() }))

function LocationProbe() {
  const { pathname, search } = useLocation()
  return <div data-testid="location">{pathname + search}</div>
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Search />
      <LocationProbe />
    </MemoryRouter>,
  )
}

const location = () => decodeURIComponent(screen.getByTestId('location').textContent ?? '')

describe('Search filters', () => {
  beforeEach(() => {
    vi.mocked(useGenres).mockReturnValue({
      data: { genres: [{ id: 18, name: 'Drama' }] },
    } as unknown as UseQueryResult<GenreList>)
  })

  it('has no filters until there is a query', () => {
    renderAt('/search')
    expect(screen.getByRole('searchbox', { name: 'Search' })).toHaveFocus()
    expect(screen.queryByRole('group', { name: 'Type' })).not.toBeInTheDocument()
  })

  it('applies the type straight away and drops genres', () => {
    renderAt('/search?q=dune&genres=18')
    const people = screen.getByRole('button', { name: 'People' })
    expect(people).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(people)
    expect(location()).toBe('/search?q=dune&type=person')
    expect(screen.getByRole('button', { name: 'People' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('has keyboard-accessible dropdowns that close on Escape / outside click', () => {
    renderAt('/search?q=dune')
    const trigger = screen.getByRole('button', { name: /^Score/ })
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const listbox = screen.getByRole('listbox', { name: 'Score' })
    expect(screen.getByRole('option', { name: 'All' })).toHaveFocus()

    fireEvent.keyDown(listbox, { key: 'ArrowDown' })
    expect(screen.getByRole('option', { name: '9+' })).toHaveFocus()

    fireEvent.keyDown(listbox, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()

    fireEvent.click(trigger)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('option', { name: '7+' }))
    expect(location()).toBe('/search?q=dune&min_rating=7')
  })

  it('sets the year from its popup', () => {
    renderAt('/search?q=dune')
    fireEvent.click(screen.getByRole('button', { name: /^Year/ }))
    const input = screen.getByLabelText('Release year')
    fireEvent.change(input, { target: { value: '2021' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(location()).toBe('/search?q=dune&year=2021')
  })

  it('applies the filter sheet together', () => {
    renderAt('/search?q=dune')
    fireEvent.click(screen.getByRole('button', { name: 'Filters' }))
    const sheet = screen.getByRole('dialog', { name: 'Filters' })
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'rating_desc' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Drama' }).find((b) => sheet.contains(b))!)
    expect(location()).toBe('/search?q=dune')
    fireEvent.click(screen.getByRole('button', { name: 'Show results' }))
    expect(location()).toBe('/search?q=dune&genres=18&sort_by=rating_desc')
  })
})
