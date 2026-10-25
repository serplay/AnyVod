import { useState, useEffect, useId, useRef, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useGenres } from '../api/hooks'
import type { Genre, SearchParams, SearchSort, SearchType } from '../api/types'
import { parseSearchParams, searchPath } from '../lib/searchParams'
import { CloseIcon, FilterIcon, SearchIcon } from './icons'

type TypeOption = 'All' | SearchType
type SortOption = 'Default' | SearchSort
type DropdownName = 'rating' | 'sort' | 'year' | 'genres'

interface Option<T extends string> {
  value: T
  label: string
}

const typeOptions: ReadonlyArray<Option<TypeOption>> = [
  { value: 'All', label: 'All' },
  { value: 'movie', label: 'Movies' },
  { value: 'tv', label: 'TV shows' },
  { value: 'person', label: 'People' },
]
const ratingOptions: ReadonlyArray<Option<string>> = ['All', '9+', '8+', '7+', '6+', '5+'].map((v) => ({ value: v, label: v }))
const sortOptions: ReadonlyArray<Option<SortOption>> = [
  { value: 'Default', label: 'Relevance' },
  { value: 'popularity_desc', label: 'Popular' },
  { value: 'rating_desc', label: 'Top rated' },
  { value: 'date_desc', label: 'Newest' },
  { value: 'date_asc', label: 'Oldest' },
  { value: 'title_asc', label: 'A–Z' },
  { value: 'title_desc', label: 'Z–A' },
]

function labelOf<T extends string>(options: ReadonlyArray<Option<T>>, value: T): string {
  return options.find((o) => o.value === value)?.label ?? value
}

/** The filter values as the controls show them. */
interface Filters {
  type: TypeOption
  rating: string
  sort: SortOption
  year: string
  genres: number[]
}

function filtersOf(params: SearchParams | null): Filters {
  return {
    type: params?.type ?? 'All',
    rating: params?.min_rating !== undefined ? `${params.min_rating}+` : 'All',
    sort: params?.sort_by ?? 'Default',
    year: params?.year !== undefined ? String(params.year) : '',
    genres: params?.genres ?? [],
  }
}

function toParams(query: string, f: Filters): SearchParams {
  const yearNum = f.year ? Number(f.year) : undefined
  const rating = f.rating !== 'All' ? parseFloat(f.rating) : undefined
  return {
    query,
    type: f.type === 'All' ? undefined : f.type,
    year: yearNum !== undefined && Number.isInteger(yearNum) ? yearNum : undefined,
    sort_by: f.sort === 'Default' ? undefined : f.sort,
    min_rating: rating !== undefined && Number.isFinite(rating) ? rating : undefined,
    genres: f.genres.length > 0 ? f.genres : undefined,
  }
}

function countActive(f: Filters): number {
  return (f.rating !== 'All' ? 1 : 0) + (f.sort !== 'Default' ? 1 : 0) + (f.year ? 1 : 0) + f.genres.length
}

interface FilterDropdownProps {
  label: string
  valueLabel: string
  open: boolean
  onToggle: () => void
  onClose: () => void
  /** `listbox` for option lists, `dialog` for free-form content. */
  popup: 'listbox' | 'dialog'
  active?: boolean
  menuClassName?: string
  children: (ids: { popupId: string; close: () => void }) => ReactNode
}

/**
 * A filter chip with a popup. Escape closes it and returns focus to the chip;
 * clicking outside closes it (the listener only exists while it's open).
 * Listbox popups get arrow-key / Home / End navigation between options.
 */
function FilterDropdown({ label, valueLabel, open, onToggle, onClose, popup, active = false, menuClassName = '', children }: FilterDropdownProps) {
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
        className={`chip${active ? ' is-active' : ''}`}
        aria-haspopup={popup}
        aria-expanded={open}
        aria-controls={open ? popupId : undefined}
        onClick={onToggle}
      >
        <span className="chip-label">{label}</span>
        <span className="chip-value">{valueLabel}</span>
      </button>
      {open ? (
        <div ref={popupRef} id={popupId} className={`dropdown-menu ${menuClassName}`.trim()} role={popup} aria-label={label}>
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
          className="dropdown-item"
          onClick={() => onSelect(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </>
  )
}

function TypeSwitch({ value, onChange }: { value: TypeOption; onChange: (value: TypeOption) => void }) {
  return (
    <div className="segmented" role="group" aria-label="Type">
      {typeOptions.map((opt) => (
        <button key={opt.value} type="button" aria-pressed={opt.value === value} onClick={() => onChange(opt.value)}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function GenreChips({ genres, selected, onToggle }: { genres: Genre[]; selected: number[]; onToggle: (id: number) => void }) {
  return (
    <div className="genre-chips">
      {genres.map((g) => (
        <button
          key={g.id}
          type="button"
          className={`chip${selected.includes(g.id) ? ' is-active' : ''}`}
          aria-pressed={selected.includes(g.id)}
          onClick={() => onToggle(g.id)}
        >
          {g.name}
        </button>
      ))}
    </div>
  )
}

function YearForm({ initial, onApply }: { initial: string; onApply: (year: string) => void }) {
  const inputId = useId()
  const [year, setYear] = useState(initial)
  return (
    <div className="year-form">
      <label htmlFor={inputId} className="visually-hidden">
        Release year
      </label>
      <input
        id={inputId}
        type="number"
        inputMode="numeric"
        value={year}
        onChange={(e) => setYear(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onApply(year)
          }
        }}
        placeholder="e.g. 2019"
        min="1900"
        max="2100"
        // Focus moves into the popup the user just opened.
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
      />
      <div className="btn-row">
        <button type="button" className="btn btn-primary" onClick={() => onApply(year)}>
          Apply
        </button>
        <button type="button" className="btn" onClick={() => onApply('')}>
          Clear
        </button>
      </div>
    </div>
  )
}

interface FilterSheetProps {
  initial: Filters
  genres: Genre[]
  onApply: (filters: Filters) => void
  onClose: () => void
}

/** Phones: every filter in a bottom sheet, applied together. */
function FilterSheet({ initial, genres, onApply, onClose }: FilterSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [draft, setDraft] = useState(initial)
  const ratingId = useId()
  const sortId = useId()
  const yearId = useId()
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (typeof dialog.showModal === 'function') dialog.showModal()
    else dialog.setAttribute('open', '')
  }, [])

  const toggleGenre = (id: number) =>
    setDraft((d) => ({ ...d, genres: d.genres.includes(id) ? d.genres.filter((g) => g !== id) : [...d.genres, id] }))

  return (
    // A click on the backdrop (the dialog element itself) closes the sheet; Escape is handled natively.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sheet-body">
        <div className="sheet-head">
          <h2 className="section-title" id={titleId}>
            Filters
          </h2>
          <button type="button" className="btn btn-icon" onClick={onClose} aria-label="Close filters">
            <CloseIcon />
          </button>
        </div>

        <div className="sheet-fields">
          <label htmlFor={sortId}>Sort by</label>
          <select id={sortId} className="season-select" value={draft.sort} onChange={(e) => setDraft({ ...draft, sort: e.target.value as SortOption })}>
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <label htmlFor={ratingId}>Score</label>
          <select id={ratingId} className="season-select" value={draft.rating} onChange={(e) => setDraft({ ...draft, rating: e.target.value })}>
            {ratingOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.value === 'All' ? 'Any' : o.label}
              </option>
            ))}
          </select>
          <label htmlFor={yearId}>Year</label>
          <input
            id={yearId}
            className="sheet-input"
            type="number"
            inputMode="numeric"
            placeholder="Any"
            min="1900"
            max="2100"
            value={draft.year}
            onChange={(e) => setDraft({ ...draft, year: e.target.value })}
          />
        </div>

        {genres.length > 0 ? (
          <fieldset className="sheet-genres">
            <legend>Genres</legend>
            <GenreChips genres={genres} selected={draft.genres} onToggle={toggleGenre} />
          </fieldset>
        ) : null}
      </div>

      <div className="sheet-actions">
        <button type="button" className="btn" onClick={() => setDraft({ ...draft, rating: 'All', sort: 'Default', year: '', genres: [] })}>
          Clear
        </button>
        <button type="button" className="btn btn-primary" onClick={() => onApply(draft)}>
          Show results
        </button>
      </div>
    </dialog>
  )
}

/**
 * Search field and filters. Everything lives in the URL: changing a filter
 * navigates to /search?..., and SearchResults reads the URL.
 */
export default function Search() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const params = parseSearchParams(searchParams)
  const urlQuery = params?.query ?? ''
  const filters = filtersOf(params)

  // Mirror the URL's query in the field when it changes (back/forward, a new search).
  const [q, setQ] = useState(urlQuery)
  const [seenQuery, setSeenQuery] = useState(urlQuery)
  if (seenQuery !== urlQuery) {
    setSeenQuery(urlQuery)
    setQ(urlQuery)
  }
  const [activeDropdown, setActiveDropdown] = useState<DropdownName | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const genresQuery = useGenres(filters.type === 'person' ? null : filters.type === 'tv' ? 'tv' : 'movie')
  const genres = filters.type === 'person' ? [] : (genresQuery.data?.genres ?? [])

  const apply = (next: Filters) => {
    if (!params) return
    void navigate(searchPath(toParams(params.query, next)))
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const query = q.trim()
    if (!query) return
    void navigate(searchPath(toParams(query, filters)))
  }

  const closeDropdown = () => setActiveDropdown(null)
  const dropdownProps = (name: DropdownName) => ({
    open: activeDropdown === name,
    onToggle: () => setActiveDropdown(activeDropdown === name ? null : name),
    onClose: closeDropdown,
  })

  const activeCount = countActive(filters)

  return (
    <div className="search">
      <form className="search-field" onSubmit={submit} role="search">
        <SearchIcon />
        <input
          aria-label="Search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Movies, TV shows, people"
          enterKeyHint="search"
          // The search page exists to type into; an empty one starts focused.
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={!params}
        />
        {q ? (
          <button type="button" className="btn btn-icon search-clear" onClick={() => setQ('')} aria-label="Clear search">
            <CloseIcon width={18} height={18} />
          </button>
        ) : null}
        <button className="btn btn-primary search-submit" type="submit">
          Search
        </button>
      </form>

      {params ? (
        <div className="search-filters">
          <TypeSwitch value={filters.type} onChange={(type) => apply({ ...filters, type, genres: [] })} />

          <button
            type="button"
            className={`chip search-filters-open${activeCount > 0 ? ' is-active' : ''}`}
            onClick={() => setSheetOpen(true)}
            aria-haspopup="dialog"
          >
            <FilterIcon width={18} height={18} />
            Filters{activeCount > 0 ? ` (${activeCount})` : ''}
          </button>

          <div className="search-filters-inline">
            <FilterDropdown
              label="Sort"
              valueLabel={labelOf(sortOptions, filters.sort)}
              popup="listbox"
              active={filters.sort !== 'Default'}
              {...dropdownProps('sort')}
            >
              {({ close }) => (
                <ListboxOptions
                  options={sortOptions}
                  selected={filters.sort}
                  onSelect={(sort) => {
                    close()
                    apply({ ...filters, sort })
                  }}
                />
              )}
            </FilterDropdown>

            <FilterDropdown label="Score" valueLabel={filters.rating} popup="listbox" active={filters.rating !== 'All'} {...dropdownProps('rating')}>
              {({ close }) => (
                <ListboxOptions
                  options={ratingOptions}
                  selected={filters.rating}
                  onSelect={(rating) => {
                    close()
                    apply({ ...filters, rating })
                  }}
                />
              )}
            </FilterDropdown>

            <FilterDropdown label="Year" valueLabel={filters.year || 'All'} popup="dialog" active={!!filters.year} {...dropdownProps('year')}>
              {({ close }) => (
                <YearForm
                  initial={filters.year}
                  onApply={(year) => {
                    close()
                    apply({ ...filters, year })
                  }}
                />
              )}
            </FilterDropdown>

            {genres.length > 0 ? (
              <FilterDropdown
                label="Genres"
                valueLabel={filters.genres.length > 0 ? String(filters.genres.length) : 'All'}
                popup="dialog"
                active={filters.genres.length > 0}
                menuClassName="dropdown-menu-wide"
                {...dropdownProps('genres')}
              >
                {() => (
                  <GenreChips
                    genres={genres}
                    selected={filters.genres}
                    onToggle={(id) =>
                      apply({
                        ...filters,
                        genres: filters.genres.includes(id) ? filters.genres.filter((g) => g !== id) : [...filters.genres, id],
                      })
                    }
                  />
                )}
              </FilterDropdown>
            ) : null}

            {activeCount > 0 ? (
              <button type="button" className="search-filters-reset" onClick={() => apply({ ...filters, rating: 'All', sort: 'Default', year: '', genres: [] })}>
                Clear filters
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {sheetOpen ? (
        <FilterSheet
          initial={filters}
          genres={genres}
          onClose={() => setSheetOpen(false)}
          onApply={(next) => {
            setSheetOpen(false)
            apply(next)
          }}
        />
      ) : null}
    </div>
  )
}
