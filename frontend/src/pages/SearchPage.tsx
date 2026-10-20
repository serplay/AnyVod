import { useSearchParams } from 'react-router'
import Search from '../components/Search'
import SearchResults from '../components/SearchResults'
import Seo from '../components/Seo'
import { SITE_NAME } from '../config'

export default function SearchPage() {
  const [searchParams] = useSearchParams()
  const query = (searchParams.get('q') ?? '').trim()

  return (
    <>
      <Seo
        title={query ? `Search: ${query}` : 'Search'}
        description={query ? `Search results for "${query}" on ${SITE_NAME}.` : `Search movies, TV shows and people on ${SITE_NAME}.`}
        path="/search"
        noindex
      />
      <h1 className="visually-hidden">{query ? `Search: ${query}` : 'Search'}</h1>
      {/* Re-mount the form when the URL changes (back/forward) so it mirrors the URL. */}
      <Search key={searchParams.toString()} />
      <SearchResults />
    </>
  )
}
