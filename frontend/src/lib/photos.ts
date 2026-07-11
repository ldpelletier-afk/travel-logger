import type { Entry } from '../api/types'

export function coverThumbUrl(entry: Entry): string | null {
  const cover = entry.photos.find((p) => p.id === entry.cover_photo_id) ?? entry.photos[0]
  return cover ? `/photos/${cover.thumb_path}` : null
}

export function midsizeUrl(path: string): string {
  return `/photos/${path}`
}
