import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { PosterImage, ProfileImage } from './OptimizedImage'
import { FilmIcon, StarIcon } from './icons'
import type { MediaListItem } from '../api/types'
import { displayTitle, formatRating, formatYear, isPerson, releaseDate } from '../lib/media'

/** Rendered poster widths: rail cards follow --poster-w, grid cells are a third of a phone. */
export const RAIL_POSTER_SIZES = '(max-width: 599px) 128px, (max-width: 899px) 150px, (max-width: 1199px) 172px, 192px'
export const GRID_POSTER_SIZES = '(max-width: 599px) 33vw, (max-width: 1199px) 20vw, 200px'

interface PosterCardProps {
  item: MediaListItem
  href: string
  sizes?: string
  priority?: boolean
  /** Replaces the default "year · rating" line. */
  meta?: ReactNode
}

/** "★ 7.7" with a spoken label; nothing for missing or zero ratings. */
export function Rating({ value }: { value: number | null | undefined }) {
  const text = value ? formatRating(value) : undefined
  if (!text) return null
  return (
    <span className="rating">
      <StarIcon width={13} height={13} />
      <span className="visually-hidden">Rated </span>
      {text}
    </span>
  )
}

/** A 2:3 poster with the title and one line of meta underneath. People use their profile photo. */
export default function PosterCard({ item, href, sizes = RAIL_POSTER_SIZES, priority = false, meta }: PosterCardProps) {
  const name = displayTitle(item)
  const person = isPerson(item)
  const imagePath = person ? item.profile_path : item.poster_path
  const CardImage = person ? ProfileImage : PosterImage
  const year = person ? undefined : formatYear(releaseDate(item))
  const rating = !person && item.vote_average ? <Rating value={item.vote_average} /> : null

  return (
    <Link to={href} className="poster-card">
      <span className="poster-card-art">
        {imagePath ? (
          <CardImage path={imagePath} alt="" size="medium" sizes={sizes} priority={priority} className="oi-fill" />
        ) : (
          <span className="poster-card-blank" aria-hidden="true">
            <FilmIcon width={28} height={28} />
          </span>
        )}
      </span>
      <span className="poster-card-title">{name}</span>
      {meta !== undefined ? (
        meta && <span className="poster-card-meta">{meta}</span>
      ) : year || rating ? (
        <span className="poster-card-meta meta-line">
          {year ? <span>{year}</span> : null}
          {rating}
        </span>
      ) : null}
    </Link>
  )
}
