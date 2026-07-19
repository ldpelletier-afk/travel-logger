import type {
  Category,
  Country,
  CountyCollection,
  CountyStats,
  Entry,
  EntryFilters,
  EntryInput,
  GeocodeResult,
  ImportSummary,
  ParkPreset,
  Photo,
  StateCollection,
  Stats,
  VisitedCounty,
} from './types'

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: init?.body && !(init.body instanceof FormData)
      ? { 'Content-Type': 'application/json' }
      : undefined,
    ...init,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail ?? `${res.status} ${res.statusText}`)
  }
  if (res.status === 204) return undefined as T
  return res.json()
}

export function listCategories(): Promise<Category[]> {
  return request('/api/categories')
}

export function createCategory(body: { name: string; color: string; icon: string }): Promise<Category> {
  return request('/api/categories', { method: 'POST', body: JSON.stringify(body) })
}

export function listEntries(filters: EntryFilters): Promise<Entry[]> {
  const params = new URLSearchParams()
  if (filters.category_id) {
    for (const id of filters.category_id) params.append('category_id', String(id))
  }
  if (filters.state_fips) params.set('state_fips', filters.state_fips)
  if (filters.status) params.set('status', filters.status)
  if (filters.date_from) params.set('date_from', filters.date_from)
  if (filters.date_to) params.set('date_to', filters.date_to)
  if (filters.q) params.set('q', filters.q)
  if (filters.sort) params.set('sort', filters.sort)
  if (filters.order) params.set('order', filters.order)
  const qs = params.toString()
  return request(`/api/entries${qs ? `?${qs}` : ''}`)
}

export function getEntry(id: number): Promise<Entry> {
  return request(`/api/entries/${id}`)
}

export function createEntry(body: EntryInput): Promise<Entry> {
  return request('/api/entries', { method: 'POST', body: JSON.stringify(body) })
}

export function updateEntry(id: number, body: Partial<EntryInput> & { cover_photo_id?: number | null }): Promise<Entry> {
  return request(`/api/entries/${id}`, { method: 'PATCH', body: JSON.stringify(body) })
}

export function deleteEntry(id: number): Promise<void> {
  return request(`/api/entries/${id}`, { method: 'DELETE' })
}

export function uploadPhoto(entryId: number, file: File): Promise<Photo> {
  const form = new FormData()
  form.append('file', file)
  return request(`/api/entries/${entryId}/photos`, { method: 'POST', body: form })
}

export function updatePhotoCaption(photoId: number, caption: string): Promise<Photo> {
  return request(`/api/photos/${photoId}`, { method: 'PATCH', body: JSON.stringify({ caption }) })
}

export function deletePhoto(photoId: number): Promise<void> {
  return request(`/api/photos/${photoId}`, { method: 'DELETE' })
}

export function getStats(): Promise<Stats> {
  return request('/api/stats')
}

export function getStates(): Promise<StateCollection> {
  return request('/geo/states-20m.geojson')
}

export function getCounties(): Promise<CountyCollection> {
  return request('/geo/counties-20m.geojson')
}

export function getCaProvinces(): Promise<StateCollection> {
  return request('/geo/ca-provinces-20m.geojson')
}

export function getCaCensusDivisions(): Promise<CountyCollection> {
  return request('/geo/ca-census-divisions-20m.geojson')
}

export function getVisitedCounties(): Promise<VisitedCounty[]> {
  return request('/api/counties/visited')
}

export function getCountyStats(): Promise<CountyStats> {
  return request('/api/counties/stats')
}

export function markCountyManual(
  country: Country,
  fips: string,
): Promise<{ county_fips: string; already_marked: boolean }> {
  return request(`/api/counties/${country}/${fips}/manual`, { method: 'POST' })
}

export function unmarkCountyManual(country: Country, fips: string): Promise<void> {
  return request(`/api/counties/${country}/${fips}/manual`, { method: 'DELETE' })
}

export async function downloadExport(): Promise<void> {
  const res = await fetch('/api/data/export')
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  const blob = await res.blob()
  const disposition = res.headers.get('Content-Disposition') ?? ''
  const match = disposition.match(/filename="([^"]+)"/)
  const filename = match?.[1] ?? 'travel-logger-export.json'

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function importData(file: File): Promise<ImportSummary> {
  const form = new FormData()
  form.append('file', file)
  return request('/api/data/import', { method: 'POST', body: form })
}

interface NominatimResult {
  display_name: string
  lat: string
  lon: string
}

// Geocodes via OpenStreetMap's free Nominatim service — no API key, but a
// real network call to a third party. Only fires when the user clicks
// "Find", never automatically, matching the app's OSM-tiles precedent.
export async function geocodeAddress(query: string): Promise<GeocodeResult[]> {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '4')

  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Geocoding failed: ${res.status} ${res.statusText}`)
  const results: NominatimResult[] = await res.json()
  return results.map((r) => ({
    displayName: r.display_name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
  }))
}

export function getNationalParks(): Promise<ParkPreset[]> {
  return request('/api/presets/national-parks')
}

// First call for a given state can take 20-30s (a live Overpass query
// against OpenStreetMap); the backend caches the result after that.
export function getStateParks(stateFips: string): Promise<ParkPreset[]> {
  return request(`/api/presets/state-parks?state_fips=${stateFips}`)
}
