import type { CSSProperties } from 'react'
import { Search, Grid3x3, List, X } from 'lucide-react'
import type { Category, EntryFilters, StateFeature } from '../api/types'
import { iconFor } from './icons'

interface Props {
  categories: Category[]
  states: StateFeature[]
  filters: EntryFilters
  onChange: (next: EntryFilters) => void
  view: 'grid' | 'list'
  onViewChange: (v: 'grid' | 'list') => void
  resultCount: number
}

export default function FilterBar({
  categories,
  states,
  filters,
  onChange,
  view,
  onViewChange,
  resultCount,
}: Props) {
  const selectedCategories = new Set(filters.category_id ?? [])

  function toggleCategory(id: number) {
    const next = new Set(selectedCategories)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange({ ...filters, category_id: next.size ? [...next] : undefined })
  }

  function clearAll() {
    onChange({ sort: filters.sort, order: filters.order })
  }

  const hasFilters =
    !!filters.category_id?.length || !!filters.state_fips || !!filters.date_from ||
    !!filters.date_to || !!filters.q

  const sortedStates = [...states].sort((a, b) => a.properties.NAME.localeCompare(b.properties.NAME))

  return (
    <div className="filter-bar">
      <div className="filter-row">
        <div className="search-input">
          <Search size={15} />
          <input
            type="search"
            placeholder="Search entries and notes…"
            value={filters.q ?? ''}
            onChange={(e) => onChange({ ...filters, q: e.target.value || undefined })}
          />
        </div>

        <select
          value={filters.state_fips ?? ''}
          onChange={(e) => onChange({ ...filters, state_fips: e.target.value || undefined })}
        >
          <option value="">All states</option>
          {sortedStates.map((s) => (
            <option key={s.properties.GEOID} value={s.properties.STATEFP}>
              {s.properties.NAME}
            </option>
          ))}
        </select>

        <input
          type="date"
          value={filters.date_from ?? ''}
          onChange={(e) => onChange({ ...filters, date_from: e.target.value || undefined })}
          aria-label="Visited from"
        />
        <span className="date-sep">–</span>
        <input
          type="date"
          value={filters.date_to ?? ''}
          onChange={(e) => onChange({ ...filters, date_to: e.target.value || undefined })}
          aria-label="Visited to"
        />

        <select
          value={`${filters.sort ?? 'created_at'}:${filters.order ?? 'desc'}`}
          onChange={(e) => {
            const [sort, order] = e.target.value.split(':') as [EntryFilters['sort'], EntryFilters['order']]
            onChange({ ...filters, sort, order })
          }}
        >
          <option value="created_at:desc">Newest logged</option>
          <option value="created_at:asc">Oldest logged</option>
          <option value="visit_date:desc">Visit date ↓</option>
          <option value="visit_date:asc">Visit date ↑</option>
          <option value="name:asc">Name A–Z</option>
          <option value="name:desc">Name Z–A</option>
        </select>

        <div className="view-toggle" role="group" aria-label="View mode">
          <button
            type="button"
            className={view === 'grid' ? 'active' : ''}
            onClick={() => onViewChange('grid')}
            aria-label="Grid view"
            aria-pressed={view === 'grid'}
          >
            <Grid3x3 size={15} />
          </button>
          <button
            type="button"
            className={view === 'list' ? 'active' : ''}
            onClick={() => onViewChange('list')}
            aria-label="List view"
            aria-pressed={view === 'list'}
          >
            <List size={15} />
          </button>
        </div>
      </div>

      <div className="filter-row chips-row">
        {categories.map((cat) => {
          const Icon = iconFor(cat.icon)
          const active = selectedCategories.has(cat.id)
          return (
            <button
              key={cat.id}
              type="button"
              className={`chip${active ? ' chip-active' : ''}`}
              style={{ '--chip-color': cat.color } as CSSProperties}
              onClick={() => toggleCategory(cat.id)}
              aria-pressed={active}
            >
              <Icon size={12} strokeWidth={2.25} />
              {cat.name}
              <span className="chip-count">{cat.entry_count}</span>
            </button>
          )
        })}

        <div className="filter-summary">
          {hasFilters && (
            <button type="button" className="clear-filters" onClick={clearAll}>
              <X size={13} /> Clear filters
            </button>
          )}
          <span className="result-count">
            {resultCount} {resultCount === 1 ? 'entry' : 'entries'}
          </span>
        </div>
      </div>
    </div>
  )
}
