import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, MapPin, Calendar, ImageOff, Pencil } from 'lucide-react'
import { getEntry, listCategories, getStates } from '../api/client'
import type { Category, Entry, StateFeature } from '../api/types'
import { formatDate } from '../lib/format'
import { midsizeUrl } from '../lib/photos'
import { displayLocation } from '../lib/location'
import CategoryBadge from '../components/CategoryBadge'
import Lightbox from '../components/Lightbox'

export default function EntryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [entry, setEntry] = useState<Entry | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [states, setStates] = useState<StateFeature[]>([])
  const [error, setError] = useState<string | null>(null)
  const [activePhoto, setActivePhoto] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  useEffect(() => {
    if (!id) return
    setEntry(null)
    setActivePhoto(0)
    setLightboxOpen(false)
    getEntry(Number(id)).catch((e) => setError(String(e))).then((e) => e && setEntry(e))
    listCategories().then(setCategories).catch(() => {})
    getStates().then((fc) => setStates(fc.features)).catch(() => {})
  }, [id])

  if (error) return <div className="empty-state error">Couldn't load this entry: {error}</div>
  if (!entry) return <div className="empty-state">Loading…</div>

  const category = categories.find((c) => c.id === entry.category_id)
  const state = states.find((s) => s.properties.STATEFP === entry.state_fips)
  const location = displayLocation(entry, state?.properties.STUSPS)
  const gallery = entry.photos
  const shown = gallery[activePhoto]

  return (
    <div className="detail-page">
      <div className="detail-page-header">
        <Link to="/" className="back-link">
          <ArrowLeft size={15} /> Catalog
        </Link>
        <Link to={`/entries/${entry.id}/edit`} className="btn-secondary">
          <Pencil size={13} /> Edit
        </Link>
      </div>

      <div className="detail-layout">
        <div className="detail-gallery">
          {shown ? (
            <>
              <button type="button" className="detail-gallery-main" onClick={() => setLightboxOpen(true)}>
                <img src={midsizeUrl(shown.midsize_path)} alt={shown.caption || entry.name} />
              </button>
              {shown.caption && <div className="detail-gallery-caption">{shown.caption}</div>}
              {gallery.length > 1 && (
                <div className="detail-gallery-strip">
                  {gallery.map((p, i) => (
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
            </>
          ) : (
            <div className="detail-gallery-empty">
              <ImageOff size={28} />
              <span>No photos yet</span>
            </div>
          )}
        </div>

        <div className="detail-info">
          <h1>{entry.name}</h1>
          {category && <CategoryBadge category={category} />}

          <div className="detail-meta">
            {location && (
              <div className="detail-meta-row">
                <MapPin size={15} />
                {location}
              </div>
            )}
            <div className="detail-meta-row">
              <Calendar size={15} />
              {formatDate(entry.visit_date)}
            </div>
          </div>

          {entry.notes && <div className="detail-notes">{entry.notes}</div>}
        </div>
      </div>

      {lightboxOpen && (
        <Lightbox
          photos={gallery}
          index={activePhoto}
          onIndexChange={setActivePhoto}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  )
}
