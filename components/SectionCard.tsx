'use client'
import { useState, useCallback } from 'react'
import type { Section, SectionVariant, SectionRelationship, RelationshipType } from '@/lib/types'

// ── Constants ─────────────────────────────────────────────────────────────────

const CHANGE_BADGE: Record<string, { label: string; cls: string }> = {
  renumbered: { label: 'Renumbered', cls: 'renum' },
  amended:    { label: 'Amended',    cls: 'amend' },
  merged:     { label: 'Merged',     cls: 'merge' },
  relocated:  { label: 'Relocated',  cls: 'relo'  },
  deleted:    { label: 'Deleted',    cls: 'del'   },
}

const REL_STYLES: Record<RelationshipType, { label: string; bg: string; text: string; border: string }> = {
  READ_WITH:            { label: 'Read with',     bg: 'var(--info-soft)',  text: 'var(--info)',  border: 'rgba(30,64,175,0.2)'  },
  GOVERNED_BY:          { label: 'Governed by',   bg: 'var(--warn-soft)',  text: 'var(--warn)',  border: 'rgba(161,98,7,0.2)'   },
  FORM_REQUIRED:        { label: 'Form required', bg: 'var(--paper-2)',    text: 'var(--ink-2)', border: 'var(--line)'           },
  EXEMPTION_AVAILABLE:  { label: 'Exemption',     bg: 'var(--good-soft)',  text: 'var(--good)',  border: 'rgba(22,101,52,0.2)'  },
  AGGREGATE_CAP_SHARED: { label: 'Shared cap',    bg: '#faf5ff',           text: '#6d28d9',      border: '#ddd6fe'               },
}

const REGIME_PILL: Record<string, { label: string; bg: string; text: string }> = {
  new:  { label: 'New regime',   bg: 'var(--info-soft)', text: 'var(--info)' },
  old:  { label: 'Old regime',   bg: 'var(--warn-soft)', text: 'var(--warn)' },
  both: { label: 'Both regimes', bg: 'var(--good-soft)', text: 'var(--good)' },
}

type DrillTab = 'variants' | 'act_text' | 'related'
type ActVersion = '2025' | '1961'

// ── Sub-components ────────────────────────────────────────────────────────────

function VariantCard({ v, active, onClick }: { v: SectionVariant; active: boolean; onClick: () => void }) {
  const rp = v.conditions.regime ? REGIME_PILL[v.conditions.regime] : null
  return (
    <button onClick={onClick} style={{
      display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
      borderRadius: 8, marginBottom: 8,
      border: `1.5px solid ${active ? 'var(--teal)' : 'var(--line)'}`,
      background: active ? 'var(--teal-soft)' : 'var(--card)',
      cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: active ? 'var(--teal-2)' : 'var(--ink)', lineHeight: 1.3 }}>
          {v.label}
        </span>
        {rp && (
          <span style={{ fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 100, flexShrink: 0, background: rp.bg, color: rp.text }}>
            {rp.label}
          </span>
        )}
      </div>
      <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0, lineHeight: 1.55 }}>{v.tax_treatment}</p>
      {v.caveat && (
        <p style={{ fontSize: 12, color: 'var(--warn)', margin: '6px 0 0', lineHeight: 1.5, padding: '4px 8px', background: 'var(--warn-soft)', borderRadius: 5, border: '1px solid rgba(161,98,7,0.2)' }}>
          ⚠ {v.caveat}
        </p>
      )}
      {v.conditions.taxpayer_type && v.conditions.taxpayer_type.length > 0 && (
        <p style={{ fontSize: 11, color: 'var(--ink-4)', margin: '5px 0 0' }}>
          Applies to: {v.conditions.taxpayer_type.join(', ')}
        </p>
      )}
    </button>
  )
}

function RelationshipRow({ rel }: { rel: SectionRelationship }) {
  const s = REL_STYLES[rel.type] ?? REL_STYLES.READ_WITH
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
      <span style={{ fontSize: 10.5, fontWeight: 600, flexShrink: 0, padding: '2px 8px', borderRadius: 100, marginTop: 2, background: s.bg, color: s.text, border: `1px solid ${s.border}` }}>
        {s.label}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', margin: '0 0 2px' }}>
          {rel.target_ref}
          <span style={{ fontWeight: 400, color: 'var(--ink-3)', marginLeft: 6 }}>— {rel.target_title}</span>
        </p>
        <p style={{ fontSize: 12.5, color: 'var(--ink-3)', margin: 0, lineHeight: 1.5 }}>{rel.note}</p>
      </div>
    </div>
  )
}

function ActTextPanel({ section, version }: { section: Section; version: ActVersion }) {
  const [showSubs, setShowSubs] = useState(false)
  const st = section.source_text

  if (version === '1961') {
    return (
      <div style={{ padding: 16, background: 'var(--paper-2)', borderRadius: 8, border: '1px solid var(--line)', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: 0 }}>
          Income Tax Act 1961 text for {section.old_ref} is available in the original Act. This mapper covers the ITA 2025 mapping only.
        </p>
      </div>
    )
  }
  if (!st) {
    return (
      <div style={{ padding: 16, background: 'var(--paper-2)', borderRadius: 8, border: '1px solid var(--line)', textAlign: 'center' }}>
        <p style={{ fontSize: 13, color: 'var(--ink-4)', margin: 0 }}>Act text not yet extracted for this section.</p>
      </div>
    )
  }
  const subKeys = st.act_2025.sub_sections ? Object.keys(st.act_2025.sub_sections) : []
  return (
    <div>
      <div style={{ background: 'var(--paper-2)', borderRadius: 8, padding: 16, border: '1px solid var(--line)' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', margin: '0 0 10px', lineHeight: 1.5 }}>{st.act_2025.section_header}</p>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', margin: 0, lineHeight: 1.75 }}>{st.act_2025.main_provision}</p>
        {subKeys.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <button onClick={() => setShowSubs(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, color: 'var(--teal-2)', fontWeight: 600, padding: 0 }}>
              {showSubs ? '▲ Hide' : '▼ Show'} sub-sections ({subKeys.length})
            </button>
            {showSubs && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                {subKeys.map(k => (
                  <div key={k} style={{ marginBottom: 10 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginRight: 6 }}>{k}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--ink-3)', lineHeight: 1.65 }}>{st.act_2025.sub_sections![k]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--good)', flexShrink: 0, display: 'inline-block' }} />
        <span style={{ fontSize: 11.5, color: 'var(--ink-4)', fontFamily: 'var(--font-mono)' }}>
          Extracted from official PDF · Page {st.pdf_page} · Verified {st.extraction_date}
        </span>
      </div>
    </div>
  )
}

function exportSectionText(section: Section) {
  const lines = [
    `AaykarSetu — Section Reference`,
    ``, `${section.old_ref} → ${section.new_ref}`,
    `${section.old_title}${section.new_title !== section.old_title ? ` → ${section.new_title}` : ''}`,
    ``, `Summary:`, section.plain_english_summary,
  ]
  if (section.limit_changed_note) lines.push(``, `Limit change: ${section.limit_changed_note}`)
  if (section.variants?.length) {
    lines.push(``, `How it applies:`)
    section.variants.forEach(v => {
      lines.push(`  • ${v.label}: ${v.tax_treatment}`)
      if (v.caveat) lines.push(`    ⚠ ${v.caveat}`)
    })
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${section.old_ref.replace(/\s/g, '_')}_to_${section.new_ref.replace(/[\s/]/g, '_')}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props { section: Section; index: number; totalSections?: number }

export default function SectionCard({ section, index, totalSections }: Props) {
  const [expandedTab, setExpandedTab] = useState<DrillTab | null>(null)
  const [actVersion, setActVersion] = useState<ActVersion>('2025')
  const [activeVariant, setActiveVariant] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const isDeleted     = section.change_type === 'deleted'
  const hasVariants   = !!(section.variants?.length)
  const hasRelations  = !!(section.relationships?.length)
  const hasActText    = !!section.source_text_available
  const hasDrillDown  = hasVariants || hasRelations || hasActText

  const badgeInfo = CHANGE_BADGE[section.change_type]

  const cbdtDate = section.verified_date
    ? new Date(section.verified_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, '-')
    : null

  const handleToggle = (tab: DrillTab) => {
    setExpandedTab(prev => prev === tab ? null : tab)
  }

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(`${section.old_ref} → ${section.new_ref}`).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }, [section.old_ref, section.new_ref])

  return (
    <div
      className={`scard fade-up${section.cbdt_verified ? ' flagged' : ''}`}
      style={{ animationDelay: `${Math.min(index * 30, 240)}ms`, opacity: 0 }}
    >
      {/* CBDT stamp ribbon — flagged cards only */}
      {section.cbdt_verified && (
        <div className="stamp-corner">
          <span className="stamp-ribbon">CBDT verified</span>
        </div>
      )}

      {/* ── Row 1 ──────────────────────────────────────────────────────────── */}
      <div className="row1">
        {/* Refblock */}
        <div className="refblock">
          <span className="lab">1961</span>
          <span className={`ref old mono${isDeleted ? ' deleted' : ''}`}>{section.old_ref}</span>
          <span className="lab">2025</span>
          <span className={`ref ${isDeleted ? 'deleted' : 'new'} mono`}>{section.new_ref}</span>
        </div>

        {/* Title column */}
        <div className="titlecol">
          <h4>{section.new_title !== section.old_title && !isDeleted ? section.new_title : section.old_title}</h4>
          {section.new_title !== section.old_title && !isDeleted && section.old_title && (
            <p className="subtitle">Previously: {section.old_title}</p>
          )}
          <p className="summary">{section.plain_english_summary}</p>
        </div>

        {/* Quick actions */}
        <div className="quick-actions">
          {badgeInfo && <span className={`badge ${badgeInfo.cls}`}>{badgeInfo.label}</span>}
          <button className="iconlink" onClick={handleCopy}>
            {copied ? '✓ Copied' : '⎘ copy ref'}
          </button>
          <button className="iconlink" onClick={() => exportSectionText(section)}>
            ↓ export
          </button>
        </div>
      </div>

      {/* ── Limit strip ────────────────────────────────────────────────────── */}
      {section.limit_changed && section.limit_changed_note && (
        <div className="limit-strip">
          <span>⚠</span>
          <span><b>Monetary limit changed.</b> {section.limit_changed_note}</span>
          {section.old_limit != null && section.new_limit != null && (
            <span className="nums">
              <span className="from">₹{section.old_limit.toLocaleString('en-IN')}</span>
              {' → '}
              <span className="to">₹{section.new_limit.toLocaleString('en-IN')}</span>
            </span>
          )}
        </div>
      )}

      {/* ── Row 2: toolbar ─────────────────────────────────────────────────── */}
      {hasDrillDown && (
        <div className="row2">
          <span className="seg"><b>{section.category}</b></span>
          {section.cbdt_verified && cbdtDate && (
            <span className="seg">CBDT verified · {cbdtDate}</span>
          )}
          {totalSections && (
            <span className="seg" style={{ color: 'var(--ink-4)' }}>{totalSections.toLocaleString()} sections total</span>
          )}
          <div className="grow" />
          {hasVariants && (
            <button className={`toggle${expandedTab === 'variants' ? ' on' : ''}`} onClick={() => handleToggle('variants')}>
              How it applies
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d={expandedTab === 'variants' ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
              </svg>
            </button>
          )}
          {hasActText && (
            <button className={`toggle${expandedTab === 'act_text' ? ' on' : ''}`} onClick={() => handleToggle('act_text')}>
              Act text
            </button>
          )}
          {hasRelations && (
            <button className={`toggle${expandedTab === 'related' ? ' on' : ''}`} onClick={() => handleToggle('related')}>
              Related ({section.relationships!.length})
            </button>
          )}
        </div>
      )}

      {/* ── Drill-down content ──────────────────────────────────────────────── */}
      {expandedTab !== null && (
        <div className="drill">
          {expandedTab === 'variants' && hasVariants && (
            <div>
              {section.variants!.map(v => (
                <VariantCard
                  key={v.id} v={v}
                  active={activeVariant === v.id}
                  onClick={() => setActiveVariant(p => p === v.id ? null : v.id)}
                />
              ))}
            </div>
          )}

          {expandedTab === 'act_text' && (
            <div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
                {(['2025', '1961'] as ActVersion[]).map(v => (
                  <button key={v} onClick={() => setActVersion(v)} style={{
                    padding: '6px 14px', borderRadius: 7, cursor: 'pointer',
                    fontSize: 12.5, fontWeight: 600,
                    border: `1.5px solid ${actVersion === v ? 'var(--ink)' : 'var(--line)'}`,
                    background: actVersion === v ? 'var(--ink)' : 'var(--card)',
                    color: actVersion === v ? '#fff' : 'var(--ink-3)',
                    transition: 'all 0.15s',
                  }}>
                    IT Act {v}
                  </button>
                ))}
              </div>
              <ActTextPanel section={section} version={actVersion} />
            </div>
          )}

          {expandedTab === 'related' && hasRelations && (
            <div>
              {section.relationships!.map((rel, i) => (
                <RelationshipRow key={i} rel={rel} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
