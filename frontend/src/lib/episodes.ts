import type { SeasonSummary } from '../api/types'

export interface EpisodeRef {
  season: number
  episode: number
}

/** `/player/tv/:id/:season/:episode` */
export function episodePath(tvId: number, { season, episode }: EpisodeRef): string {
  return `/player/tv/${tvId}/${season}/${episode}`
}

/** "S1 · E2" */
export function episodeLabel({ season, episode }: EpisodeRef): string {
  return `S${season} · E${episode}`
}

/** "Season 2", or the specials' own name. */
export function seasonName(s: SeasonSummary): string {
  return s.season_number === 0 ? s.name || 'Specials' : `Season ${s.season_number}`
}

/** Regular seasons in order. Specials (season 0) are reachable from the season picker, not by prev/next. */
function regularSeasons(seasons: SeasonSummary[]): SeasonSummary[] {
  return seasons.filter((s) => s.season_number > 0)
}

/**
 * The episode after `current`, or undefined at the end of the show.
 * `episodeCount` is the current season's length when known (the loaded season
 * is more reliable than `SeasonSummary.episode_count`, which may be 0 = unknown).
 */
export function nextEpisode(
  current: EpisodeRef,
  seasons: SeasonSummary[],
  episodeCount: number | undefined,
): EpisodeRef | undefined {
  const count = episodeCount ?? seasons.find((s) => s.season_number === current.season)?.episode_count ?? 0
  if (current.episode < count) return { season: current.season, episode: current.episode + 1 }
  if (count === 0) return undefined
  const regular = regularSeasons(seasons)
  const index = regular.findIndex((s) => s.season_number === current.season)
  const next = index >= 0 ? regular[index + 1] : undefined
  return next ? { season: next.season_number, episode: 1 } : undefined
}

/**
 * The episode before `current`, or undefined at the start of the show.
 * Crossing into the previous season returns `episode: undefined` when that
 * season's length is unknown; the caller has to look it up.
 */
export function previousEpisode(
  current: EpisodeRef,
  seasons: SeasonSummary[],
): { season: number; episode: number | undefined } | undefined {
  if (current.episode > 1) return { season: current.season, episode: current.episode - 1 }
  const regular = regularSeasons(seasons)
  const index = regular.findIndex((s) => s.season_number === current.season)
  const prev = index > 0 ? regular[index - 1] : undefined
  if (!prev) return undefined
  return { season: prev.season_number, episode: prev.episode_count > 0 ? prev.episode_count : undefined }
}

/** True when TMDB lists an air date that is still in the future. */
export function isUnaired(airDate: string | null | undefined, now: Date = new Date()): boolean {
  if (!airDate) return false
  const date = new Date(`${airDate}T00:00:00`)
  return !Number.isNaN(date.getTime()) && date > now
}

/* ---- Last watched episode per show (localStorage) ---- */

const LAST_EPISODE_KEY = 'anyvod:last-episode'
const LAST_EPISODE_LIMIT = 100

type LastEpisodes = Record<string, EpisodeRef>

// Non-numeric keys keep insertion order (integer-like keys would sort numerically), which the pruning relies on.
const storageKey = (tvId: number) => `tv-${tvId}`

function readLastEpisodes(): LastEpisodes {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LAST_EPISODE_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as LastEpisodes) : {}
  } catch {
    return {}
  }
}

const isEpisodeNumber = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0

/** The episode last opened for a show, if any. */
export function loadLastEpisode(tvId: number): EpisodeRef | undefined {
  const entry = readLastEpisodes()[storageKey(tvId)]
  if (!entry || !isEpisodeNumber(entry.season) || !isEpisodeNumber(entry.episode) || entry.episode === 0) {
    return undefined
  }
  return { season: entry.season, episode: entry.episode }
}

/** Shows with a remembered episode, most recently played first. */
export function recentShows(limit: number): Array<{ tvId: number; episode: EpisodeRef }> {
  const shows: Array<{ tvId: number; episode: EpisodeRef }> = []
  for (const key of Object.keys(readLastEpisodes()).reverse()) {
    const tvId = Number(key.replace(/^tv-/, ''))
    if (!Number.isSafeInteger(tvId) || tvId <= 0) continue
    const episode = loadLastEpisode(tvId)
    if (episode) shows.push({ tvId, episode })
    if (shows.length >= limit) break
  }
  return shows
}

/** Remember the episode being played. Keeps the most recent shows only. */
export function saveLastEpisode(tvId: number, ref: EpisodeRef): void {
  const all = readLastEpisodes()
  delete all[storageKey(tvId)]
  all[storageKey(tvId)] = { season: ref.season, episode: ref.episode }
  const keys = Object.keys(all)
  for (const key of keys.slice(0, Math.max(0, keys.length - LAST_EPISODE_LIMIT))) delete all[key]
  try {
    localStorage.setItem(LAST_EPISODE_KEY, JSON.stringify(all))
  } catch {
    // Storage full or blocked (private mode): resuming is a convenience, so ignore.
  }
}
