import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { listCategories, listEntries, getStates } from '../api/client'
import type { Category, Entry, EntryFilters, StateFeature } from '../api/types'
import FilterBar from '../components/FilterBar'
import EntryCard from '../components/EntryCard'
import EntryListRow from '../components/EntryListRow'

export default function CatalogPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [states, setStates] = useState<StateFeature[]>([])
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<EntryFilters>({ sort: 'created_at', order: 'desc' })
  const [view, setView] = useState<'grid' | 'list'>('grid')

  useEffect(() => {
    listCategories().then(setCategories).catch((e) => setError(String(e)))
    getStates().then((fc) => setStates(fc.features)).catch((e) => setError(String(e)))
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    listEntries(filters)
      .then((data) => {
        if (!cancelled) setEntries(data)
      })
      .catch((e) => !cancelled && setError(String(e)))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [filters])

  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const stateAbbrByFips = useMemo(
    () => new Map(states.map((s) => [s.properties.STATEFP, s.properties.STUSPS])),
    [states],
  )

  if (error) {
    return <div className="empty-state error">Couldn't load the catalog: {error}</div>
  }

  return (
    <div className="catalog-page">
      <div className="catalog-page-header">
        <Link to="/entries/new" className="btn-primary">
          <Plus size={15} /> New entry
        </Link>
      </div>

      <FilterBar
        categories={categories}
        states={states}
        filters={filters}
        onChange={setFilters}
        view={view}
        onViewChange={setView}
        resultCount={entries.length}
      />

      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="empty-state">
          No entries match these filters.
        </div>
      ) : view === 'grid' ? (
        <div className="entry-grid">
          {entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              category={categoryById.get(entry.category_id)}
              stateAbbr={entry.state_fips ? stateAbbrByFips.get(entry.state_fips) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="entry-list">
          <div className="entry-list-header">
            <div />
            <div>Name</div>
            <div>Category</div>
            <div>Location</div>
            <div>Visited</div>
          </div>
          {entries.map((entry) => (
            <EntryListRow
              key={entry.id}
              entry={entry}
              category={categoryById.get(entry.category_id)}
              stateAbbr={entry.state_fips ? stateAbbrByFips.get(entry.state_fips) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  )
}
