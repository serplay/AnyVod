import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { QueryClient, QueryClientProvider, type UseQueryResult } from '@tanstack/react-query'
import PlayerRoute from './PlayerPage'
import { useDetails, useSeason } from '../api/hooks'
import type { MediaDetails, SeasonDetails } from '../api/types'
import { loadLastEpisode, saveLastEpisode } from '../lib/episodes'

vi.mock('../api/hooks', () => ({
  useDetails: vi.fn(),
  useSeason: vi.fn(),
  seasonQueryOptions: vi.fn(),
}))

const result = <T,>(data: T) => ({ data, error: null, isPending: false, refetch: vi.fn() }) as unknown as UseQueryResult<T>

const details: MediaDetails = {
  id: 42,
  name: 'The Show',
  poster_path: null,
  backdrop_path: null,
  seasons: [
    { season_number: 1, name: 'Season 1', episode_count: 3 },
    { season_number: 2, name: 'Season 2', episode_count: 2 },
  ],
}

function seasonOf(n: number, count: number): SeasonDetails {
  return {
    name: `Season ${n}`,
    overview: '',
    episodes: Array.from({ length: count }, (_, i) => ({
      id: n * 100 + i + 1,
      episode_number: i + 1,
      name: `S${n} name ${i + 1}`,
      still_path: null,
      runtime: 40,
      vote_average: 0,
      overview: '',
      air_date: null,
    })),
  }
}

let episodeCounts: Record<number, number>

function LocationProbe() {
  return <div data-testid="location">{useLocation().pathname}</div>
}

function renderAt(...entries: string[]) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
        <Routes>
          <Route path="/tv/:id" element={<p>details page</p>} />
          <Route path="/player/:kind/:id" element={<PlayerRoute />} />
          <Route path="/player/:kind/:id/:season/:episode" element={<PlayerRoute />} />
        </Routes>
        <LocationProbe />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const location = () => screen.getByTestId('location').textContent

describe('PlayerPage', () => {
  beforeEach(() => {
    localStorage.clear()
    episodeCounts = { 1: 3, 2: 2 }
    vi.mocked(useDetails).mockReturnValue(result(details))
    vi.mocked(useSeason).mockImplementation((_id, n) => result(seasonOf(n as number, episodeCounts[n as number] ?? 0)))
  })

  it('loads a new embed when the URL episode changes', () => {
    renderAt('/player/tv/42/1/1')

    const frame = screen.getByTitle('Player: The Show S1E1')
    expect(frame).toHaveAttribute('src', 'https://vidsrc.sh/embed/tv/42/1/1')
    expect(frame).toHaveAttribute('allow', 'fullscreen; autoplay; encrypted-media; picture-in-picture')
    expect(frame).toHaveAttribute('referrerpolicy', 'origin')

    // Episode rows are links that change the URL; there is a single list for every screen size.
    const links = screen.getAllByRole('link', { name: /S1 name 2/ })
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', '/player/tv/42/1/2')
    fireEvent.click(links[0]!)

    expect(screen.getByTitle('Player: The Show S1E2')).toHaveAttribute('src', 'https://vidsrc.sh/embed/tv/42/1/2')
    expect(screen.getByRole('link', { name: /S1 name 2/ })).toHaveAttribute('aria-current', 'page')
  })

  it('has a single h1, no nested <main>, and a filter only for long seasons', () => {
    const { container, unmount } = renderAt('/player/tv/42/1/1')
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(container.querySelector('main')).toBeNull()
    expect(screen.queryByLabelText('Filter episodes by name or number')).toBeNull()
    unmount()

    episodeCounts[1] = 20
    renderAt('/player/tv/42/1/1')
    const filter = screen.getByLabelText('Filter episodes by name or number')
    fireEvent.change(filter, { target: { value: '17' } })
    expect(screen.getAllByRole('link', { name: /S1 name/ }).map((a) => a.textContent)).toEqual([
      expect.stringContaining('S1 name 17'),
    ])
  })

  it('browses another season without interrupting playback', () => {
    renderAt('/player/tv/42/1/2')

    fireEvent.change(screen.getByLabelText('Season'), { target: { value: '2' } })

    expect(location()).toBe('/player/tv/42/1/2')
    expect(document.querySelector('iframe')).toHaveAttribute('src', 'https://vidsrc.sh/embed/tv/42/1/2')
    expect(screen.getByRole('link', { name: /S2 name 1/ })).toHaveAttribute('href', '/player/tv/42/2/1')
    expect(screen.queryByRole('link', { name: /S1 name/ })).toBeNull()
  })

  it('steps through episodes and across seasons with prev/next', () => {
    renderAt('/player/tv/42/1/3')

    const next = screen.getByRole('button', { name: /^Next episode/ })
    expect(next).toHaveAccessibleName('Next episode: S2 · E1')
    fireEvent.click(next)
    expect(location()).toBe('/player/tv/42/2/1')

    fireEvent.click(screen.getByRole('button', { name: 'Previous episode' }))
    expect(location()).toBe('/player/tv/42/1/3')
    fireEvent.click(screen.getByRole('button', { name: 'Previous episode' }))
    expect(location()).toBe('/player/tv/42/1/2')
  })

  it('disables prev on the first episode and next on the last', () => {
    renderAt('/player/tv/42/1/1')
    expect(screen.getByRole('button', { name: 'Previous episode' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /^Next episode/ })).toHaveAccessibleName('Next episode: S1 · E2, S1 name 2')
  })

  it('remembers the episode being played', () => {
    renderAt('/player/tv/42/2/1')
    expect(loadLastEpisode(42)).toEqual({ season: 2, episode: 1 })
  })

  it('resumes the last episode when none is in the URL', () => {
    saveLastEpisode(42, { season: 2, episode: 2 })
    renderAt('/player/tv/42')
    expect(location()).toBe('/player/tv/42/2/2')
    expect(document.querySelector('iframe')).toHaveAttribute('src', 'https://vidsrc.sh/embed/tv/42/2/2')
  })

  it('starts at S1E1 without a saved episode', () => {
    renderAt('/player/tv/42')
    expect(document.querySelector('iframe')).toHaveAttribute('src', 'https://vidsrc.sh/embed/tv/42/1/1')
  })

  it('goes back in history when the player was opened from the app', () => {
    renderAt('/tv/42', '/player/tv/42/1/1')
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByText('details page')).toBeInTheDocument()
  })

  it('goes to the details page when the player was opened directly', () => {
    renderAt('/player/tv/42/1/1')
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(location()).toBe('/tv/42')
  })

  it('reloads the iframe on request', () => {
    renderAt('/player/tv/42/1/1')
    const before = screen.getByTitle('Player: The Show S1E1')
    fireEvent.click(screen.getByRole('button', { name: 'Reload player' }))
    const after = screen.getByTitle('Player: The Show S1E1')
    expect(after).not.toBe(before)
    expect(after).toHaveAttribute('src', 'https://vidsrc.sh/embed/tv/42/1/1')
  })

  it('remembers whether the episode panel is collapsed', () => {
    const { unmount } = renderAt('/player/tv/42/1/1')
    const toggle = screen.getByRole('button', { name: 'Hide episodes' })
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Show episodes' })).toHaveAttribute('aria-expanded', 'false')
    unmount()

    renderAt('/player/tv/42/1/1')
    expect(screen.getByRole('button', { name: 'Show episodes' })).toBeInTheDocument()
  })
})
