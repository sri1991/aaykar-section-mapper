'use client'
import type { Section } from '@/lib/types'

const BADGE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  renumbered: { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  amended:    { bg: '#fffbeb', text: '#b45309', border: '#fde68a' },
  merged:     { bg: '#f5f3ff', text: '#6d28d9', border: '#ddd6fe' },
  relocated:  { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
  deleted:    { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
}

const CHANGE_LABELS: Record<string, string> = {
  renumbered: 'Renumbered',
  amended: 'Amended',
  merged: 'Merged',
  relocated: 'Relocated',
  deleted: 'Deleted',
}

interface Props {
  section: Section
  index: number
}

export default function SectionCard({ section, index }: Props) {
  const badge = BADGE_STYLES[section.change_type] ?? BADGE_STYLES.renumbered
  const isDeleted = section.change_type === 'deleted'

  return (
    <div
      className="result-card fade-up"
      style={{ animationDelay: `${Math.min(index * 30, 240)}ms`, opacity: 0 }}
    >
      {/* Top row: refs + badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        {/* Section mapping */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span
            className="ref-chip"
            style={{ background: '#f0ede8', color: '#374151' }}
          >
            {section.old_ref}
          </span>
          <span style={{ color: 'var(--ink-faint)', fontSize: '0.85rem' }}>→</span>
          <span
            className="ref-chip"
            style={{
              background: isDeleted ? '#fef2f2' : 'var(--teal-light)',
              color: isDeleted ? '#b91c1c' : 'var(--teal-dark)',
            }}
          >
            {section.new_ref}
          </span>
        </div>

        {/* Right: badge + category */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <span
            className="change-badge"
            style={{ background: badge.bg, color: badge.text, borderColor: badge.border }}
          >
            {CHANGE_LABELS[section.change_type]}
          </span>
          <span style={{
            fontSize: '0.72rem',
            padding: '2px 8px',
            borderRadius: 100,
            background: 'var(--surface-3)',
            color: 'var(--ink-muted)',
            fontWeight: 500,
          }}>
            {section.category}
          </span>
        </div>
      </div>

      {/* Title */}
      <div style={{ marginBottom: 8 }}>
        <p style={{ fontSize: '0.78rem', color: 'var(--ink-faint)', marginBottom: 2, fontWeight: 500 }}>
          {section.old_title}
        </p>
        {section.new_title !== section.old_title && !isDeleted && (
          <p style={{ fontSize: '0.78rem', color: 'var(--teal)', fontWeight: 500 }}>
            → {section.new_title}
          </p>
        )}
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border)', margin: '10px 0' }} />

      {/* Summary */}
      <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)', lineHeight: 1.65, margin: 0 }}>
        {section.plain_english_summary}
      </p>

      {/* Limit change alert */}
      {section.limit_changed && section.limit_changed_note && (
        <div style={{
          display: 'flex',
          gap: 8,
          alignItems: 'flex-start',
          padding: '9px 12px',
          borderRadius: 8,
          background: '#fffbeb',
          border: '1px solid #fde68a',
          marginTop: 10,
        }}>
          <span style={{ fontSize: '0.85rem', flexShrink: 0, marginTop: 1 }}>⚠️</span>
          <p style={{ fontSize: '0.8rem', color: '#92400e', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
            <strong>Limit changed:</strong> {section.limit_changed_note}
          </p>
        </div>
      )}
    </div>
  )
}
