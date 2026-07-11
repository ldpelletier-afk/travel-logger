import {
  Landmark,
  TowerControl,
  Flame,
  Milestone,
  Building2,
  TreePine,
  Trees,
  Binoculars,
  MapPin,
  type LucideIcon,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  landmark: Landmark,
  tower: TowerControl,
  flame: Flame,
  bridge: Milestone,
  building: Building2,
  tree: TreePine,
  trees: Trees,
  binoculars: Binoculars,
  'map-pin': MapPin,
}

export const ICON_KEYS = Object.keys(ICONS)

export function iconFor(key: string): LucideIcon {
  return ICONS[key] ?? MapPin
}
