'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import Fuse from 'fuse.js'
import type { Section, MappingData } from '@/lib/types'
import { SECTION_CATEGORIES } from '@/lib/search'
import SectionCard from './SectionCard'

const SUGGESTIONS = [
  { ref: '80C',  tag: 'deductions' },
  { ref: '194C', tag: 'contractor TDS' },
  { ref: '87A',  tag: 'rebate' },
  { ref: 'HRA' },
  { ref: 'gratuity' },
]

interface Props { data: MappingData }

export default function SectionMapper({ data }: Props) {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const searchRef = useRef<HTMLInputElement>(null)

  const sectionFuse = useMemo(() => new Fuse(data.sections, {
    keys: [
      { name: 'old_ref', weight: 2 }, { name: 'new_ref', weight: 2 },
      { name: 'old_title', weight: 1.5 }, { name: 'new_title', weight: 1.5 },
      { name: 'keywords', weight: 1 }, { name: 'plain_english_summary', weight: 0.8 },
      { name: 'category', weight: 0.5 },
    ],
    threshold: 0.35, includeScore: true, ignoreLocation: true, minMatchCharLength: 2,
  }), [data.sections])

  const filteredSections = useMemo(() => {
    let results: Section[] = query.trim().length >= 2
      ? sectionFuse.search(query).map(r => r.item)
      : data.sections
    if (activeCategory !== 'All') results = results.filter(s => s.category === activeCategory)
    return results
  }, [query, activeCategory, sectionFuse, data.sections])

  const categoryCounts = useMemo(() => {
    const base: Section[] = query.trim().length >= 2
      ? sectionFuse.search(query).map(r => r.item)
      : data.sections
    const counts: Record<string, number> = {}
    for (const s of base) counts[s.category] = (counts[s.category] ?? 0) + 1
    return counts
  }, [query, sectionFuse, data.sections])

  const limitChanges = useMemo(() => data.sections.filter(s => s.limit_changed).length, [data.sections])

  const lastVerified = useMemo(() => {
    if (!data.meta.generated) return '07 May'
    return new Date(data.meta.generated).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
  }, [data.meta.generated])

  const handleQueryChange = useCallback((v: string) => {
    setQuery(v)
    if (v.trim().length >= 2) setActiveCategory('All')
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setTimeout(() => searchRef.current?.focus(), 0)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const allCount = query.trim().length >= 2
    ? Object.values(categoryCounts).reduce((a, b) => a + b, 0)
    : data.sections.length

  return (
    <div className="app-shell">

      {/* ── TopBar ── */}
      <header className="topbar">
        <div className="brand">
          <span className="dot" aria-hidden="true" />
          AaykarSetu
          <small>Section Mapper · IT Act 1961 → 2025</small>
        </div>
        <div className="grow" />
        <div className="acts">
          <span>IT Act 1961</span>
          <span className="arr">→</span>
          <span className="new">IT Act 2025</span>
        </div>
      </header>

      {/* ── Hero + Search ── */}
      <div className="hero">
        {!query && (
          <>
            <p className="eyebrow">
              Section mapper · {data.sections.length.toLocaleString()} sections · CBDT-verified
            </p>
            <h1>Find any 1961 section&rsquo;s new home <em>in 2025.</em></h1>
            <p className="sub">
              Search a section number or phrase. Results show the renumbering, the change type,
              and any monetary limit movement — with plain-English notes and the source citation.
            </p>
          </>
        )}

        <div className="megasearch">
          <div className="scope">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 7h18M3 12h18M3 17h12"/></svg>
            <span>All sections</span>
          </div>
          <input
            ref={searchRef}
            className="ipt"
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            placeholder="Search by section number or keyword…"
          />
          <span className="kshort">⌘K</span>
        </div>

        {!query && (
          <div className="suggrow">
            <span className="lbl">Quick</span>
            {SUGGESTIONS.map(s => (
              <button key={s.ref} className="sugg" onClick={() => handleQueryChange(s.ref)}>
                <span className="sref">{s.ref}</span>
                {s.tag && <span className="stag">{s.tag}</span>}
              </button>
            ))}
          </div>
        )}

        {!query && (
          <div className="indexstrip">
            <div className="cell">
              <div className="n serif">{data.sections.length.toLocaleString()}</div>
              <div className="l">sections mapped</div>
            </div>
            <div className="cell">
              <div className="n serif">{data.forms.length.toLocaleString()}</div>
              <div className="l">forms reconciled</div>
            </div>
            <div className="cell warn">
              <div className="n serif">
                <span className="gly-r">₹</span>{limitChanges}
              </div>
              <div className="l">monetary limits changed</div>
            </div>
            <div className="cell">
              <div className="n serif">{lastVerified}</div>
              <div className="l">last CBDT verification</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Filter bar ── */}
      <div className="filterbar">
        <button
          className={'pill' + (activeCategory === 'All' ? ' active' : '')}
          onClick={() => setActiveCategory('All')}
        >
          All <span className="ct">{allCount}</span>
        </button>
        {SECTION_CATEGORIES.slice(1).map(cat => {
          const count = categoryCounts[cat] ?? 0
          if (count === 0 && query.trim().length >= 2) return null
          return (
            <button
              key={cat}
              className={'pill' + (activeCategory === cat ? ' active' : '')}
              onClick={() => setActiveCategory(cat)}
            >
              {cat} <span className="ct">{count || data.sections.filter(s => s.category === cat).length}</span>
            </button>
          )
        })}
      </div>

      {/* ── Disclaimer ── */}
      <div style={{ padding: '6px 28px', fontSize: 11.5, color: 'var(--ink-4)', lineHeight: 1.5, background: 'var(--paper)' }}>
        {data.meta.disclaimer}
      </div>

      {/* ── Results ── */}
      <main style={{ padding: '16px 28px 48px', flex: 1 }}>
        {filteredSections.length > 0 ? (
          <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredSections.map((section, i) => (
              <SectionCard key={section.id} section={section} index={i} totalSections={data.meta.total_sections} />
            ))}
          </div>
        ) : (
          <EmptyState query={query} onSuggest={handleQueryChange} />
        )}
      </main>

      {/* ── Footer ── */}
      <footer style={{
        borderTop: '1px solid var(--line)', padding: '18px 28px',
        textAlign: 'center', fontSize: 12, color: 'var(--ink-4)',
        background: 'var(--card)',
      }}>
        <p style={{ margin: 0 }}>
          AaykarSetu · Data sourced from CBDT official concordance · Built for India&rsquo;s Tax Year 2026-27 transition
        </p>
        <p style={{ margin: '4px 0 0' }}>
          Always verify with a qualified CA before relying on any mapping.{' '}
          <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}>MSB Digital Labs</span>
        </p>
      </footer>
    </div>
  )
}

function EmptyState({ query, onSuggest }: { query: string; onSuggest: (q: string) => void }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-3)' }}>
      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
        No results for &ldquo;{query}&rdquo;
      </p>
      <p style={{ fontSize: 13.5, color: 'var(--ink-3)', marginBottom: 20 }}>
        Try a keyword, section number, or form name
      </p>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
        {['TDS', 'Deductions', 'salary', 'capital gains', '194C'].map(s => (
          <button key={s} className="sugg" onClick={() => onSuggest(s)}>
            <span className="sref">{s}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
