import { useEffect } from 'react'
import { useSearchParams } from 'react-router'
import Search from '../components/Search'
import SearchResults from '../components/SearchResults'
import { SITE_NAME } from '../config'

export default function SearchPage() {
  const [searchParams] = useSearchParams()
  const query = (searchParams.get('q') ?? '').trim()

  useEffect(() => {
    const previous = document.title
    document.title = query ? `${SITE_NAME} - ${query.charAt(0).toUpperCase() + query.slice(1)}` : SITE_NAME
    return () => {
      document.title = previous
    }
  }, [query])

  return (
    <>
      <h1 className="visually-hidden">{query ? `Search: ${query}` : 'Search'}</h1>
      {/* Re-mount the form when the URL changes (back/forward) so it mirrors the URL. */}
      <Search key={searchParams.toString()} />
      <SearchResults />
    </>
  )
}
