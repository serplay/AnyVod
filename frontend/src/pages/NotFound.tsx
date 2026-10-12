import { Link } from 'react-router'

interface NotFoundProps {
  message?: string
}

export default function NotFound({ message = "The page you're looking for doesn't exist." }: NotFoundProps) {
  return (
    <div className="state state-not-found">
      <h1 className="state-title">Page not found</h1>
      <p className="state-message">{message}</p>
      <Link to="/" className="state-home-link">
        Back to home
      </Link>
    </div>
  )
}
