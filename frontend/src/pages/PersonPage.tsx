import { Link, useParams } from 'react-router'
import moviePlaceholder from '../assets/movie.png'
import { ProfileImage, PosterImage } from '../components/OptimizedImage'
import { ErrorState, Loading } from '../components/states'
import NotFound from './NotFound'
import { usePerson, usePersonCredits } from '../api/hooks'
import { ApiError } from '../api/client'
import { displayTitle, formatRating, itemKey, itemPath, parseNonNegativeInt } from '../lib/media'
import { topCredits } from '../lib/credits'

/** person-credits-grid is minmax(200px, 1fr) (150px <=768px, 2 columns <=480px). */
const CREDIT_CARD_SIZES = '(max-width: 480px) 50vw, 240px'

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
    return <ErrorState error={personQuery.error} onRetry={() => void personQuery.refetch()} headingLevel="h1" />
  }

  if (!person) {
    return (
      <>
        <h1 className="visually-hidden">Loading person…</h1>
        <Loading className="person-loading" />
      </>
    )
  }

  const age = calculateAge(person.birthday, person.deathday)
  // Most popular titles first, one card per title.
  const credited = topCredits(credits?.cast)

  return (
    <div className="person-page">
      {/* Hero Section */}
      <div className="person-hero">
        <div className="person-hero-gradient"></div>
        <div className="person-hero-content">
          <div className="person-profile-container">
            {person.profile_path ? (
              <ProfileImage
                path={person.profile_path}
                alt={person.name}
                size="large"
                sizes="320px"
                priority
                className="person-profile-img"
              />
            ) : (
              <div className="person-profile-placeholder" aria-hidden="true">
                {person.name?.charAt(0)}
              </div>
            )}
          </div>

          <div className="person-info">
            <h1 className="person-name">{person.name}</h1>

            <div className="person-meta">
              {person.known_for_department ? <span className="person-tag">{person.known_for_department}</span> : null}
              {age !== null ? <span className="person-detail">Age: {age}</span> : null}
              {person.place_of_birth ? <span className="person-detail">📍 {person.place_of_birth}</span> : null}
            </div>

            {person.biography ? (
              <div className="person-bio-preview">
                {person.biography.slice(0, 300)}
                {person.biography.length > 300 ? '...' : ''}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="person-content">
        {/* Personal Info */}
        <section className="person-section">
          <h2 className="person-section-title">Personal Info</h2>
          <div className="person-info-grid">
            {person.birthday ? (
              <div className="info-item">
                <div className="info-label">Birthday</div>
                <div className="info-value">{person.birthday}</div>
              </div>
            ) : null}
            {person.place_of_birth ? (
              <div className="info-item">
                <div className="info-label">Place of Birth</div>
                <div className="info-value">{person.place_of_birth}</div>
              </div>
            ) : null}
            {person.known_for_department ? (
              <div className="info-item">
                <div className="info-label">Known For</div>
                <div className="info-value">{person.known_for_department}</div>
              </div>
            ) : null}
            {person.popularity != null && person.popularity > 0 ? (
              <div className="info-item">
                <div className="info-label">Popularity</div>
                <div className="info-value">{formatRating(person.popularity)}</div>
              </div>
            ) : null}
          </div>
        </section>

        {/* Known For / Credits */}
        {credited.length > 0 ? (
          <section className="person-section">
            <h2 className="person-section-title">Known For</h2>
            <div className="person-credits-grid">
              {credited.map((credit) => {
                const name = displayTitle(credit)
                return (
                  <Link key={itemKey(credit)} to={itemPath(credit)} className="person-credit-card">
                    {credit.poster_path ? (
                      <PosterImage
                        path={credit.poster_path}
                        alt=""
                        size="medium"
                        sizes={CREDIT_CARD_SIZES}
                        className="credit-poster"
                      />
                    ) : (
                      <img src={moviePlaceholder} alt="" className="credit-poster placeholder-img" loading="lazy" />
                    )}
                    <div className="credit-info">
                      <h3 className="credit-title">{name}</h3>
                      {credit.character ? <div className="credit-character">as {credit.character}</div> : null}
                      {credit.vote_average != null && credit.vote_average > 0 ? (
                        <div className="credit-rating">⭐ {formatRating(credit.vote_average)}</div>
                      ) : null}
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}
