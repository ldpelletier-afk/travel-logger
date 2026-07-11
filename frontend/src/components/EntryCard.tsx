import { Link } from 'react-router-dom'
import { ImageOff } from 'lucide-react'
import type { Category, Entry } from '../api/types'
import { coverThumbUrl } from '../lib/photos'
import { formatDate } from '../lib/format'
import { displayLocation } from '../lib/location'
import CategoryBadge from './CategoryBadge'

interface Props {
  entry: Entry
  category: Category | undefined
  stateAbbr: string | undefined
}

export default function EntryCard({ entry, category, stateAbbr }: Props) {
  const thumb = coverThumbUrl(entry)
  const location = displayLocation(entry, stateAbbr)

  return (
    <Link to={`/entries/${entry.id}`} className="entry-card">
      <div className="entry-card-media">
        {thumb ? (
          <img src={thumb} alt="" loading="lazy" />
        ) : (
          <div className="entry-card-media-placeholder">
            <ImageOff size={22} />
          </div>
        )}
        {category && (
          <div className="entry-card-badge">
            <CategoryBadge category={category} />
          </div>
        )}
      </div>
      <div className="entry-card-body">
        <div className="entry-card-name">{entry.name}</div>
        <div className="entry-card-meta">
          {location && <span>{location}</span>}
          <span>{formatDate(entry.visit_date)}</span>
        </div>
      </div>
    </Link>
  )
}
