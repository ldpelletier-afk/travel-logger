export interface Category {
  id: number
  name: string
  color: string
  icon: string
  is_seed: boolean
  entry_count: number
}

export interface Photo {
  id: number
  entry_id: number
  thumb_path: string
  midsize_path: string
  caption: string
  exif_taken_at: string | null
  exif_lat: number | null
  exif_lng: number | null
  uploaded_at: string
}

export type EntryStatus = 'visited' | 'candidate'

export interface Entry {
  id: number
  name: string
  category_id: number
  latitude: number
  longitude: number
  address: string
  country: string | null
  state_fips: string | null
  county_fips: string | null
  county_name: string | null
  status: EntryStatus
  visit_date: string | null
  notes: string
  cover_photo_id: number | null
  osm_id: string | null
  created_at: string
  updated_at: string
  photos: Photo[]
}

export interface EntryFilters {
  category_id?: number[]
  state_fips?: string
  status?: EntryStatus
  date_from?: string
  date_to?: string
  q?: string
  sort?: 'name' | 'visit_date' | 'created_at'
  order?: 'asc' | 'desc'
}

export type Geometry =
  | { type: 'Polygon'; coordinates: [number, number][][] }
  | { type: 'MultiPolygon'; coordinates: [number, number][][][] }

export interface StateFeature {
  type: 'Feature'
  properties: { GEOID: string; NAME: string; STUSPS: string; STATEFP: string }
  geometry: Geometry
}

export interface StateCollection {
  type: 'FeatureCollection'
  features: StateFeature[]
}

export interface CountyFeature {
  type: 'Feature'
  properties: { GEOID: string; NAME: string; STATEFP: string }
  geometry: Geometry
}

export interface CountyCollection {
  type: 'FeatureCollection'
  features: CountyFeature[]
}

export type Country = 'US' | 'CA'

export interface CountryCountyStats {
  country: Country
  visited: number
  total: number
  percent: number
}

export interface CountyStats {
  by_country: CountryCountyStats[]
}

export interface VisitedCounty {
  country: Country
  county_fips: string
  sources: ('entry' | 'manual')[]
}

export interface CategoryCount {
  category_id: number
  name: string
  color: string
  icon: string
  count: number
}

export interface StateVisitStats {
  country: Country
  state_fips: string
  name: string
  abbr: string
  visited: number
  total: number
  percent: number
}

export interface Stats {
  total_entries: number
  total_photos: number
  by_category: CategoryCount[]
  first_visit_date: string | null
  last_visit_date: string | null
  by_state: StateVisitStats[]
}

export interface EntryInput {
  name: string
  category_id: number
  latitude: number
  longitude: number
  address?: string
  status?: EntryStatus
  visit_date: string | null
  notes: string
}

export interface GeocodeResult {
  displayName: string
  lat: number
  lng: number
}

export interface ParkPreset {
  name: string
  state: string | null
  lat: number
  lng: number
}

export interface ImportSummary {
  categories: number
  entries: number
  photos: number
  manual_counties: number
  missing_photo_files: string[]
}
