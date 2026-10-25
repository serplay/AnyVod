import { Link } from 'react-router'
import { LogoMark } from './icons'
import { CONTACT_EMAIL, DISCORD_PROFILE_URL, SITE_NAME } from '../config'

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <Link to="/" className="site-footer-brand" aria-label={`${SITE_NAME} home`}>
          <LogoMark />
          <span>{SITE_NAME}</span>
        </Link>
        <nav className="site-footer-links" aria-label="Contact">
          <a href={`mailto:${CONTACT_EMAIL}`}>Email</a>
          <a href={DISCORD_PROFILE_URL} target="_blank" rel="noopener noreferrer">
            Discord
          </a>
        </nav>
        <p className="site-footer-note">
          Film and TV data from{' '}
          <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">
            TMDB
          </a>
          . This product uses the TMDB API but is not endorsed or certified by TMDB.
        </p>
      </div>
    </footer>
  )
}
