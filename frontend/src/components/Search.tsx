import { useState, useEffect, useId, useRef, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useGenres } from '../api/hooks'
import type { SearchSort, SearchType } from '../api/types'
import { parseSearchParams, searchPath } from '../lib/searchParams'

type TypeOption = 'All' | SearchType
type SortOption = 'Default' | SearchSort
type DropdownName = 'type' | 'rating' | 'sort' | 'year'

interface Option<T extends string> {
  value: T
  label: string
}

const typeOptions: ReadonlyArray<Option<TypeOption>> = [
  { value: 'All', label: 'All' },
  { value: 'movie', label: 'Movies' },
  { value: 'tv', label: 'TV Shows' },
  { value: 'person', label: 'People' },
]
const ratingOptions: ReadonlyArray<Option<string>> = ['All', '9+', '8+', '7+', '6+', '5+'].map((v) => ({ value: v, label: v }))
const sortOptions: ReadonlyArray<Option<SortOption>> = [
  { value: 'Default', label: 'Default' },
  { value: 'popularity_desc', label: 'Popular' },
  { value: 'rating_desc', label: 'Top Rated' },
  { value: 'title_asc', label: 'A-Z' },
  { value: 'title_desc', label: 'Z-A' },
  { value: 'date_desc', label: 'Newest' },
  { value: 'date_asc', label: 'Oldest' },
]

function labelOf<T extends string>(options: ReadonlyArray<Option<T>>, value: T): string {
  return options.find((o) => o.value === value)?.label ?? value
}

interface FilterDropdownProps {
  label: string
  valueLabel: string
  open: boolean
  onToggle: () => void
  onClose: () => void
  /** `listbox` for option lists, `dialog` for free-form content (the year input). */
  popup: 'listbox' | 'dialog'
  menuClassName?: string
  children: (ids: { popupId: string; close: () => void }) => ReactNode
}

/**
 * A filter pill with a popup. Escape closes it and returns focus to the pill;
 * clicking outside closes it (the listener only exists while it's open).
 * Listbox popups get arrow-key / Home / End navigation between options.
 */
function FilterDropdown({ label, valueLabel, open, onToggle, onClose, popup, menuClassName = '', children }: FilterDropdownProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const popupId = useId()

  const close = () => {
    onClose()
    triggerRef.current?.focus()
  }

  // Close on outside pointer down; subscribed only while open, removed on close/unmount.
  useEffect(() => {
    if (!open) return
    const handlePointerDown = (e: Event) => {
      if (e.target instanceof Node && containerRef.current?.contains(e.target)) return
      onClose()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open, onClose])

  // Move focus into a listbox when it opens: the selected option, else the first.
  useEffect(() => {
    if (!open || popup !== 'listbox') return
    const el = popupRef.current
    const target = el?.querySelector<HTMLElement>('[aria-selected="true"]') ?? el?.querySelector<HTMLElement>('[role="option"]')
    target?.focus()
  }, [open, popup])

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && open) {
      e.preventDefault()
      e.stopPropagation()
      close()
      return
    }
    if (!open || popup !== 'listbox') return
    const options = Array.from(popupRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])
    if (options.length === 0) return
    const index = options.indexOf(document.activeElement as HTMLElement)
    let next: number | undefined
    if (e.key === 'ArrowDown') next = index < 0 ? 0 : Math.min(options.length - 1, index + 1)
    else if (e.key === 'ArrowUp') next = index < 0 ? options.length - 1 : Math.max(0, index - 1)
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = options.length - 1
    else if (e.key === 'Tab') onClose()
    if (next !== undefined) {
      e.preventDefault()
      options[next]?.focus()
    }
  }

  return (
    // Keyboard handling for the trigger + popup as one widget.
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div className="filter-dropdown" ref={containerRef} onKeyDown={handleKeyDown}>
      <button
        ref={triggerRef}
        type="button"
        className="filter-pill"
        aria-haspopup={popup}
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        onClick={onToggle}
      >
        <span className="pill-label">{label}</span>
        <span className="pill-value">{valueLabel}</span>
      </button>
      {open ? (
        <div
          ref={popupRef}
          id={popupId}
          className={`dropdown-menu ${menuClassName}`.trim()}
          role={popup}
          aria-label={label}
        >
          {children({ popupId, close })}
        </div>
      ) : null}
    </div>
  )
}

interface ListboxOptionsProps<T extends string> {
  options: ReadonlyArray<Option<T>>
  selected: T
  onSelect: (value: T) => void
}

function ListboxOptions<T extends string>({ options, selected, onSelect }: ListboxOptionsProps<T>) {
  return (
    <>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="option"
          aria-selected={opt.value === selected}
          tabIndex={opt.value === selected ? 0 : -1}
          className={`dropdown-item ${opt.value === selected ? 'active' : ''}`}
          onClick={() => onSelect(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </>
  )
}

/**
 * Search form. Initial values come from the URL (so /search?q=... round-trips);
 * submitting navigates to /search?..., and SearchResults reads the URL.
 */
export default function Search() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initial = parseSearchParams(searchParams)
  const yearInputId = useId()

  const [q, setQ] = useState(initial?.query ?? '')
  const [type, setType] = useState<TypeOption>(initial?.type ?? 'All')
  const [year, setYear] = useState(initial?.year !== undefined ? String(initial.year) : '')
  const [sortBy, setSortBy] = useState<SortOption>(initial?.sort_by ?? 'Default')
  const [minRating, setMinRating] = useState<string>(
    initial?.min_rating !== undefined ? `${initial.min_rating}+` : 'All',
  )
  const [selectedGenres, setSelectedGenres] = useState<number[]>(initial?.genres ?? [])
  const [showFilters, setShowFilters] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<DropdownName | null>(null)

  const genresQuery = useGenres(type === 'person' ? null : type === 'tv' ? 'tv' : 'movie')
  const genres = type === 'person' ? [] : (genresQuery.data?.genres ?? [])

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

  const closeDropdown = () => setActiveDropdown(null)
  const dropdownProps = (name: DropdownName) => ({
    open: activeDropdown === name,
    onToggle: () => setActiveDropdown(activeDropdown === name ? null : name),
    onClose: closeDropdown,
  })

  const activeFilterCount =
    (type !== 'All' ? 1 : 0) +
    (year ? 1 : 0) +
    (sortBy !== 'Default' ? 1 : 0) +
    (minRating !== 'All' ? 1 : 0) +
    selectedGenres.length
  const hasActiveFilters = activeFilterCount > 0

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
            {hasActiveFilters ? <span className="filter-count">{activeFilterCount}</span> : null}
          </button>
        </div>

        {showFilters ? (
          <div className="search-filters-panel">
            <div className="filter-section">
              <span className="filter-section-title">Filter</span>
              <div className="filter-pills">
                <FilterDropdown label="Type" valueLabel={labelOf(typeOptions, type)} popup="listbox" {...dropdownProps('type')}>
                  {({ close }) => (
                    <ListboxOptions
                      options={typeOptions}
                      selected={type}
                      onSelect={(value) => {
                        setType(value)
                        setSelectedGenres([])
                        close()
                      }}
                    />
                  )}
                </FilterDropdown>

                <FilterDropdown label="Score" valueLabel={minRating} popup="listbox" {...dropdownProps('rating')}>
                  {({ close }) => (
                    <ListboxOptions
                      options={ratingOptions}
                      selected={minRating}
                      onSelect={(value) => {
                        setMinRating(value)
                        close()
                      }}
                    />
                  )}
                </FilterDropdown>

                <FilterDropdown label="Sort" valueLabel={labelOf(sortOptions, sortBy)} popup="listbox" {...dropdownProps('sort')}>
                  {({ close }) => (
                    <ListboxOptions
                      options={sortOptions}
                      selected={sortBy}
                      onSelect={(value) => {
                        setSortBy(value)
                        close()
                      }}
                    />
                  )}
                </FilterDropdown>

                <FilterDropdown
                  label="Year"
                  valueLabel={year || 'All'}
                  popup="dialog"
                  menuClassName="dropdown-menu-input"
                  {...dropdownProps('year')}
                >
                  {({ close }) => (
                    <>
                      <label htmlFor={yearInputId} className="visually-hidden">
                        Release year
                      </label>
                      <input
                        id={yearInputId}
                        type="number"
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
                          close()
                        }}
                      >
                        Clear
                      </button>
                    </>
                  )}
                </FilterDropdown>
              </div>
            </div>

            {/* Genre Tags */}
            {genres.length > 0 ? (
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
            ) : null}

            {/* Filter Action Button */}
            <div className="filter-actions">
              <button type="submit" className="filter-apply-btn">
                Filter
              </button>
              {hasActiveFilters ? (
                <button type="button" className="filter-clear-btn" onClick={clear}>
                  Clear All
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </form>
    </div>
  )
}
