import type { ReactNode } from 'react'
import { Link } from 'react-router'
import OptimizedImage from './OptimizedImage'

export const STILL_SIZES = '(max-width: 599px) 260px, (max-width: 899px) 300px, (max-width: 1199px) 320px, 360px'

interface StillCardProps {
  href: string
  title: string
  meta?: ReactNode
  /** A TMDB backdrop path. */
  backdropPath: string | null | undefined
}

/** A 16:9 card with the title on a scrim: Continue watching, Now in theaters. */
export default function StillCard({ href, title, meta, backdropPath }: StillCardProps) {
  return (
    <Link to={href} className="still-card">
      {backdropPath ? (
        <OptimizedImage tmdbPath={backdropPath} tmdbType="backdrop" tmdbSize="medium" sizes={STILL_SIZES} alt="" className="oi-fill" />
      ) : null}
      <span className="still-card-text">
        <span className="still-card-title">{title}</span>
        {meta ? <span className="still-card-meta">{meta}</span> : null}
      </span>
    </Link>
  )
}
