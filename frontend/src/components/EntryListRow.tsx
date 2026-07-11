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

export default function EntryListRow({ entry, category, stateAbbr }: Props) {
  const thumb = coverThumbUrl(entry)
  const location = displayLocation(entry, stateAbbr)

  return (
    <Link to={`/entries/${entry.id}`} className="entry-row">
      <div className="entry-row-media">
        {thumb ? <img src={thumb} alt="" loading="lazy" /> : <ImageOff size={16} />}
      </div>
      <div className="entry-row-name">{entry.name}</div>
      <div className="entry-row-cat">{category && <CategoryBadge category={category} />}</div>
      <div className="entry-row-loc">{location || '—'}</div>
      <div className="entry-row-date">{formatDate(entry.visit_date)}</div>
    </Link>
  )
}
