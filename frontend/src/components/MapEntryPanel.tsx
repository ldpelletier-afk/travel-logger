import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { X, MapPin, Calendar, ImageOff } from 'lucide-react'
import { getEntry } from '../api/client'
import type { Category, Entry } from '../api/types'
import { formatDate } from '../lib/format'
import { midsizeUrl } from '../lib/photos'
import { displayLocation } from '../lib/location'
import CategoryBadge from './CategoryBadge'

interface Props {
  entryId: number
  categoriesById: Map<number, Category>
  stateAbbrByFips: Map<string, string>
  onClose: () => void
}

export default function MapEntryPanel({ entryId, categoriesById, stateAbbrByFips, onClose }: Props) {
  const [entry, setEntry] = useState<Entry | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activePhoto, setActivePhoto] = useState(0)

  useEffect(() => {
    let cancelled = false
    setEntry(null)
    setError(null)
    setActivePhoto(0)
    getEntry(entryId)
      .then((e) => !cancelled && setEntry(e))
      .catch((e) => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [entryId])

  const category = entry ? categoriesById.get(entry.category_id) : undefined
  const location = entry
    ? displayLocation(entry, entry.state_fips ? stateAbbrByFips.get(entry.state_fips) : undefined)
    : ''
  const shown = entry?.photos[activePhoto]

  return (
    <div className="map-entry-panel">
      <button type="button" className="map-entry-panel-close" onClick={onClose} aria-label="Close">
        <X size={16} />
      </button>

      {error && <div className="empty-state error">Couldn't load this entry: {error}</div>}

      {!error && !entry && <div className="map-entry-panel-loading">Loading…</div>}

      {entry && (
        <>
          <div className="map-entry-panel-media">
            {shown ? (
              <img src={midsizeUrl(shown.midsize_path)} alt={shown.caption || entry.name} />
            ) : (
              <div className="map-entry-panel-media-placeholder">
                <ImageOff size={22} />
              </div>
            )}
          </div>

          {entry.photos.length > 1 && (
            <div className="map-entry-panel-strip">
              {entry.photos.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  className={i === activePhoto ? 'active' : ''}
                  onClick={() => setActivePhoto(i)}
                >
                  <img src={midsizeUrl(p.thumb_path)} alt="" />
                </button>
              ))}
            </div>
          )}

          <div className="map-entry-panel-body">
            <div className="map-entry-panel-name">{entry.name}</div>
            {category && <CategoryBadge category={category} />}

            <div className="map-entry-panel-meta">
              {location && (
                <div className="map-entry-panel-meta-row">
                  <MapPin size={14} />
                  {location}
                </div>
              )}
              <div className="map-entry-panel-meta-row">
                <Calendar size={14} />
                {formatDate(entry.visit_date)}
              </div>
            </div>

            {entry.notes && <div className="map-entry-panel-notes">{entry.notes}</div>}

            <Link to={`/entries/${entry.id}`} className="map-entry-panel-link">
              View full entry →
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
