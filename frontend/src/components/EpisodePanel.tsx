import { useEffect, useId, useRef, useState } from 'react'
import { useSeason } from '../api/hooks'
import type { SeasonSummary } from '../api/types'
import EpisodeRow, { SeasonSelect } from './EpisodeRow'
import { ErrorState } from './states'
import { SearchIcon } from './icons'
import { episodePath, type EpisodeRef } from '../lib/episodes'

/** Seasons longer than this get a filter box. */
const FILTER_THRESHOLD = 12

interface EpisodePanelProps {
  id: string
  tvId: number
  seasons: SeasonSummary[]
  current: EpisodeRef
}

/**
 * Season picker + episode list. Picking a season only browses it; playback
 * changes when an episode is chosen, so a stray tap doesn't cut the video off.
 */
export default function EpisodePanel({ id, tvId, seasons, current }: EpisodePanelProps) {
  // Browsing resets to the playing season whenever playback moves to another season.
  const [browse, setBrowse] = useState({ playing: current.season, season: current.season })
  const browseSeason = browse.playing === current.season ? browse.season : current.season
  const [filter, setFilter] = useState('')
  const seasonQuery = useSeason(tvId, browseSeason)
  const listRef = useRef<HTMLOListElement>(null)
  const filterId = useId()

  const episodes = seasonQuery.data?.episodes ?? []
  const query = filter.trim().toLowerCase()
  const visible = query
    ? episodes.filter((ep) => ep.name?.toLowerCase().includes(query) || String(ep.episode_number) === query)
    : episodes

  // Bring the playing episode into view inside the list. Only when the list is its
  // own scroll box (desktop): on phones it flows with the page, and scrolling the
  // page would push the video away.
  const hasEpisodes = episodes.length > 0
  useEffect(() => {
    const list = listRef.current
    if (!list || list.scrollHeight <= list.clientHeight) return
    const active = list.querySelector<HTMLElement>('[aria-current="page"]')
    if (active) list.scrollTop = active.offsetTop - (list.clientHeight - active.offsetHeight) / 2
  }, [hasEpisodes, browseSeason, current.episode])

  const selectSeason = (season: number) => {
    setBrowse({ playing: current.season, season })
    setFilter('')
  }

  return (
    <aside className="episode-panel" id={id} aria-labelledby={`${id}-heading`}>
      <div className="episode-panel-header">
        <h2 className="episode-panel-title" id={`${id}-heading`}>
          Episodes
        </h2>
        {seasons.length > 1 ? (
          <SeasonSelect
            seasons={seasons}
            value={browseSeason}
            onChange={selectSeason}
            playing={current.season}
            className="episode-panel-season"
          />
        ) : null}
      </div>

      {episodes.length > FILTER_THRESHOLD ? (
        <div className="episode-panel-filter">
          <SearchIcon width={16} height={16} />
          <label htmlFor={filterId} className="visually-hidden">
            Filter episodes by name or number
          </label>
          <input
            id={filterId}
            type="search"
            placeholder="Filter by name or number"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            enterKeyHint="search"
          />
        </div>
      ) : null}

      {seasonQuery.error ? (
        <ErrorState
          error={seasonQuery.error}
          onRetry={() => void seasonQuery.refetch()}
          title="Couldn't load episodes"
          className="episode-panel-state"
        />
      ) : seasonQuery.isPending ? (
        <ol className="episode-list" aria-busy="true" aria-label="Loading episodes">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="episode-row-skeleton skeleton" />
          ))}
        </ol>
      ) : visible.length === 0 ? (
        <p className="episode-panel-empty">{query ? 'No episodes match.' : 'No episodes listed for this season.'}</p>
      ) : (
        <ol className="episode-list" ref={listRef}>
          {visible.map((ep) => (
            <li key={ep.episode_number}>
              <EpisodeRow
                episode={ep}
                to={episodePath(tvId, { season: browseSeason, episode: ep.episode_number })}
                replace
                current={browseSeason === current.season && ep.episode_number === current.episode}
              />
            </li>
          ))}
        </ol>
      )}
    </aside>
  )
}
