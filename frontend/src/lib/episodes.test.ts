import { beforeEach, describe, expect, it } from 'vitest'
import type { SeasonSummary } from '../api/types'
import { isUnaired, loadLastEpisode, nextEpisode, previousEpisode, recentShows, saveLastEpisode } from './episodes'

const seasons: SeasonSummary[] = [
  { season_number: 0, name: 'Specials', episode_count: 2 },
  { season_number: 1, name: 'Season 1', episode_count: 3 },
  { season_number: 2, name: 'Season 2', episode_count: 0 },
  { season_number: 4, name: 'Season 4', episode_count: 5 },
]

describe('nextEpisode', () => {
  it('moves within a season', () => {
    expect(nextEpisode({ season: 1, episode: 1 }, seasons, 3)).toEqual({ season: 1, episode: 2 })
  })

  it('crosses into the next regular season, skipping gaps', () => {
    expect(nextEpisode({ season: 1, episode: 3 }, seasons, 3)).toEqual({ season: 2, episode: 1 })
    expect(nextEpisode({ season: 2, episode: 8 }, seasons, 8)).toEqual({ season: 4, episode: 1 })
  })

  it('falls back to the season summary while the season is loading', () => {
    expect(nextEpisode({ season: 1, episode: 2 }, seasons, undefined)).toEqual({ season: 1, episode: 3 })
  })

  it('stops when the season length is unknown, at the end of the show, and in Specials', () => {
    expect(nextEpisode({ season: 2, episode: 1 }, seasons, undefined)).toBeUndefined()
    expect(nextEpisode({ season: 4, episode: 5 }, seasons, 5)).toBeUndefined()
    expect(nextEpisode({ season: 0, episode: 2 }, seasons, 2)).toBeUndefined()
  })
})

describe('previousEpisode', () => {
  it('moves within a season', () => {
    expect(previousEpisode({ season: 4, episode: 3 }, seasons)).toEqual({ season: 4, episode: 2 })
  })

  it('crosses into the previous season at its last episode', () => {
    expect(previousEpisode({ season: 2, episode: 1 }, seasons)).toEqual({ season: 1, episode: 3 })
  })

  it('leaves the episode unknown when the previous season length is unknown', () => {
    expect(previousEpisode({ season: 4, episode: 1 }, seasons)).toEqual({ season: 2, episode: undefined })
  })

  it('stops at the first regular season and in Specials', () => {
    expect(previousEpisode({ season: 1, episode: 1 }, seasons)).toBeUndefined()
    expect(previousEpisode({ season: 0, episode: 1 }, seasons)).toBeUndefined()
  })
})

describe('isUnaired', () => {
  const now = new Date('2026-10-21T12:00:00')
  it('is true only for future dates', () => {
    expect(isUnaired('2026-10-30', now)).toBe(true)
    expect(isUnaired('2026-10-01', now)).toBe(false)
    expect(isUnaired(null, now)).toBe(false)
    expect(isUnaired('not a date', now)).toBe(false)
  })
})

describe('last episode storage', () => {
  beforeEach(() => localStorage.clear())

  it('round-trips per show', () => {
    saveLastEpisode(42, { season: 2, episode: 5 })
    saveLastEpisode(7, { season: 1, episode: 1 })
    expect(loadLastEpisode(42)).toEqual({ season: 2, episode: 5 })
    expect(loadLastEpisode(7)).toEqual({ season: 1, episode: 1 })
    expect(loadLastEpisode(99)).toBeUndefined()
  })

  it('ignores corrupt data', () => {
    localStorage.setItem('anyvod:last-episode', '{"tv-42":{"season":"x","episode":2}}')
    expect(loadLastEpisode(42)).toBeUndefined()
    localStorage.setItem('anyvod:last-episode', 'not json')
    expect(loadLastEpisode(42)).toBeUndefined()
  })

  it('keeps only the most recently played shows', () => {
    for (let id = 1; id <= 101; id++) saveLastEpisode(id, { season: 1, episode: 1 })
    expect(loadLastEpisode(1)).toBeUndefined()
    expect(loadLastEpisode(2)).toEqual({ season: 1, episode: 1 })
    expect(loadLastEpisode(101)).toEqual({ season: 1, episode: 1 })
  })

  it('lists recent shows, most recently played first', () => {
    saveLastEpisode(1, { season: 1, episode: 2 })
    saveLastEpisode(2, { season: 3, episode: 4 })
    saveLastEpisode(1, { season: 1, episode: 3 })
    expect(recentShows(10)).toEqual([
      { tvId: 1, episode: { season: 1, episode: 3 } },
      { tvId: 2, episode: { season: 3, episode: 4 } },
    ])
    expect(recentShows(1)).toHaveLength(1)
  })
})
