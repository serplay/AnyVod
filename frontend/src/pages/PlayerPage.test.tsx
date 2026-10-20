import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { QueryClient, QueryClientProvider, type UseQueryResult } from '@tanstack/react-query'
import PlayerRoute from './PlayerPage'
import { useDetails, useEmbed, useSeason } from '../api/hooks'
import type { EmbedResponse, MediaDetails, SeasonDetails } from '../api/types'

vi.mock('../api/hooks', () => ({
  useDetails: vi.fn(),
  useEmbed: vi.fn(),
  useSeason: vi.fn(),
  seasonQueryOptions: vi.fn(),
}))

const result = <T,>(data: T) => ({ data, error: null, isPending: false, refetch: vi.fn() }) as unknown as UseQueryResult<T>

const details: MediaDetails = {
  id: 42,
  name: 'The Show',
  poster_path: null,
  backdrop_path: null,
  seasons: [{ season_number: 1, name: 'Season 1', episode_count: 3 }],
}

const season: SeasonDetails = {
  name: 'Season 1',
  overview: '',
  episodes: [1, 2, 3].map((n) => ({
    id: 100 + n,
    episode_number: n,
    name: `Episode name ${n}`,
    still_path: null,
    runtime: 40,
    vote_average: 0,
    overview: '',
    air_date: null,
  })),
}

function renderAt(url: string) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/player/:kind/:id" element={<PlayerRoute />} />
          <Route path="/player/:kind/:id/:season/:episode" element={<PlayerRoute />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('PlayerPage', () => {
  beforeEach(() => {
    vi.mocked(useDetails).mockReturnValue(result(details))
    vi.mocked(useSeason).mockReturnValue(result(season))
    vi.mocked(useEmbed).mockImplementation((kind, id, s, e) =>
      result<EmbedResponse>({ embed_url: `https://embed.example/${kind}/${id}/${s}/${e}` }),
    )
    Element.prototype.scrollIntoView = vi.fn()
  })

  it('requests a new embed when the URL episode changes', () => {
    renderAt('/player/tv/42/1/1')

    expect(useEmbed).toHaveBeenLastCalledWith('tv', 42, 1, 1)
    const frame = screen.getByTitle('Player: The Show S1E1')
    expect(frame).toHaveAttribute('src', 'https://embed.example/tv/42/1/1')
    expect(frame).toHaveAttribute('allow', 'fullscreen; autoplay; encrypted-media; picture-in-picture')
    expect(frame).toHaveAttribute('referrerpolicy', 'origin')

    // Episode items are links that change the URL.
    const [sidebarLink] = screen.getAllByRole('link', { name: /Episode name 2/ })
    expect(sidebarLink).toHaveAttribute('href', '/player/tv/42/1/2')
    fireEvent.click(sidebarLink!)

    expect(useEmbed).toHaveBeenLastCalledWith('tv', 42, 1, 2)
    expect(screen.getByTitle('Player: The Show S1E2')).toHaveAttribute('src', 'https://embed.example/tv/42/1/2')
  })

  it('has a single h1 and no nested <main>', () => {
    const { container } = renderAt('/player/tv/42/1/1')
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(container.querySelector('main')).toBeNull()
    expect(screen.getAllByLabelText('Filter episodes by name or number')).toHaveLength(2)
  })
})
