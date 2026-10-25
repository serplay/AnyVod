import { useSearchParams } from 'react-router'
import Search from '../components/Search'
import SearchResults from '../components/SearchResults'
import PosterCard from '../components/PosterCard'
import Rail from '../components/Rail'
import Seo from '../components/Seo'
import { useTrending } from '../api/hooks'
import { SITE_NAME } from '../config'
import { isPerson, itemKey, itemPath } from '../lib/media'

/** Something to pick from before typing. */
function TrendingSuggestions() {
  const { data, error, refetch } = useTrending()
  const items = data?.results.filter((item) => !isPerson(item))
  return (
    <div className="search-suggestions">
      <Rail title="Trending now" error={error} onRetry={() => void refetch()} loading={!data && !error}>
        {items && items.length > 0
          ? items.map((item) => (
              <li key={itemKey(item)}>
                <PosterCard item={item} href={itemPath(item)} />
              </li>
            ))
          : null}
      </Rail>
    </div>
  )
}

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
      <div className="page search-page">
        <Search />
        <SearchResults />
      </div>
      {query ? null : <TrendingSuggestions />}
    </>
  )
}
