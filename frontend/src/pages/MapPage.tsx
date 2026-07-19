import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { ArrowLeft, X, ZoomIn } from 'lucide-react'
import {
  getCaCensusDivisions,
  getCaProvinces,
  getCounties,
  getStates,
  getVisitedCounties,
  listCategories,
  listEntries,
  markCountyManual,
  unmarkCountyManual,
} from '../api/client'
import type { Category, Country, CountyCollection, Entry, StateCollection } from '../api/types'
import { bboxOfGeometry, type Bbox } from '../lib/geo'
import { iconFor } from '../components/icons'
import MapEntryPanel from '../components/MapEntryPanel'
import { formatDate } from '../lib/format'

// Continental view covering the contiguous US plus southern/central Canada.
// (Far-north territories and AK/HI still render; this just frames the default.)
const NA_BOUNDS: Bbox = [-127, 24, -60, 60]

const SUBDIVISION_UNIT: Record<Country, string> = { US: 'counties', CA: 'census divisions' }

const PALETTE = {
  light: {
    background: '#eef0ea',
    land: '#eeece6',
    countyBorder: '#c9c4b8',
    stateBorder: '#6b665c',
    visited: '#35507a',
    hover: '#211f1c',
    cluster: '#6b665c',
  },
  dark: {
    background: '#12181f',
    land: '#232019',
    countyBorder: '#3a3833',
    stateBorder: '#a29c8f',
    visited: '#6f93c2',
    hover: '#ece9e2',
    cluster: '#a29c8f',
  },
}

interface PointGeometry {
  type: 'Point'
  coordinates: [number, number]
}

interface EntryFeature {
  type: 'Feature'
  geometry: PointGeometry
  properties: {
    id: number
    name: string
    category_id: number
    categoryColor: string
    categoryName: string
    visit_date: string | null
  }
}

interface EntryFeatureCollection {
  type: 'FeatureCollection'
  features: EntryFeature[]
}

function entryToFeature(entry: Entry, categoriesById: Map<number, Category>): EntryFeature {
  const cat = categoriesById.get(entry.category_id)
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [entry.longitude, entry.latitude] },
    properties: {
      id: entry.id,
      name: entry.name,
      category_id: entry.category_id,
      categoryColor: cat?.color ?? '#6b665c',
      categoryName: cat?.name ?? 'other',
      visit_date: entry.visit_date,
    },
  }
}

interface StateIndexEntry {
  country: Country
  name: string
  abbr: string
  bbox: Bbox
  total: number
  geoids: string[]
}

interface MapData {
  states: StateCollection
  counties: CountyCollection
  stateIndex: Map<string, StateIndexEntry>
  stateAbbrByFips: Map<string, string>
  visited: Set<string>
  entrySet: Set<string>
  manualSet: Set<string>
  categories: Category[]
  categoriesById: Map<number, Category>
  entryFeatures: EntryFeature[]
}

interface CountryScope {
  country: Country
  visited: number
  total: number
}

interface ScopeStats {
  label: string
  countries: CountryScope[]
}

// Prefix a raw subdivision/region code with its country so US and CA codes
// (which overlap — US "24" = Maryland, CA "24" = Quebec) can share one map.
const key = (country: Country, code: string) => `${country}${code}`

interface Tooltip {
  x: number
  y: number
  lines: string[]
}

interface ClusterPopupEntry {
  id: number
  name: string
  categoryName: string
  categoryColor: string
  visit_date: string | null
}

interface ClusterPopup {
  x: number
  y: number
  lng: number
  lat: number
  clusterId: number
  entries: ClusterPopupEntry[]
}

function isDarkMode(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

// Rewrite each feature's GEOID/STATEFP to a country-prefixed, globally-unique
// code, keeping the raw code + country around for API calls that need them.
function tagFeatures<T extends StateCollection | CountyCollection>(fc: T, country: Country): T {
  for (const f of fc.features) {
    const p = f.properties as Record<string, string>
    p.COUNTRY = country
    p.RAWID = p.GEOID
    p.RAWSTATEFP = p.STATEFP
    p.GEOID = key(country, p.GEOID)
    p.STATEFP = key(country, p.STATEFP)
  }
  return fc
}

function mergeCollections<T extends { features: unknown[] }>(a: T, b: T): T {
  return { ...a, features: [...a.features, ...b.features] }
}

async function loadMapData(): Promise<MapData> {
  const [usStates, usCounties, caProvinces, caCds, visitedRows, categories, entries] =
    await Promise.all([
      getStates(),
      getCounties(),
      getCaProvinces(),
      getCaCensusDivisions(),
      getVisitedCounties(),
      listCategories(),
      listEntries({}),
    ])

  const states = mergeCollections(tagFeatures(usStates, 'US'), tagFeatures(caProvinces, 'CA'))
  const counties = mergeCollections(tagFeatures(usCounties, 'US'), tagFeatures(caCds, 'CA'))

  const visited = new Set<string>()
  const entrySet = new Set<string>()
  const manualSet = new Set<string>()
  for (const row of visitedRows) {
    const k = key(row.country, row.county_fips)
    visited.add(k)
    if (row.sources.includes('entry')) entrySet.add(k)
    if (row.sources.includes('manual')) manualSet.add(k)
  }

  const stateIndex = new Map<string, StateIndexEntry>()
  const stateAbbrByFips = new Map<string, string>()
  for (const f of states.features) {
    const p = f.properties as Record<string, string>
    stateIndex.set(p.STATEFP, {
      country: p.COUNTRY as Country,
      name: p.NAME,
      abbr: p.STUSPS,
      bbox: bboxOfGeometry(f.geometry),
      total: 0,
      geoids: [],
    })
    stateAbbrByFips.set(p.STATEFP, p.STUSPS)
  }
  for (const f of counties.features) {
    const p = f.properties as Record<string, string>
    const entry = stateIndex.get(p.STATEFP)
    if (entry) {
      entry.total += 1
      entry.geoids.push(p.GEOID)
    }
  }

  const categoriesById = new Map(categories.map((c) => [c.id, c]))
  const entryFeatures = entries.map((e) => entryToFeature(e, categoriesById))

  return {
    states,
    counties,
    stateIndex,
    stateAbbrByFips,
    visited,
    entrySet,
    manualSet,
    categories,
    categoriesById,
    entryFeatures,
  }
}

function filteredEntryCollection(
  features: EntryFeature[],
  selectedCategoryIds: Set<number>,
): EntryFeatureCollection {
  const filtered =
    selectedCategoryIds.size === 0
      ? features
      : features.filter((f) => selectedCategoryIds.has(f.properties.category_id))
  return { type: 'FeatureCollection', features: filtered }
}

export default function MapPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const dataRef = useRef<MapData | null>(null)
  const selectedStateRef = useRef<string | null>(null)

  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedState, setSelectedState] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<Tooltip | null>(null)
  const [showBasemap, setShowBasemap] = useState(false)
  const [stats, setStats] = useState<ScopeStats | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<number>>(new Set())
  const [panelEntryId, setPanelEntryId] = useState<number | null>(null)
  const selectedCategoryIdsRef = useRef(selectedCategoryIds)
  const [clusterPopup, setClusterPopup] = useState<ClusterPopup | null>(null)
  // Mirror for map event handlers, which are registered once and would
  // otherwise close over the initial state value.
  const clusterPopupRef = useRef<ClusterPopup | null>(null)

  function updateClusterPopup(next: ClusterPopup | null) {
    clusterPopupRef.current = next
    setClusterPopup(next)
  }

  function computeStats(fips: string | null): ScopeStats {
    const d = dataRef.current!
    if (fips) {
      const s = d.stateIndex.get(fips)!
      const visitedInState = s.geoids.filter((g) => d.visited.has(g)).length
      return {
        label: s.name,
        countries: [{ country: s.country, visited: visitedInState, total: s.total }],
      }
    }
    // Continental view: totals per country.
    const totals: Record<Country, CountryScope> = {
      US: { country: 'US', visited: 0, total: 0 },
      CA: { country: 'CA', visited: 0, total: 0 },
    }
    for (const s of d.stateIndex.values()) {
      totals[s.country].total += s.total
      totals[s.country].visited += s.geoids.filter((g) => d.visited.has(g)).length
    }
    return { label: 'North America', countries: [totals.US, totals.CA] }
  }

  function repaintCounties() {
    const map = mapRef.current
    const d = dataRef.current
    if (!map || !d) return
    map.setPaintProperty('counties-fill', 'fill-color', [
      'case',
      ['in', ['get', 'GEOID'], ['literal', [...d.visited]]],
      PALETTE[isDarkMode() ? 'dark' : 'light'].visited,
      'transparent',
    ])
  }

  async function toggleCountyManual(fips: string) {
    const d = dataRef.current
    if (!d || d.entrySet.has(fips)) return
    const wasManual = d.manualSet.has(fips)
    // fips is the country-prefixed key, e.g. "US36061" / "CA2466".
    const country = fips.slice(0, 2) as Country
    const rawFips = fips.slice(2)

    if (wasManual) {
      d.manualSet.delete(fips)
      d.visited.delete(fips)
    } else {
      d.manualSet.add(fips)
      d.visited.add(fips)
    }
    repaintCounties()
    setStats(computeStats(selectedStateRef.current))

    try {
      if (wasManual) await unmarkCountyManual(country, rawFips)
      else await markCountyManual(country, rawFips)
    } catch {
      if (wasManual) {
        d.manualSet.add(fips)
        d.visited.add(fips)
      } else {
        d.manualSet.delete(fips)
        d.visited.delete(fips)
      }
      repaintCounties()
      setStats(computeStats(selectedStateRef.current))
    }
  }

  function selectState(fips: string) {
    const map = mapRef.current
    const d = dataRef.current
    if (!map || !d) return
    const entry = d.stateIndex.get(fips)
    if (!entry) return
    selectedStateRef.current = fips
    setSelectedState(fips)
    setStats(computeStats(fips))
    setTooltip(null)
    map.setFilter('states-hover-outline', ['==', ['get', 'STATEFP'], ''])
    map.fitBounds(
      [
        [entry.bbox[0], entry.bbox[1]],
        [entry.bbox[2], entry.bbox[3]],
      ],
      { padding: 48, duration: 600 },
    )
  }

  function backToContinent() {
    const map = mapRef.current
    if (!map) return
    selectedStateRef.current = null
    setSelectedState(null)
    setStats(computeStats(null))
    setTooltip(null)
    map.setFilter('counties-hover-outline', ['==', ['get', 'GEOID'], ''])
    map.fitBounds(
      [
        [NA_BOUNDS[0], NA_BOUNDS[1]],
        [NA_BOUNDS[2], NA_BOUNDS[3]],
      ],
      { padding: 24, duration: 600 },
    )
  }

  // Load data once.
  useEffect(() => {
    let cancelled = false
    loadMapData()
      .then((d) => {
        if (cancelled) return
        dataRef.current = d
        setCategories(d.categories)
        setReady(true)
      })
      .catch((e) => !cancelled && setError(String(e)))
    return () => {
      cancelled = true
    }
  }, [])

  // Create the map once data is ready.
  useEffect(() => {
    if (!ready || !containerRef.current || mapRef.current) return
    const d = dataRef.current!
    const palette = PALETTE[isDarkMode() ? 'dark' : 'light']

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {},
        layers: [{ id: 'bg', type: 'background', paint: { 'background-color': palette.background } }],
      },
      bounds: [
        [NA_BOUNDS[0], NA_BOUNDS[1]],
        [NA_BOUNDS[2], NA_BOUNDS[3]],
      ],
      fitBoundsOptions: { padding: 24 },
      minZoom: 2.5,
      maxZoom: 10,
      attributionControl: false,
    })
    map.addControl(new maplibregl.AttributionControl({ compact: true }))
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right')
    mapRef.current = map
    map.on('error', (e) => console.error('maplibre error', e.error))

    map.on('load', () => {
      map.addSource('counties', {
        type: 'geojson',
        data: d.counties as unknown as maplibregl.GeoJSONSourceSpecification['data'],
      })
      map.addSource('states', {
        type: 'geojson',
        data: d.states as unknown as maplibregl.GeoJSONSourceSpecification['data'],
      })

      map.addLayer({
        id: 'counties-fill',
        type: 'fill',
        source: 'counties',
        paint: {
          'fill-color': [
            'case',
            ['in', ['get', 'GEOID'], ['literal', [...d.visited]]],
            palette.visited,
            'transparent',
          ],
          'fill-opacity': 0.92,
        },
      })
      map.addLayer({
        id: 'counties-line',
        type: 'line',
        source: 'counties',
        paint: {
          'line-color': palette.countyBorder,
          'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.2, 8, 0.9],
          'line-opacity': 0.7,
        },
      })
      map.addLayer({
        id: 'counties-hover-outline',
        type: 'line',
        source: 'counties',
        filter: ['==', ['get', 'GEOID'], ''],
        paint: { 'line-color': palette.hover, 'line-width': 2.4 },
      })
      map.addLayer({
        id: 'states-fill',
        type: 'fill',
        source: 'states',
        paint: { 'fill-color': 'transparent' },
      })
      map.addLayer({
        id: 'states-line',
        type: 'line',
        source: 'states',
        paint: { 'line-color': palette.stateBorder, 'line-width': 1.2 },
      })
      map.addLayer({
        id: 'states-hover-outline',
        type: 'line',
        source: 'states',
        filter: ['==', ['get', 'STATEFP'], ''],
        paint: { 'line-color': palette.hover, 'line-width': 2.6 },
      })

      map.addSource('entries', {
        type: 'geojson',
        data: filteredEntryCollection(
          d.entryFeatures,
          selectedCategoryIdsRef.current,
        ) as unknown as maplibregl.GeoJSONSourceSpecification['data'],
        cluster: true,
        clusterRadius: 46,
        clusterMaxZoom: 13,
      })
      map.addLayer({
        id: 'clusters-circle',
        type: 'circle',
        source: 'entries',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': palette.cluster,
          'circle-radius': ['step', ['get', 'point_count'], 14, 5, 18, 20, 24, 50, 30],
          'circle-stroke-width': 2,
          'circle-stroke-color': palette.background,
        },
      })
      map.addLayer({
        id: 'unclustered-points',
        type: 'circle',
        source: 'entries',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['get', 'categoryColor'],
          'circle-radius': 6,
          'circle-stroke-width': 2,
          'circle-stroke-color': palette.background,
        },
      })

      setStats(computeStats(null))
    })

    map.on('mousemove', (e) => {
      const container = containerRef.current
      if (!container) return
      const point = { x: e.point.x, y: e.point.y }

      const markerHit = map.queryRenderedFeatures(e.point, {
        layers: ['clusters-circle', 'unclustered-points'],
      })[0]
      if (markerHit) {
        map.getCanvas().style.cursor = 'pointer'
        if (clusterPopupRef.current) {
          // The open popup already shows this information; a tooltip on
          // top of it is just noise.
          setTooltip(null)
          return
        }
        if (markerHit.layer.id === 'clusters-circle') {
          const count = markerHit.properties!.point_count as number
          setTooltip({ x: point.x, y: point.y, lines: [`${count} entries`, 'Click to view entries'] })
        } else {
          const p = markerHit.properties!
          setTooltip({
            x: point.x,
            y: point.y,
            lines: [p.name as string, p.categoryName as string, formatDate(p.visit_date as string | null)],
          })
        }
        return
      }

      if (!selectedStateRef.current) {
        const hit = map.queryRenderedFeatures(e.point, { layers: ['states-fill'] })[0]
        if (hit) {
          const fips = hit.properties!.STATEFP as string
          map.setFilter('states-hover-outline', ['==', ['get', 'STATEFP'], fips])
          map.getCanvas().style.cursor = 'pointer'
          const s = dataRef.current!.stateIndex.get(fips)
          if (s) {
            const visitedInState = s.geoids.filter((g) => dataRef.current!.visited.has(g)).length
            const pct = s.total ? Math.round((visitedInState / s.total) * 1000) / 10 : 0
            setTooltip({
              x: point.x,
              y: point.y,
              lines: [s.name, `${visitedInState} of ${s.total} ${SUBDIVISION_UNIT[s.country]} (${pct}%)`],
            })
          }
        } else {
          map.setFilter('states-hover-outline', ['==', ['get', 'STATEFP'], ''])
          map.getCanvas().style.cursor = ''
          setTooltip(null)
        }
      } else {
        const hit = map
          .queryRenderedFeatures(e.point, { layers: ['counties-fill'] })
          .find((f) => f.properties!.STATEFP === selectedStateRef.current)
        if (hit) {
          const fips = hit.properties!.GEOID as string
          map.setFilter('counties-hover-outline', ['==', ['get', 'GEOID'], fips])
          const d2 = dataRef.current!
          let status: string
          if (d2.entrySet.has(fips)) status = 'Logged visit'
          else if (d2.manualSet.has(fips)) status = 'Marked visited — click to unmark'
          else status = 'Not visited — click to mark'
          map.getCanvas().style.cursor = d2.entrySet.has(fips) ? 'default' : 'pointer'
          setTooltip({ x: point.x, y: point.y, lines: [hit.properties!.NAME as string, status] })
        } else {
          map.setFilter('counties-hover-outline', ['==', ['get', 'GEOID'], ''])
          map.getCanvas().style.cursor = ''
          setTooltip(null)
        }
      }
    })

    map.on('mouseleave', 'counties-fill', () => setTooltip(null))
    // Any pan/zoom invalidates the popup's screen-anchored position.
    map.on('movestart', () => {
      if (clusterPopupRef.current) updateClusterPopup(null)
    })
    map.on('click', (e) => {
      const markerHit = map.queryRenderedFeatures(e.point, {
        layers: ['clusters-circle', 'unclustered-points'],
      })[0]
      if (markerHit) {
        if (markerHit.layer.id === 'clusters-circle') {
          const clusterId = markerHit.properties!.cluster_id as number
          const count = markerHit.properties!.point_count as number
          const source = map.getSource('entries') as maplibregl.GeoJSONSource
          const [lng, lat] = (markerHit.geometry as PointGeometry).coordinates
          source.getClusterLeaves(clusterId, count, 0).then((leaves) => {
            const entries = (leaves as unknown as EntryFeature[])
              .map((f) => ({
                id: f.properties.id,
                name: f.properties.name,
                categoryName: f.properties.categoryName,
                categoryColor: f.properties.categoryColor,
                visit_date: f.properties.visit_date,
              }))
              .sort((a, b) => a.name.localeCompare(b.name))
            const pt = map.project([lng, lat])
            setTooltip(null)
            updateClusterPopup({ x: pt.x, y: pt.y, lng, lat, clusterId, entries })
          })
        } else {
          updateClusterPopup(null)
          setPanelEntryId(markerHit.properties!.id as number)
        }
        return
      }

      // Clicking empty map with the popup open just dismisses it, rather
      // than also drilling into a state or toggling a county underneath.
      if (clusterPopupRef.current) {
        updateClusterPopup(null)
        return
      }

      if (!selectedStateRef.current) {
        const hit = map.queryRenderedFeatures(e.point, { layers: ['states-fill'] })[0]
        if (hit) selectState(hit.properties!.STATEFP as string)
      } else {
        const hit = map
          .queryRenderedFeatures(e.point, { layers: ['counties-fill'] })
          .find((f) => f.properties!.STATEFP === selectedStateRef.current)
        if (hit) toggleCountyManual(hit.properties!.GEOID as string)
      }
    })

    // maplibre's own ResizeObserver can miss viewport changes that don't
    // trigger a native window 'resize' event (e.g. devtools/CDP viewport
    // emulation), leaving the canvas stuck at its creation-time size.
    const resizeObserver = new ResizeObserver(() => map.resize())
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  // Keep colors in sync with the OS theme.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const map = mapRef.current
      if (!map || !map.getLayer('counties-fill')) return
      const palette = PALETTE[isDarkMode() ? 'dark' : 'light']
      map.setPaintProperty('bg', 'background-color', palette.background)
      repaintCounties()
      map.setPaintProperty('counties-line', 'line-color', palette.countyBorder)
      map.setPaintProperty('counties-hover-outline', 'line-color', palette.hover)
      map.setPaintProperty('states-line', 'line-color', palette.stateBorder)
      map.setPaintProperty('states-hover-outline', 'line-color', palette.hover)
      if (map.getLayer('clusters-circle')) {
        map.setPaintProperty('clusters-circle', 'circle-color', palette.cluster)
        map.setPaintProperty('clusters-circle', 'circle-stroke-color', palette.background)
        map.setPaintProperty('unclustered-points', 'circle-stroke-color', palette.background)
      }
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Keep the ref mirror current so map event handlers (registered once) see live filter state.
  useEffect(() => {
    selectedCategoryIdsRef.current = selectedCategoryIds
    const map = mapRef.current
    const d = dataRef.current
    if (!map || !d || !map.getSource('entries')) return
    const source = map.getSource('entries') as maplibregl.GeoJSONSource
    source.setData(
      filteredEntryCollection(d.entryFeatures, selectedCategoryIds) as unknown as maplibregl.GeoJSONSourceSpecification['data'],
    )
  }, [selectedCategoryIds])

  // Toggle the optional OSM raster basemap — the app's one external network call.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return
    const has = map.getSource('osm')
    if (showBasemap && !has) {
      map.addSource('osm', {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
      })
      map.addLayer({ id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-opacity': 0.55 } }, 'counties-fill')
    } else if (!showBasemap && has) {
      if (map.getLayer('osm')) map.removeLayer('osm')
      map.removeSource('osm')
    }
  }, [showBasemap, ready])

  function toggleCategory(id: number) {
    setSelectedCategoryIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function zoomIntoCluster() {
    const map = mapRef.current
    const popup = clusterPopupRef.current
    if (!map || !popup) return
    const source = map.getSource('entries') as maplibregl.GeoJSONSource
    source.getClusterExpansionZoom(popup.clusterId).then((zoom) => {
      map.easeTo({ center: [popup.lng, popup.lat], zoom, duration: 500 })
    })
    updateClusterPopup(null)
  }

  const emptyMap = useMemo(() => new Map<string, string>(), [])

  if (error) return <div className="empty-state error">Couldn't load the map: {error}</div>

  return (
    <div className="map-page">
      <div className="map-filter-bar">
        {categories.map((cat) => {
          const Icon = iconFor(cat.icon)
          const active = selectedCategoryIds.has(cat.id)
          return (
            <button
              key={cat.id}
              type="button"
              className={`chip${active ? ' chip-active' : ''}`}
              style={{ '--chip-color': cat.color } as CSSProperties}
              onClick={() => toggleCategory(cat.id)}
              aria-pressed={active}
            >
              <Icon size={12} strokeWidth={2.25} />
              {cat.name}
              <span className="chip-count">{cat.entry_count}</span>
            </button>
          )
        })}
      </div>

      <div className="map-canvas-wrap">
        <div ref={containerRef} className="map-canvas" />

        {!ready && <div className="map-loading">Loading US & Canada boundaries…</div>}

        {selectedState && (
          <button type="button" className="map-back-button" onClick={backToContinent}>
            <ArrowLeft size={15} /> North America
          </button>
        )}

        {stats && (
          <div className="map-stats-panel">
            <div className="map-stats-label">{stats.label}</div>
            {stats.countries.map((c) => {
              const pct = c.total ? Math.round((c.visited / c.total) * 1000) / 10 : 0
              return (
                <div key={c.country} className="map-stats-country">
                  {stats.countries.length > 1 && (
                    <span className="map-stats-flag">{c.country}</span>
                  )}
                  <span className="map-stats-value">
                    <strong>{c.visited.toLocaleString()}</strong> of {c.total.toLocaleString()}{' '}
                    {SUBDIVISION_UNIT[c.country]}
                  </span>
                  <span className="map-stats-percent">{pct}%</span>
                </div>
              )
            })}
          </div>
        )}

        <div className="map-legend">
          <div className="map-legend-row">
            <span className="map-legend-swatch visited" />
            Visited
          </div>
          <div className="map-legend-row">
            <span className="map-legend-swatch" />
            Not visited
          </div>
        </div>

        <label className="map-basemap-toggle">
          <input type="checkbox" checked={showBasemap} onChange={(e) => setShowBasemap(e.target.checked)} />
          OpenStreetMap background (network)
        </label>

        {tooltip && (
          <div className="map-tooltip" style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}>
            {tooltip.lines.map((line, i) => (
              <div key={i} className={i === 0 ? 'map-tooltip-title' : 'map-tooltip-line'}>
                {line}
              </div>
            ))}
          </div>
        )}

        {clusterPopup && (
          <div
            className="map-cluster-popup"
            style={{
              left: Math.max(8, Math.min(clusterPopup.x + 14, (containerRef.current?.clientWidth ?? 600) - 288)),
              top: Math.max(8, Math.min(clusterPopup.y + 14, (containerRef.current?.clientHeight ?? 400) - 300)),
            }}
          >
            <div className="map-cluster-popup-header">
              <span>
                {clusterPopup.entries.length} {clusterPopup.entries.length === 1 ? 'entry' : 'entries'}
              </span>
              <div className="map-cluster-popup-actions">
                <button type="button" className="map-cluster-popup-zoom" onClick={zoomIntoCluster}>
                  <ZoomIn size={12} /> Zoom in
                </button>
                <button
                  type="button"
                  className="map-cluster-popup-close"
                  onClick={() => updateClusterPopup(null)}
                  aria-label="Close"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="map-cluster-popup-list">
              {clusterPopup.entries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="map-cluster-popup-item"
                  onClick={() => {
                    updateClusterPopup(null)
                    setPanelEntryId(entry.id)
                  }}
                >
                  <span className="map-cluster-popup-dot" style={{ background: entry.categoryColor }} />
                  <span>
                    <span className="map-cluster-popup-item-name">{entry.name}</span>
                    <span className="map-cluster-popup-item-meta">
                      {entry.categoryName} · {formatDate(entry.visit_date)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {panelEntryId !== null && (
          <MapEntryPanel
            entryId={panelEntryId}
            categoriesById={dataRef.current?.categoriesById ?? new Map()}
            stateAbbrByFips={dataRef.current?.stateAbbrByFips ?? emptyMap}
            onClose={() => setPanelEntryId(null)}
          />
        )}
      </div>
    </div>
  )
}
