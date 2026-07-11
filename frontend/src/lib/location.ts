import type { Entry } from '../api/types'

/** Prefer the user-entered address; fall back to the derived county/state. */
export function displayLocation(entry: Entry, stateAbbr: string | undefined): string {
  if (entry.address.trim()) return entry.address.trim()
  return [entry.county_name, stateAbbr].filter(Boolean).join(', ')
}
