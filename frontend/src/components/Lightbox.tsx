import { useEffect } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Photo } from '../api/types'
import { midsizeUrl } from '../lib/photos'

interface Props {
  photos: Photo[]
  index: number
  onIndexChange: (i: number) => void
  onClose: () => void
}

export default function Lightbox({ photos, index, onIndexChange, onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') onIndexChange((index - 1 + photos.length) % photos.length)
      if (e.key === 'ArrowRight') onIndexChange((index + 1) % photos.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, photos.length, onIndexChange, onClose])

  const photo = photos[index]
  if (!photo) return null

  return (
    <div className="lightbox-backdrop" onClick={onClose}>
      <button type="button" className="lightbox-close" onClick={onClose} aria-label="Close">
        <X size={20} />
      </button>

      {photos.length > 1 && (
        <button
          type="button"
          className="lightbox-nav lightbox-prev"
          onClick={(e) => {
            e.stopPropagation()
            onIndexChange((index - 1 + photos.length) % photos.length)
          }}
          aria-label="Previous photo"
        >
          <ChevronLeft size={26} />
        </button>
      )}

      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <img src={midsizeUrl(photo.midsize_path)} alt={photo.caption || ''} />
        {photo.caption && <div className="lightbox-caption">{photo.caption}</div>}
      </div>

      {photos.length > 1 && (
        <button
          type="button"
          className="lightbox-nav lightbox-next"
          onClick={(e) => {
            e.stopPropagation()
            onIndexChange((index + 1) % photos.length)
          }}
          aria-label="Next photo"
        >
          <ChevronRight size={26} />
        </button>
      )}
    </div>
  )
}
