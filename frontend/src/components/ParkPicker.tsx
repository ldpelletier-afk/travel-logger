import { useState } from 'react'
import { Search, MapPin } from 'lucide-react'
import type { ParkPreset } from '../api/types'

interface Props {
  parks: ParkPreset[]
  onSelect: (park: ParkPreset) => void
  placeholder?: string
}

export default function ParkPicker({ parks, onSelect, placeholder }: Props) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const filtered = (q ? parks.filter((p) => p.name.toLowerCase().includes(q)) : parks).slice(0, 50)

  return (
    <div className="park-picker">
      <div className="park-picker-search">
        <Search size={13} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder ?? 'Search parks…'}
        />
      </div>
      <div className="park-picker-list">
        {filtered.length === 0 && <div className="park-picker-empty">No matches.</div>}
        {filtered.map((p, i) => (
          <button key={i} type="button" className="park-picker-item" onClick={() => onSelect(p)}>
            <MapPin size={12} />
            <span>
              {p.name}
              {p.state ? `, ${p.state}` : ''}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
