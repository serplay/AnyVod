import { useParams } from 'react-router'
import OptimizedImage from '../components/OptimizedImage'
import PosterCard, { GRID_POSTER_SIZES } from '../components/PosterCard'
import { ErrorState } from '../components/states'
import NotFound from './NotFound'
import Seo from '../components/Seo'
import { usePerson, usePersonCredits } from '../api/hooks'
import { ApiError } from '../api/client'
import { itemKey, itemPath, parseNonNegativeInt, tmdbImageFor } from '../lib/media'
import { topCredits } from '../lib/credits'
import { truncate } from '../lib/seo'

/** Biographies longer than this start collapsed. */
const BIO_PREVIEW_CHARS = 600

// Calculate age from birthday (to deathday if deceased)
function calculateAge(birthday: string | null, deathday: string | null): number | null {
  if (!birthday) return null
  const end = deathday ? new Date(deathday) : new Date()
  const birthDate = new Date(birthday)
  if (Number.isNaN(birthDate.getTime()) || Number.isNaN(end.getTime())) return null
  let age = end.getFullYear() - birthDate.getFullYear()
  const monthDiff = end.getMonth() - birthDate.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && end.getDate() < birthDate.getDate())) {
    age--
  }
  return age
}

/** "1974-11-12" -> "12 Nov 1974" (dates are calendar days, so format in UTC). */
function formatDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return date
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

export default function PersonPage() {
  const { id: rawId } = useParams()
  const id = parseNonNegativeInt(rawId)
  const validId = id !== undefined && id > 0 ? id : undefined
  const personQuery = usePerson(validId)
  const { data: credits } = usePersonCredits(validId)
  const person = personQuery.data

  if (validId === undefined) return <NotFound />

  if (personQuery.error) {
    if (personQuery.error instanceof ApiError && personQuery.error.status === 404) {
      return <NotFound message="We couldn't find that person." />
    }
    return (
      <div className="page">
        <ErrorState error={personQuery.error} onRetry={() => void personQuery.refetch()} headingLevel="h1" />
      </div>
    )
  }

  const age = person ? calculateAge(person.birthday, person.deathday) : null
  // Most popular titles first, one card per title.
  const credited = topCredits(credits?.cast)
  const bio = person?.biography?.trim() ?? ''
  const paragraphs = bio.split(/\n+/).filter(Boolean)

  return (
    <>
      <Seo
        title={person?.name ?? 'Person'}
        description={truncate(person?.biography) || undefined}
        path={`/person/${validId}`}
        image={tmdbImageFor(person?.profile_path, 'profile', 'large')}
        type="profile"
      />
      <div className="stage-page person-page">
        <div className="stage stage-portrait">
          {person?.profile_path ? (
            <OptimizedImage
              tmdbPath={person.profile_path}
              tmdbType="profile"
              tmdbSize="large"
              sizes="(min-width: 1200px) 45vw, 100vw"
              priority
              alt={person.name}
              className="stage-art"
            />
          ) : person ? (
            <span className="stage-initial" aria-hidden="true">
              {person.name?.charAt(0)}
            </span>
          ) : null}
        </div>

        <div className="stage-body">
          {person ? (
            <header className="title-head">
              <h1 className="title-name">{person.name}</h1>
              <p className="meta-line">
                {person.known_for_department ? <span>{person.known_for_department}</span> : null}
                {person.birthday ? (
                  <span>
                    Born {formatDate(person.birthday)}
                    {age !== null && !person.deathday ? ` (${age})` : ''}
                  </span>
                ) : null}
                {person.deathday ? (
                  <span>
                    Died {formatDate(person.deathday)}
                    {age !== null ? ` (${age})` : ''}
                  </span>
                ) : null}
                {person.place_of_birth ? <span>{person.place_of_birth}</span> : null}
              </p>
              {paragraphs.length > 0 ? (
                bio.length > BIO_PREVIEW_CHARS ? (
                  <details className="person-bio">
                    <summary>
                      <span className="person-bio-preview">{paragraphs[0]}</span>
                      <span className="person-bio-toggle">Read more</span>
                    </summary>
                    {paragraphs.slice(1).map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </details>
                ) : (
                  <div className="person-bio">
                    {paragraphs.map((p, i) => (
                      <p key={i}>{p}</p>
                    ))}
                  </div>
                )
              ) : null}
            </header>
          ) : (
            <div className="title-head" role="status">
              <h1 className="visually-hidden">Loading person…</h1>
              <span className="skeleton title-skeleton-name" />
              <span className="skeleton title-skeleton-line" />
              <span className="skeleton title-skeleton-text" />
            </div>
          )}

          {credited.length > 0 ? (
            <section className="title-section" aria-labelledby="known-for-heading">
              <h2 className="section-title title-section-head" id="known-for-heading">
                Known for
              </h2>
              <div className="poster-grid">
                {credited.map((credit) => (
                  <PosterCard
                    key={itemKey(credit)}
                    item={credit}
                    href={itemPath(credit)}
                    sizes={GRID_POSTER_SIZES}
                    meta={credit.character ? `as ${credit.character}` : null}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </>
  )
}
