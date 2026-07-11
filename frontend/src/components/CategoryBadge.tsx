import type { CSSProperties } from 'react'
import type { Category } from '../api/types'
import { iconFor } from './icons'

export default function CategoryBadge({ category }: { category: Category }) {
  const Icon = iconFor(category.icon)
  return (
    <span
      className="category-badge"
      style={{ '--badge-color': category.color } as CSSProperties}
    >
      <Icon size={12} strokeWidth={2.25} />
      {category.name}
    </span>
  )
}
