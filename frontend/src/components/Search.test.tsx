import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { UseQueryResult } from '@tanstack/react-query'
import Search from './Search'
import { useGenres } from '../api/hooks'
import type { GenreList } from '../api/types'

vi.mock('../api/hooks', () => ({ useGenres: vi.fn() }))

describe('Search filters', () => {
  it('offers People, is keyboard accessible and closes on Escape / outside click', () => {
    vi.mocked(useGenres).mockReturnValue({ data: { genres: [] } } as unknown as UseQueryResult<GenreList>)
    render(
      <MemoryRouter>
        <Search />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }))

    const trigger = screen.getByRole('button', { name: /^Type/ })
    expect(trigger).toHaveAttribute('aria-haspopup', 'listbox')
    expect(trigger).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const listbox = screen.getByRole('listbox', { name: 'Type' })
    expect(screen.getByRole('option', { name: 'People' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'All' })).toHaveFocus()

    fireEvent.keyDown(listbox, { key: 'ArrowDown' })
    expect(screen.getByRole('option', { name: 'Movies' })).toHaveFocus()

    fireEvent.keyDown(listbox, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()

    fireEvent.click(trigger)
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^Year/ }))
    expect(screen.getByLabelText('Release year')).toBeInTheDocument()
  })
})
