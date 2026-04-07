'use client'
import type { Form } from '@/lib/types'

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
  deleted: 'Deleted',
}

interface Props {
  form: Form
  index: number
}

export default function FormCard({ form, index }: Props) {
  const badge = BADGE_STYLES[form.change_type] ?? BADGE_STYLES.renumbered
  const isMerged = form.change_type === 'merged'

  return (
    <div
      className="result-card fade-up"
      style={{ animationDelay: `${Math.min(index * 30, 240)}ms`, opacity: 0 }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span className="ref-chip" style={{ background: '#f0ede8', color: '#374151' }}>
            {form.old_form}
          </span>
          <span style={{ color: 'var(--ink-faint)', fontSize: '0.85rem' }}>→</span>
          <span className="ref-chip" style={{
            background: isMerged ? '#f5f3ff' : 'var(--teal-light)',
            color: isMerged ? '#6d28d9' : 'var(--teal-dark)',
          }}>
            {form.new_form}
          </span>
        </div>
        <span
          className="change-badge"
          style={{ background: badge.bg, color: badge.text, borderColor: badge.border, flexShrink: 0 }}
        >
          {CHANGE_LABELS[form.change_type]}
        </span>
      </div>

      {/* Purpose */}
      <div style={{ marginBottom: 8 }}>
        <p style={{ fontSize: '0.78rem', color: 'var(--ink-faint)', margin: '0 0 2px', fontWeight: 500 }}>
          {form.old_purpose}
        </p>
        <p style={{ fontSize: '0.78rem', color: 'var(--teal)', fontWeight: 500, margin: 0 }}>
          → {form.new_purpose}
        </p>
      </div>

      {/* Section refs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={{ fontSize: '0.72rem', color: 'var(--ink-faint)' }}>
          {form.related_section_old}
        </span>
        <span style={{ fontSize: '0.72rem', color: 'var(--ink-faint)' }}>→</span>
        <span style={{ fontSize: '0.72rem', color: 'var(--teal)', fontWeight: 500 }}>
          {form.related_section_new}
        </span>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', margin: '10px 0' }} />

      {/* Structural changes */}
      <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)', lineHeight: 1.65, margin: 0 }}>
        {form.structural_changes}
      </p>

      {/* Merged alert */}
      {isMerged && (
        <div style={{
          display: 'flex',
          gap: 8,
          alignItems: 'flex-start',
          padding: '9px 12px',
          borderRadius: 8,
          background: '#f5f3ff',
          border: '1px solid #ddd6fe',
          marginTop: 10,
        }}>
          <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>🔀</span>
          <p style={{ fontSize: '0.8rem', color: '#5b21b6', lineHeight: 1.5, margin: 0, fontWeight: 500 }}>
            Multiple old forms merged. Update all submission workflows to use the new form number only.
          </p>
        </div>
      )}
    </div>
  )
}
