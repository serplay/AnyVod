import { useParams, useNavigate } from 'react-router'
import moviePlaceholder from '../assets/movie.png'
import { ProfileImage, PosterImage } from '../components/OptimizedImage'
import { ErrorState, Loading } from '../components/states'
import NotFound from './NotFound'
import { usePerson, usePersonCredits } from '../api/hooks'
import { ApiError } from '../api/client'
import { displayTitle, formatRating, itemPath, parseNonNegativeInt } from '../lib/media'
import { onActivateKey } from '../lib/a11y'

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
  const navigate = useNavigate()
  const validId = id !== undefined && id > 0 ? id : undefined
  const personQuery = usePerson(validId)
  const { data: credits } = usePersonCredits(validId)
  const person = personQuery.data

  if (validId === undefined) return <NotFound />

  if (personQuery.error) {
    if (personQuery.error instanceof ApiError && personQuery.error.status === 404) {
      return <NotFound message="We couldn't find that person." />
    }
    return <ErrorState error={personQuery.error} onRetry={() => void personQuery.refetch()} />
  }

  if (!person) return <Loading className="person-loading" />

  const age = calculateAge(person.birthday, person.deathday)

  // Sort and get top credits by popularity
  const topCredits = credits?.cast
    ? [...credits.cast]
        .filter((c) => c.poster_path)
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
        .slice(0, 18)
    : []

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
                className="person-profile-img"
                style={{ width: 320, height: 480 }}
              />
            ) : (
              <div className="person-profile-placeholder">{person.name.charAt(0)}</div>
            )}
          </div>

          <div className="person-info">
            <h1 className="person-name">{person.name}</h1>

            <div className="person-meta">
              {person.known_for_department && <span className="person-tag">{person.known_for_department}</span>}
              {age !== null && <span className="person-detail">Age: {age}</span>}
              {person.place_of_birth && <span className="person-detail">📍 {person.place_of_birth}</span>}
            </div>

            {person.biography && (
              <div className="person-bio-preview">
                {person.biography.slice(0, 300)}
                {person.biography.length > 300 ? '...' : ''}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="person-content">
        {/* Personal Info */}
        <section className="person-section">
          <h2 className="person-section-title">Personal Info</h2>
          <div className="person-info-grid">
            {person.birthday && (
              <div className="info-item">
                <div className="info-label">Birthday</div>
                <div className="info-value">{person.birthday}</div>
              </div>
            )}
            {person.place_of_birth && (
              <div className="info-item">
                <div className="info-label">Place of Birth</div>
                <div className="info-value">{person.place_of_birth}</div>
              </div>
            )}
            {person.known_for_department && (
              <div className="info-item">
                <div className="info-label">Known For</div>
                <div className="info-value">{person.known_for_department}</div>
              </div>
            )}
            {!!person.popularity && (
              <div className="info-item">
                <div className="info-label">Popularity</div>
                <div className="info-value">{formatRating(person.popularity)}</div>
              </div>
            )}
          </div>
        </section>

        {/* Known For / Credits */}
        {topCredits.length > 0 && (
          <section className="person-section">
            <h2 className="person-section-title">Known For</h2>
            <div className="person-credits-grid">
              {topCredits.map((credit) => {
                const name = displayTitle(credit)
                const open = () => navigate(itemPath(credit))
                return (
                  <div
                    key={credit.credit_id}
                    className="person-credit-card"
                    role="button"
                    tabIndex={0}
                    onClick={open}
                    onKeyDown={onActivateKey(open)}
                  >
                    {credit.poster_path ? (
                      <PosterImage path={credit.poster_path} alt={name} size="medium" className="credit-poster" />
                    ) : (
                      <img src={moviePlaceholder} alt={name} className="credit-poster placeholder-img" />
                    )}
                    <div className="credit-info">
                      <h3 className="credit-title">{name}</h3>
                      {credit.character && <div className="credit-character">as {credit.character}</div>}
                      {!!credit.vote_average && credit.vote_average > 0 && (
                        <div className="credit-rating">⭐ {formatRating(credit.vote_average)}</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
