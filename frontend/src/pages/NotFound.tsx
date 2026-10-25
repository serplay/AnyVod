import { Link, useLocation } from 'react-router'
import Seo from '../components/Seo'

interface NotFoundProps {
  message?: string
}

export default function NotFound({ message = "The page you're looking for doesn't exist." }: NotFoundProps) {
  const { pathname } = useLocation()
  return (
    <div className="page">
      <Seo title="Page not found" description={message} path={pathname} noindex />
      <div className="state state-not-found">
        <h1 className="state-title">Page not found</h1>
        <p className="state-message">{message}</p>
        <div className="btn-row">
          <Link to="/" className="btn btn-primary">
            Back to home
          </Link>
          <Link to="/search" className="btn">
            Search
          </Link>
        </div>
      </div>
    </div>
  )
}
