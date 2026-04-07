'use client'
import { SECTION_CATEGORIES } from '@/lib/search'

interface Props {
  active: string
  onChange: (cat: string) => void
  counts: Record<string, number>
}

export default function CategoryFilter({ active, onChange, counts }: Props) {
  return (
    <div style={{
      display: 'flex',
      gap: 6,
      flexWrap: 'wrap',
      padding: '2px 0',
    }}>
      {SECTION_CATEGORIES.map(cat => {
        const count = cat === 'All' ? Object.values(counts).reduce((a, b) => a + b, 0) : (counts[cat] ?? 0)
        return (
          <button
            key={cat}
            className={`cat-pill${active === cat ? ' active' : ''}`}
            onClick={() => onChange(cat)}
          >
            {cat}
            {count > 0 && (
              <span style={{
                marginLeft: 5,
                fontSize: '0.7rem',
                opacity: active === cat ? 0.85 : 0.6,
                fontWeight: 600,
              }}>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
