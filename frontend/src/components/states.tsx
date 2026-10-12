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
  /** Use 'h1' when the error replaces a whole page, so the page keeps one <h1>. */
  headingLevel?: 'h1' | 'h2'
}

export function ErrorState({
  error,
  onRetry,
  title = 'Something went wrong',
  className = '',
  headingLevel: Heading = 'h2',
}: ErrorStateProps) {
  return (
    <div className={`state state-error ${className}`} role="alert">
      <Heading className="state-title">{title}</Heading>
      <p className="state-message">{errorMessage(error)}</p>
      {onRetry && (
        <button type="button" className="state-retry-btn" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}
