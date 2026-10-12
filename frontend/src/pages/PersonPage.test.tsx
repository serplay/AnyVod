import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import type { UseQueryResult } from '@tanstack/react-query'
import PersonPage from './PersonPage'
import { usePerson, usePersonCredits } from '../api/hooks'
import type { Person, PersonCredits } from '../api/types'

vi.mock('../api/hooks', () => ({ usePerson: vi.fn(), usePersonCredits: vi.fn() }))

const result = <T,>(data: T) => ({ data, error: null, isPending: false, refetch: vi.fn() }) as unknown as UseQueryResult<T>

const person: Person = {
  id: 7,
  name: 'Jane Doe',
  profile_path: null,
  biography: '',
  popularity: 0,
  birthday: null,
  deathday: null,
  place_of_birth: null,
  known_for_department: 'Acting',
}

const credits: PersonCredits = {
  cast: [
    { credit_id: 'a', id: 1, media_type: 'tv', name: 'Long Show', character: 'Self', poster_path: '/a.jpg', popularity: 90 },
    { credit_id: 'b', id: 1, media_type: 'tv', name: 'Long Show', character: 'Narrator', poster_path: '/a.jpg', popularity: 90 },
    { credit_id: 'c', id: 1, media_type: 'movie', title: 'A Movie', poster_path: '/c.jpg', popularity: 10, vote_average: 0 },
  ],
}

describe('PersonPage', () => {
  it('shows each credited title once, as links, without stray zeros', () => {
    vi.mocked(usePerson).mockReturnValue(result(person))
    vi.mocked(usePersonCredits).mockReturnValue(result(credits))

    render(
      <MemoryRouter initialEntries={['/person/7']}>
        <Routes>
          <Route path="/person/:id" element={<PersonPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    const knownFor = screen.getByRole('heading', { name: 'Known For' }).parentElement!
    const links = within(knownFor).getAllByRole('link')
    expect(links.map((l) => l.getAttribute('href'))).toEqual(['/tv/1', '/movie/1'])
    // popularity 0 / vote_average 0 must not render a literal "0".
    expect(screen.queryByText('Popularity')).not.toBeInTheDocument()
    expect(within(links[1]!).queryByText('0')).not.toBeInTheDocument()
  })
})
