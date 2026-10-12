import { ApiError } from '../api/client'

/** User-facing message for an error thrown by the data layer. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 0) return 'Could not reach the server. Check your connection and try again.'
    if (error.status === 404) return 'We could not find that.'
    if (error.status === 504) return 'The server took too long to respond.'
    return error.detail || `Request failed (${error.status}).`
  }
  if (error instanceof Error && error.message) return error.message
  return 'Something went wrong.'
}
