import { useEffect, useRef, useState } from 'react'
import { Download, Upload, RefreshCw } from 'lucide-react'
import { downloadExport, getStats, importData } from '../api/client'
import type { ImportSummary, Stats } from '../api/types'
import type { StateVisitStats } from '../api/types'
import { iconFor } from '../components/icons'
import { formatDate } from '../lib/format'

function RegionTable({ rows, regionLabel }: { rows: StateVisitStats[]; regionLabel: string }) {
  if (rows.length === 0) return <div className="empty-state">No data.</div>
  return (
    <div className="stats-state-table">
      <div className="stats-state-header">
        <div>{regionLabel}</div>
        <div>Visited</div>
        <div>%</div>
      </div>
      {rows.map((s) => (
        <div key={`${s.country}${s.state_fips}`} className="stats-state-row">
          <div>{s.name}</div>
          <div className="stats-state-count">
            {s.visited} / {s.total}
          </div>
          <div className="stats-state-percent-cell">
            <div className="stats-state-percent-track">
              <div className="stats-state-percent-fill" style={{ width: `${s.percent}%` }} />
            </div>
            <span>{s.percent}%</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function DataSection() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)

  async function handleExport() {
    setError(null)
    try {
      await downloadExport()
    } catch (e) {
      setError(String(e))
    }
  }

  async function handleFileChosen(file: File) {
    const ok = window.confirm(
      'Importing will replace all categories, entries, and photo records with the contents ' +
        'of this file. This cannot be undone. Continue?',
    )
    if (!ok) return

    setBusy(true)
    setError(null)
    setSummary(null)
    try {
      const result = await importData(file)
      setSummary(result)
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="stats-section data-section">
      <h2>Data</h2>
      <p className="data-section-hint">
        Export a full backup of your categories, entries, and photo records as JSON. Photo files
        themselves stay on disk under <code>data/photos/</code> — back that folder up separately.
      </p>

      <div className="data-section-actions">
        <button type="button" className="btn-secondary" onClick={handleExport}>
          <Download size={14} /> Export data
        </button>
        <button type="button" className="btn-secondary" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <RefreshCw size={14} className="spin" /> : <Upload size={14} />}
          Import from file…
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFileChosen(file)
            e.target.value = ''
          }}
        />
      </div>

      {error && <div className="form-error">{error}</div>}

      {summary && (
        <div className="data-section-summary">
          Imported {summary.entries} entries, {summary.categories} categories,{' '}
          {summary.photos} photo records, and {summary.manual_counties} manually-marked counties.
          {summary.missing_photo_files.length > 0 && (
            <div className="data-section-warning">
              {summary.missing_photo_files.length} referenced photo file(s) weren't found under
              data/photos/ — restore that folder alongside this import to see those images.
            </div>
          )}
          <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
            Reload app
          </button>
        </div>
      )}
    </section>
  )
}

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getStats().then(setStats).catch((e) => setError(String(e)))
  }, [])

  if (error) return <div className="empty-state error">Couldn't load stats: {error}</div>
  if (!stats) return <div className="empty-state">Loading…</div>

  const maxCategoryCount = Math.max(1, ...stats.by_category.map((c) => c.count))
  const sortByPct = (rows: typeof stats.by_state) =>
    [...rows].sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name))
  const usStates = sortByPct(stats.by_state.filter((s) => s.country === 'US'))
  const caProvinces = sortByPct(stats.by_state.filter((s) => s.country === 'CA'))

  return (
    <div className="stats-page">
      <div className="stats-summary-row">
        <div className="stats-summary-tile">
          <div className="stats-summary-value">{stats.total_entries.toLocaleString()}</div>
          <div className="stats-summary-label">Entries logged</div>
        </div>
        <div className="stats-summary-tile">
          <div className="stats-summary-value">{stats.total_photos.toLocaleString()}</div>
          <div className="stats-summary-label">Photos</div>
        </div>
        <div className="stats-summary-tile">
          <div className="stats-summary-value">{formatDate(stats.first_visit_date)}</div>
          <div className="stats-summary-label">First visit</div>
        </div>
        <div className="stats-summary-tile">
          <div className="stats-summary-value">{formatDate(stats.last_visit_date)}</div>
          <div className="stats-summary-label">Most recent visit</div>
        </div>
      </div>

      <div className="stats-columns">
        <section className="stats-section">
          <h2>By category</h2>
          <div className="stats-bar-list">
            {stats.by_category.map((c) => {
              const Icon = iconFor(c.icon)
              return (
                <div key={c.category_id} className="stats-bar-row">
                  <div className="stats-bar-label">
                    <Icon size={13} style={{ color: c.color }} />
                    {c.name}
                  </div>
                  <div className="stats-bar-track">
                    <div
                      className="stats-bar-fill"
                      style={{ width: `${(c.count / maxCategoryCount) * 100}%`, background: c.color }}
                    />
                  </div>
                  <div className="stats-bar-count">{c.count}</div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="stats-section">
          <h2>Counties by state (US)</h2>
          <RegionTable rows={usStates} regionLabel="State" />
        </section>

        <section className="stats-section">
          <h2>Census divisions by province (Canada)</h2>
          <RegionTable rows={caProvinces} regionLabel="Province" />
        </section>
      </div>

      <DataSection />
    </div>
  )
}
