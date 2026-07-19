import type { Entry } from '../api/types'

/** Prefer the user-entered address; fall back to the derived county/state. */
export function displayLocation(entry: Entry, stateAbbr: string | undefined): string {
  if (entry.address.trim()) return entry.address.trim()
  return [entry.county_name, stateAbbr].filter(Boolean).join(', ')
}

/** Country-prefixed region key ("US24" / "CA24") — US state codes and CA
 * province codes overlap, so region abbreviations must be looked up by both. */
export function regionAbbrKey(entry: Entry): string {
  return `${entry.country ?? 'US'}${entry.state_fips ?? ''}`
}
