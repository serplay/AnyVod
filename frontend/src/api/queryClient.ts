import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './client'

const FIVE_MINUTES = 5 * 60 * 1000

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: FIVE_MINUTES,
        refetchOnWindowFocus: false,
        // Client errors (bad id, 404) won't fix themselves; retry only server/network failures.
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
          return failureCount < 2
        },
      },
    },
  })
}
