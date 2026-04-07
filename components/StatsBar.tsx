'use client'

interface Props {
  totalSections: number
  totalForms: number
  limitChanges: number
  activeTab: 'sections' | 'forms'
  resultCount: number
}

export default function StatsBar({ totalSections, totalForms, limitChanges, activeTab, resultCount }: Props) {
  return (
    <div style={{
      display: 'flex',
      gap: 20,
      flexWrap: 'wrap',
      padding: '10px 0',
      borderBottom: '1px solid var(--border)',
      marginBottom: 4,
      alignItems: 'center',
    }}>
      <Stat label="Sections mapped" value={totalSections} />
      <Stat label="Forms mapped" value={totalForms} />
      <Stat label="Limit changes" value={limitChanges} accent />
      <div style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--ink-faint)' }}>
        {resultCount} {activeTab === 'sections' ? 'section' : 'form'}{resultCount !== 1 ? 's' : ''} shown
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '1rem',
        fontWeight: 600,
        color: accent ? 'var(--saffron)' : 'var(--ink)',
      }}>
        {value}
      </span>
      <span style={{ fontSize: '0.78rem', color: 'var(--ink-faint)' }}>{label}</span>
    </div>
  )
}
