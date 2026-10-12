import { errorMessage } from '../lib/errors'

interface LoadingProps {
  label?: string
  className?: string
}

export function Loading({ label = 'Loading…', className = '' }: LoadingProps) {
  return (
    <div className={`state state-loading ${className}`} role="status" aria-live="polite">
      <span className="state-spinner" aria-hidden="true" />
      <span className="state-label">{label}</span>
    </div>
  )
}

interface ErrorStateProps {
  error: unknown
  onRetry?: () => void
  title?: string
  className?: string
}

export function ErrorState({ error, onRetry, title = 'Something went wrong', className = '' }: ErrorStateProps) {
  return (
    <div className={`state state-error ${className}`} role="alert">
      <h2 className="state-title">{title}</h2>
      <p className="state-message">{errorMessage(error)}</p>
      {onRetry && (
        <button type="button" className="state-retry-btn" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}
