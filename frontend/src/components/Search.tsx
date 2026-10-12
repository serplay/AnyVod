import { useState, useEffect, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useGenres } from '../api/hooks'
import type { SearchSort, SearchType } from '../api/types'
import { parseSearchParams, searchPath } from '../lib/searchParams'

type TypeOption = 'All' | SearchType
type SortOption = 'Default' | SearchSort
type DropdownName = 'type' | 'rating' | 'sort' | 'year'

const typeOptions = ['All', 'Movies', 'TV Shows'] as const
const ratingOptions = ['All', '9+', '8+', '7+', '6+', '5+'] as const
const sortOptions: ReadonlyArray<{ value: SortOption; label: string }> = [
  { value: 'Default', label: 'Default' },
  { value: 'popularity_desc', label: 'Popular' },
  { value: 'rating_desc', label: 'Top Rated' },
  { value: 'title_asc', label: 'A-Z' },
  { value: 'title_desc', label: 'Z-A' },
  { value: 'date_desc', label: 'Newest' },
  { value: 'date_asc', label: 'Oldest' },
]

function optionToType(opt: string): TypeOption {
  if (opt === 'Movies') return 'movie'
  if (opt === 'TV Shows') return 'tv'
  if (opt === 'People') return 'person'
  return 'All'
}

function typeLabel(type: TypeOption): string {
  if (type === 'movie') return 'Movies'
  if (type === 'tv') return 'TV Shows'
  if (type === 'person') return 'People'
  return type
}

/**
 * Search form. Initial values come from the URL (so /search?q=... round-trips);
 * submitting navigates to /search?..., and SearchResults reads the URL.
 */
export default function Search() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initial = parseSearchParams(searchParams)

  const [q, setQ] = useState(initial?.query ?? '')
  const [type, setType] = useState<TypeOption>(initial?.type ?? 'All')
  const [year, setYear] = useState(initial?.year !== undefined ? String(initial.year) : '')
  const [sortBy, setSortBy] = useState<SortOption>(initial?.sort_by ?? 'Default')
  const [minRating, setMinRating] = useState<string>(
    initial?.min_rating !== undefined ? `${initial.min_rating}+` : 'All',
  )
  const [selectedGenres, setSelectedGenres] = useState<number[]>(initial?.genres ?? [])
  const [showFilters, setShowFilters] = useState(false)

  // Dropdown states
  const [activeDropdown, setActiveDropdown] = useState<DropdownName | null>(null)

  const genresQuery = useGenres(type === 'person' ? null : type === 'tv' ? 'tv' : 'movie')
  const genres = type === 'person' ? [] : (genresQuery.data?.genres ?? [])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!(e.target instanceof Element) || !e.target.closest('.filter-dropdown')) {
        setActiveDropdown(null)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  function submit(e?: FormEvent) {
    e?.preventDefault()
    const query = q.trim()
    if (!query) return

    const yearNum = year ? Number(year) : undefined
    const rating = minRating !== 'All' ? parseFloat(minRating) : undefined

    navigate(
      searchPath({
        query,
        type: type === 'All' ? undefined : type,
        year: yearNum !== undefined && Number.isInteger(yearNum) ? yearNum : undefined,
        sort_by: sortBy === 'Default' ? undefined : sortBy,
        min_rating: rating !== undefined && Number.isFinite(rating) ? rating : undefined,
        genres: selectedGenres.length > 0 ? selectedGenres : undefined,
      }),
    )
  }

  function clear() {
    setQ('')
    setYear('')
    setType('All')
    setSortBy('Default')
    setMinRating('All')
    setSelectedGenres([])
    navigate('/')
  }

  function toggleGenre(genreId: number) {
    setSelectedGenres((prev) => (prev.includes(genreId) ? prev.filter((id) => id !== genreId) : [...prev, genreId]))
  }

  function toggleDropdown(name: DropdownName) {
    setActiveDropdown(activeDropdown === name ? null : name)
  }

  function selectOption<T>(setter: (value: T) => void, value: T) {
    setter(value)
    setActiveDropdown(null)
  }

  const hasActiveFilters =
    type !== 'All' || !!year || sortBy !== 'Default' || minRating !== 'All' || selectedGenres.length > 0

  return (
    <div className="search">
      <form className="search-form" onSubmit={submit} role="search">
        <div className="search-input">
          <input
            aria-label="Search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search movies, TV shows, or people..."
          />
          <button className="search-btn" type="submit">
            Search
          </button>
          <button
            type="button"
            className={`filter-toggle-btn ${showFilters ? 'active' : ''} ${hasActiveFilters ? 'has-filters' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
            aria-expanded={showFilters}
          >
            Filter
            {hasActiveFilters && (
              <span className="filter-count">
                {(type !== 'All' ? 1 : 0) +
                  (year ? 1 : 0) +
                  (sortBy !== 'Default' ? 1 : 0) +
                  (minRating !== 'All' ? 1 : 0) +
                  selectedGenres.length}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="search-filters-panel">
            <div className="filter-section">
              <span className="filter-section-title">Filter</span>
              <div className="filter-pills">
                {/* Type Filter */}
                <div className="filter-dropdown">
                  <button
                    type="button"
                    className="filter-pill"
                    aria-expanded={activeDropdown === 'type'}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleDropdown('type')
                    }}
                  >
                    <span className="pill-label">Type</span>
                    <span className="pill-value">{typeLabel(type)}</span>
                  </button>
                  {activeDropdown === 'type' && (
                    <div className="dropdown-menu">
                      {typeOptions.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          className={`dropdown-item ${optionToType(opt) === type ? 'active' : ''}`}
                          onClick={() => {
                            selectOption(setType, optionToType(opt))
                            setSelectedGenres([])
                          }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Rating Filter */}
                <div className="filter-dropdown">
                  <button
                    type="button"
                    className="filter-pill"
                    aria-expanded={activeDropdown === 'rating'}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleDropdown('rating')
                    }}
                  >
                    <span className="pill-label">Score</span>
                    <span className="pill-value">{minRating}</span>
                  </button>
                  {activeDropdown === 'rating' && (
                    <div className="dropdown-menu">
                      {ratingOptions.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          className={`dropdown-item ${minRating === opt ? 'active' : ''}`}
                          onClick={() => selectOption<string>(setMinRating, opt)}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Sort Filter */}
                <div className="filter-dropdown">
                  <button
                    type="button"
                    className="filter-pill"
                    aria-expanded={activeDropdown === 'sort'}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleDropdown('sort')
                    }}
                  >
                    <span className="pill-label">Sort</span>
                    <span className="pill-value">{sortOptions.find((o) => o.value === sortBy)?.label || 'Default'}</span>
                  </button>
                  {activeDropdown === 'sort' && (
                    <div className="dropdown-menu">
                      {sortOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          className={`dropdown-item ${sortBy === opt.value ? 'active' : ''}`}
                          onClick={() => selectOption(setSortBy, opt.value)}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Year Filter */}
                <div className="filter-dropdown">
                  <button
                    type="button"
                    className="filter-pill"
                    aria-expanded={activeDropdown === 'year'}
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleDropdown('year')
                    }}
                  >
                    <span className="pill-label">Year</span>
                    <span className="pill-value">{year || 'All'}</span>
                  </button>
                  {activeDropdown === 'year' && (
                    <div className="dropdown-menu dropdown-menu-input">
                      <input
                        type="number"
                        aria-label="Release year"
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        placeholder="Enter year"
                        min="1900"
                        max="2100"
                        // Focus moves into the dropdown the user just opened.
                        // eslint-disable-next-line jsx-a11y/no-autofocus
                        autoFocus
                      />
                      <button
                        type="button"
                        className="dropdown-item"
                        onClick={() => {
                          setYear('')
                          setActiveDropdown(null)
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Genre Tags */}
            {genres.length > 0 && (
              <div className="filter-section">
                <span className="filter-section-title">Genre</span>
                <div className="genre-tags">
                  {genres.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      className={`genre-tag ${selectedGenres.includes(g.id) ? 'active' : ''}`}
                      aria-pressed={selectedGenres.includes(g.id)}
                      onClick={() => toggleGenre(g.id)}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Filter Action Button */}
            <div className="filter-actions">
              <button type="submit" className="filter-apply-btn">
                Filter
              </button>
              {hasActiveFilters && (
                <button type="button" className="filter-clear-btn" onClick={clear}>
                  Clear All
                </button>
              )}
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
