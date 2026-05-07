'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Fuse from 'fuse.js'
import type { Section, Form, MappingData } from '@/lib/types'
import { SECTION_CATEGORIES } from '@/lib/search'
import SectionCard from './SectionCard'
import FormCard from './FormCard'
import DocumentScanner from './DocumentScanner'
import AaykarMitra from './AaykarMitra'
import NoticeAnalyzer from './NoticeAnalyzer'
import OnboardingTour from './OnboardingTour'

type TabType = 'sections' | 'forms' | 'scanner' | 'ask' | 'notice'

const NAV_ITEMS: { k: TabType; l: string; kbd: string }[] = [
  { k: 'sections', l: 'Section mapper', kbd: 'S' },
  { k: 'forms',    l: 'Forms',          kbd: 'F' },
  { k: 'scanner',  l: 'Doc scanner',    kbd: 'D' },
  { k: 'ask',      l: 'AaykarMitra',    kbd: 'A' },
  { k: 'notice',   l: 'Notice analyzer', kbd: 'N' },
]

const SUGGESTIONS = [
  { ref: '80C',  tag: 'deductions' },
  { ref: '194C', tag: 'contractor TDS' },
  { ref: '87A',  tag: 'rebate' },
  { ref: 'Form 16' },
  { ref: 'HRA' },
  { ref: 'Form 24Q' },
  { ref: 'gratuity' },
]

interface Props { data: MappingData }

export default function AaykarSetuApp({ data }: Props) {
  const supabase = createClient()
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('sections')
  const [activeCategory, setActiveCategory] = useState('All')
  const [viewMode] = useState<'cards' | 'table'>('cards')
  const searchRef = useRef<HTMLInputElement>(null)

  // ── Fuse indexes ──────────────────────────────────────────────────────────
  const sectionFuse = useMemo(() => new Fuse(data.sections, {
    keys: [
      { name: 'old_ref', weight: 2 }, { name: 'new_ref', weight: 2 },
      { name: 'old_title', weight: 1.5 }, { name: 'new_title', weight: 1.5 },
      { name: 'keywords', weight: 1 }, { name: 'plain_english_summary', weight: 0.8 },
      { name: 'category', weight: 0.5 },
    ],
    threshold: 0.35, includeScore: true, ignoreLocation: true, minMatchCharLength: 2,
  }), [data.sections])

  const formFuse = useMemo(() => new Fuse(data.forms, {
    keys: [
      { name: 'old_form', weight: 2 }, { name: 'new_form', weight: 2 },
      { name: 'old_purpose', weight: 1.5 }, { name: 'new_purpose', weight: 1.5 },
      { name: 'keywords', weight: 1 }, { name: 'structural_changes', weight: 0.8 },
    ],
    threshold: 0.35, includeScore: true, ignoreLocation: true, minMatchCharLength: 2,
  }), [data.forms])

  // ── Filtered results ──────────────────────────────────────────────────────
  const filteredSections = useMemo(() => {
    let results: Section[] = query.trim().length >= 2
      ? sectionFuse.search(query).map(r => r.item)
      : data.sections
    if (activeCategory !== 'All') results = results.filter(s => s.category === activeCategory)
    return results
  }, [query, activeCategory, sectionFuse, data.sections])

  const filteredForms = useMemo(() => {
    if (query.trim().length >= 2) return formFuse.search(query).map(r => r.item)
    return data.forms
  }, [query, formFuse, data.forms])

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

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleQueryChange = useCallback((v: string) => {
    setQuery(v)
    if (v.trim().length >= 2) setActiveCategory('All')
  }, [])

  const handleTabChange = useCallback((tab: TabType) => {
    setActiveTab(tab)
    setActiveCategory('All')
  }, [])

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // ⌘K / Ctrl+K → focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (activeTab !== 'sections' && activeTab !== 'forms') handleTabChange('sections')
        setTimeout(() => searchRef.current?.focus(), 0)
        return
      }
      // Single-key nav shortcuts (S/F/D/A/N) when not in a text input
      const tag = (document.activeElement as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const map: Partial<Record<string, TabType>> = { s: 'sections', f: 'forms', d: 'scanner', a: 'ask', n: 'notice' }
      const dest = map[e.key.toLowerCase()]
      if (dest) handleTabChange(dest)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [activeTab, handleTabChange])

  const isSearchTab = activeTab === 'sections' || activeTab === 'forms'

  // ── Category counts for filter bar ────────────────────────────────────────
  const allCount = query.trim().length >= 2
    ? Object.values(categoryCounts).reduce((a, b) => a + b, 0)
    : data.sections.length

  return (
    <div className="app-shell">

      {/* ── TopBar ──────────────────────────────────────────────────────────── */}
      <header className="topbar">
        <button className="brand" onClick={() => handleTabChange('sections')}>
          <span className="dot" aria-hidden="true" />
          AaykarSetu
          <small>v0.5 · preview</small>
        </button>

        <nav className="navlinks" id="tour-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.k}
              className={activeTab === item.k ? 'active' : ''}
              onClick={() => handleTabChange(item.k)}
            >
              {item.l}
              <span className="kbd">{item.kbd}</span>
            </button>
          ))}
        </nav>

        <div className="grow" />

        <div className="acts">
          <span>IT Act 1961</span>
          <span className="arr">→</span>
          <span className="new">IT Act 2025</span>
        </div>

        <button
          className="iconbtn"
          title="Sign out"
          onClick={async () => {
            await supabase.auth.signOut()
            window.location.href = '/auth/login'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
          </svg>
        </button>
      </header>

      {/* ── Search surfaces (sections + forms) ──────────────────────────────── */}
      {isSearchTab && (
        <>
          {/* Hero */}
          <div className="hero">
            {!query && (
              <>
                <p className="eyebrow">
                  Section mapper · {data.sections.length.toLocaleString()} sections · CBDT-verified
                </p>
                <h1>Find any 1961 section&rsquo;s new home <em>in 2025.</em></h1>
                <p className="sub">
                  Search a section number, a form, or a phrase. Results show the renumbering,
                  the change type, and any monetary limit movement — with plain-English notes and the source citation.
                </p>
              </>
            )}

            {/* Megasearch */}
            <div className="megasearch" id="tour-search">
              <div className="scope">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 7h18M3 12h18M3 17h12"/></svg>
                <span>All sections</span>
                <svg className="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 9l6 6 6-6"/></svg>
              </div>
              <input
                ref={searchRef}
                className="ipt"
                value={query}
                onChange={e => handleQueryChange(e.target.value)}
                placeholder="Search by section number, form, or keyword…"
              />
              <span className="kshort">⌘K</span>
              <button className="submit" onClick={() => searchRef.current?.focus()}>
                Search
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>
              </button>
            </div>

            {/* Suggestions */}
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

            {/* Index strip */}
            {!query && (
              <div className="indexstrip" id="tour-stats">
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

          {/* Filter bar */}
          <div className="filterbar">
            {/* Sections / Forms pills */}
            <button
              className={'pill' + (activeTab === 'sections' ? ' active' : '')}
              onClick={() => handleTabChange('sections')}
            >
              Sections <span className="ct">{data.sections.length}</span>
            </button>
            <button
              className={'pill' + (activeTab === 'forms' ? ' active' : '')}
              onClick={() => handleTabChange('forms')}
            >
              Forms <span className="ct">{data.forms.length}</span>
            </button>

            {/* Category pills — sections tab only */}
            {activeTab === 'sections' && (
              <>
                <span className="divider" />
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
              </>
            )}

            {/* Cards / Table toggle */}
            <div className="seg">
              <button className={viewMode === 'cards' ? 'on' : ''}>Cards</button>
              <button className={viewMode === 'table' ? 'on' : ''}>Table</button>
            </div>
          </div>

          {/* Disclaimer */}
          <div style={{ padding: '6px 28px', fontSize: 11.5, color: 'var(--ink-4)', lineHeight: 1.5, background: 'var(--paper)' }}>
            {data.meta.disclaimer}
          </div>

          {/* Results */}
          <main style={{ padding: '16px 28px 48px', flex: 1 }}>
            {activeTab === 'sections' ? (
              filteredSections.length > 0 ? (
                <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {filteredSections.map((section, i) => (
                    <SectionCard key={section.id} section={section} index={i} totalSections={data.meta.total_sections} />
                  ))}
                </div>
              ) : (
                <EmptyState query={query} onSuggest={handleQueryChange} tab="sections" />
              )
            ) : (
              filteredForms.length > 0 ? (
                <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {filteredForms.map((form, i) => (
                    <FormCard key={form.id} form={form} index={i} />
                  ))}
                </div>
              ) : (
                <EmptyState query={query} onSuggest={handleQueryChange} tab="forms" />
              )
            )}
          </main>

          {/* Footer */}
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
              <a href="/privacy" style={{ color: 'var(--ink-4)', textDecoration: 'underline' }}>Privacy Policy</a>
              {' · '}
              <span style={{ color: 'var(--ink-3)', fontWeight: 500 }}>MSB Digital Labs</span>
            </p>
          </footer>
        </>
      )}

      {/* ── Full-height feature surfaces ─────────────────────────────────────── */}
      {activeTab === 'scanner' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <DocumentScanner data={data} />
        </div>
      )}
      {activeTab === 'ask' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <AaykarMitra />
        </div>
      )}
      {activeTab === 'notice' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <NoticeAnalyzer />
        </div>
      )}

      <OnboardingTour />
    </div>
  )
}

function EmptyState({ query, onSuggest, tab }: { query: string; onSuggest: (q: string) => void; tab: string }) {
  const sug = tab === 'sections'
    ? ['TDS', 'Deductions', 'salary', 'capital gains', '194C']
    : ['Form 16', 'Form 24Q', '15G', 'ITR', 'TDS certificate']
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ink-3)' }}>
      <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>
        No results for &ldquo;{query}&rdquo;
      </p>
      <p style={{ fontSize: 13.5, color: 'var(--ink-3)', marginBottom: 20 }}>
        Try a keyword, section number, or form name
      </p>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
        {sug.map(s => (
          <button key={s} className="sugg" onClick={() => onSuggest(s)}>
            <span className="sref">{s}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
