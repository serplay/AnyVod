import { Link, useLocation } from 'react-router'
import Seo from '../components/Seo'

interface NotFoundProps {
  message?: string
}

export default function NotFound({ message = "The page you're looking for doesn't exist." }: NotFoundProps) {
  const { pathname } = useLocation()
  return (
    <div className="state state-not-found">
      <Seo title="Page not found" description={message} path={pathname} noindex />
      <h1 className="state-title">Page not found</h1>
      <p className="state-message">{message}</p>
      <Link to="/" className="state-home-link">
        Back to home
      </Link>
    </div>
  )
}
