import { useId } from 'react'
import { Link } from 'react-router'
import { StillImage } from './OptimizedImage'
import { PlayIcon } from './icons'
import type { Episode, SeasonSummary } from '../api/types'
import { isUnaired, seasonName } from '../lib/episodes'

interface EpisodeRowProps {
  episode: Episode
  to: string
  /** Replace the history entry (episode changes inside the player). */
  replace?: boolean
  current?: boolean
  /** Two lines of the episode overview (title page). */
  showOverview?: boolean
  /** Called with the still on hover/focus, and null on leave (the title page's stage preview). */
  onPreview?: (stillPath: string | null) => void
}

/** One episode: still, "E3 · 58m", name. Shared by the title page and the player's panel. */
export default function EpisodeRow({ episode: ep, to, replace, current = false, showOverview = false, onPreview }: EpisodeRowProps) {
  const upcoming = isUnaired(ep.air_date)
  const className = ['episode-row', current ? 'is-current' : '', upcoming ? 'is-upcoming' : ''].filter(Boolean).join(' ')
  const preview = onPreview && ep.still_path ? () => onPreview(ep.still_path) : undefined
  const clear = onPreview ? () => onPreview(null) : undefined

  return (
    <Link
      to={to}
      replace={replace}
      className={className}
      aria-current={current ? 'page' : undefined}
      onMouseEnter={preview}
      onFocus={preview}
      onMouseLeave={clear}
      onBlur={clear}
    >
      <span className="episode-row-thumb">
        <StillImage path={ep.still_path} size="small" sizes="(max-width: 599px) 112px, 144px" />
        {current ? (
          <span className="episode-row-playing">
            <PlayIcon width={14} height={14} />
            Playing
          </span>
        ) : null}
      </span>
      <span className="episode-row-text">
        <span className="episode-row-meta">
          E{ep.episode_number}
          {ep.runtime ? ` · ${ep.runtime}m` : ''}
          {upcoming && ep.air_date ? ` · Airs ${ep.air_date}` : ''}
        </span>
        <span className="episode-row-name">{ep.name || `Episode ${ep.episode_number}`}</span>
        {showOverview && ep.overview ? <span className="episode-row-overview">{ep.overview}</span> : null}
      </span>
    </Link>
  )
}

interface SeasonSelectProps {
  seasons: SeasonSummary[]
  value: number
  onChange: (season: number) => void
  /** Marks this season "(playing)" in the list. */
  playing?: number
  className?: string
}

/** Native <select>: the OS picker is the best season chooser on phones. */
export function SeasonSelect({ seasons, value, onChange, playing, className = '' }: SeasonSelectProps) {
  const id = useId()
  return (
    <>
      <label htmlFor={id} className="visually-hidden">
        Season
      </label>
      <select id={id} className={`season-select ${className}`.trim()} value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {seasons.map((s) => (
          <option key={s.season_number} value={s.season_number}>
            {seasonName(s)}
            {s.season_number === playing ? ' (playing)' : ''}
          </option>
        ))}
      </select>
    </>
  )
}
