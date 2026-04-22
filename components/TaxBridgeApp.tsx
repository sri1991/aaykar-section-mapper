'use client'

import { useState, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Fuse from 'fuse.js'
import type { Section, Form, MappingData } from '@/lib/types'
import { SECTION_CATEGORIES, CHANGE_TYPE_LABELS } from '@/lib/search'
import SearchBar from './SearchBar'
import SectionCard from './SectionCard'
import FormCard from './FormCard'
import CategoryFilter from './CategoryFilter'
import StatsBar from './StatsBar'
import DocumentScanner from './DocumentScanner'
import AaykarMitra from './AaykarMitra'
import GapAuditor from './GapAuditor'

interface Props {
  data: MappingData
}

export default function AaykarSetuApp({ data }: Props) {
  const supabase = createClient()
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'sections' | 'forms' | 'scanner' | 'ask' | 'gap'>('sections')
  const [activeCategory, setActiveCategory] = useState('All')

  // Build Fuse indexes once
  const sectionFuse = useMemo(() => new Fuse(data.sections, {
    keys: [
      { name: 'old_ref', weight: 2 },
      { name: 'new_ref', weight: 2 },
      { name: 'old_title', weight: 1.5 },
      { name: 'new_title', weight: 1.5 },
      { name: 'keywords', weight: 1 },
      { name: 'plain_english_summary', weight: 0.8 },
      { name: 'category', weight: 0.5 },
    ],
    threshold: 0.35,
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 2,
  }), [data.sections])

  const formFuse = useMemo(() => new Fuse(data.forms, {
    keys: [
      { name: 'old_form', weight: 2 },
      { name: 'new_form', weight: 2 },
      { name: 'old_purpose', weight: 1.5 },
      { name: 'new_purpose', weight: 1.5 },
      { name: 'keywords', weight: 1 },
      { name: 'structural_changes', weight: 0.8 },
    ],
    threshold: 0.35,
    includeScore: true,
    ignoreLocation: true,
    minMatchCharLength: 2,
  }), [data.forms])

  // Filtered + searched sections
  const filteredSections = useMemo(() => {
    let results: Section[]
    if (query.trim().length >= 2) {
      results = sectionFuse.search(query).map(r => r.item)
    } else {
      results = data.sections
    }
    if (activeCategory !== 'All') {
      results = results.filter(s => s.category === activeCategory)
    }
    return results
  }, [query, activeCategory, sectionFuse, data.sections])

  // Filtered + searched forms
  const filteredForms = useMemo(() => {
    if (query.trim().length >= 2) {
      return formFuse.search(query).map(r => r.item)
    }
    return data.forms
  }, [query, formFuse, data.forms])

  // Category counts (from current search, ignoring category filter)
  const categoryCounts = useMemo(() => {
    let base: Section[]
    if (query.trim().length >= 2) {
      base = sectionFuse.search(query).map(r => r.item)
    } else {
      base = data.sections
    }
    const counts: Record<string, number> = {}
    for (const s of base) {
      counts[s.category] = (counts[s.category] ?? 0) + 1
    }
    return counts
  }, [query, sectionFuse, data.sections])

  const limitChanges = data.sections.filter(s => s.limit_changed).length

  const handleQueryChange = useCallback((v: string) => {
    setQuery(v)
    // Reset category when query changes
    if (v.trim().length >= 2) setActiveCategory('All')
  }, [])

  const handleTabChange = useCallback((tab: 'sections' | 'forms' | 'scanner' | 'ask' | 'gap') => {
    setActiveTab(tab)
    setActiveCategory('All')
  }, [])

  const suggestions = ['80C', '194C', 'Form 16', 'HRA', 'TDS salary', '87A', 'gratuity', 'Form 24Q']

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface-2)' }}>
      {/* Header */}
      <header style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        padding: '0',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span className="font-display" style={{ fontSize: '1.4rem', color: 'var(--ink)', lineHeight: 1 }}>
              AaykarSetu
            </span>
            <span style={{
              fontSize: '0.7rem',
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: 100,
              background: 'var(--saffron-light)',
              color: 'var(--saffron-dark)',
              letterSpacing: '0.04em',
            }}>
              FREE
            </span>
          </div>

          {/* Acts label + sign out */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div className="header-acts" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>IT Act 1961</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--teal)' }}>IT Act 2025</span>
            </div>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                window.location.href = '/auth/login'
              }}
              title="Sign out"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '5px 10px',
                fontSize: '0.78rem',
                color: 'var(--ink-muted)',
                cursor: 'pointer',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>
              </svg>
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section style={{
        background: 'linear-gradient(160deg, #fff9f5 0%, var(--surface) 100%)',
        borderBottom: '1px solid var(--border)',
        padding: '40px 20px 32px',
      }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ maxWidth: 680, marginBottom: 28 }}>
            <h1 className="font-display" style={{ fontSize: 'clamp(1.8rem, 4vw, 2.6rem)', lineHeight: 1.15, marginBottom: 10, color: 'var(--ink)' }}>
              Find your section&rsquo;s new home<br />
              <em style={{ color: 'var(--saffron)' }}>in seconds.</em>
            </h1>
            <p style={{ fontSize: '0.95rem', color: 'var(--ink-muted)', lineHeight: 1.6, margin: 0 }}>
              India&rsquo;s Income Tax Act 2025 is live from April 1, 2026. Every section number has changed.
              Search any old reference and instantly see what it maps to — with plain-English explanations.
            </p>
          </div>

          {/* Search */}
          <SearchBar value={query} onChange={handleQueryChange} />

          {/* Suggestions */}
          {!query && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--ink-faint)', alignSelf: 'center' }}>Try:</span>
              {suggestions.map(s => (
                <button
                  key={s}
                  onClick={() => setQuery(s)}
                  style={{
                    fontSize: '0.75rem',
                    padding: '3px 10px',
                    borderRadius: 100,
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--ink-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.1s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'var(--saffron)'
                    e.currentTarget.style.color = 'var(--saffron-dark)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.color = 'var(--ink-muted)'
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Main content */}
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px 60px' }}>

        {/* Tabs */}
        <div className="tab-bar" style={{
          display: 'flex',
          gap: 4,
          padding: '4px',
          background: 'var(--surface-3)',
          borderRadius: 10,
          width: 'fit-content',
          marginBottom: 20,
        }}>
          <button
            className={`tab-btn${activeTab === 'sections' ? ' active' : ''}`}
            onClick={() => handleTabChange('sections')}
          >
            Sections
            <span style={{ marginLeft: 6, fontSize: '0.75rem', opacity: 0.6 }}>
              {activeTab === 'sections' ? filteredSections.length : data.sections.length}
            </span>
          </button>
          <button
            className={`tab-btn${activeTab === 'forms' ? ' active' : ''}`}
            onClick={() => handleTabChange('forms')}
          >
            Forms
            <span style={{ marginLeft: 6, fontSize: '0.75rem', opacity: 0.6 }}>
              {activeTab === 'forms' ? filteredForms.length : data.forms.length}
            </span>
          </button>
          <button
            className={`tab-btn${activeTab === 'scanner' ? ' active' : ''}`}
            onClick={() => handleTabChange('scanner')}
          >
            <span className="tab-label-long">Document Scanner</span>
            <span className="tab-label-short">Scanner</span>
          </button>
          <button
            className={`tab-btn${activeTab === 'ask' ? ' active' : ''}`}
            onClick={() => handleTabChange('ask')}
          >
            <span className="tab-label-long">AaykarMitra</span>
            <span className="tab-label-short">AI Chat</span>
          </button>
          <button
            className={`tab-btn${activeTab === 'gap' ? ' active' : ''}`}
            onClick={() => handleTabChange('gap')}
          >
            <span className="tab-label-long">Gap Auditor</span>
            <span className="tab-label-short">Gaps</span>
          </button>
        </div>

        {/* Stats bar — hidden on scanner, ask, and gap tabs */}
        {activeTab !== 'scanner' && activeTab !== 'ask' && activeTab !== 'gap' && (
          <StatsBar
            totalSections={data.sections.length}
            totalForms={data.forms.length}
            limitChanges={limitChanges}
            activeTab={activeTab}
            resultCount={activeTab === 'sections' ? filteredSections.length : filteredForms.length}
          />
        )}

        {/* Gap Auditor intro strip */}
        {activeTab === 'gap' && (
          <div style={{
            padding: '14px 18px',
            borderRadius: 10,
            background: 'var(--teal-light)',
            border: '1px solid #b3ddd7',
            marginBottom: 20,
            fontSize: '0.85rem',
            color: 'var(--teal-dark)',
            lineHeight: 1.5,
          }}>
            <strong>6 questions · 2 minutes · personalised checklist.</strong>{' '}
            Answer the questions below and get a prioritised list of compliance gaps specific to your situation — each sourced to a CBDT notification or statutory provision.
          </div>
        )}

        {/* Category filter — sections only */}
        {activeTab === 'sections' && (
          <div style={{ margin: '16px 0' }}>
            <CategoryFilter
              active={activeCategory}
              onChange={setActiveCategory}
              counts={categoryCounts}
            />
          </div>
        )}

        {/* Disclaimer */}
        {activeTab !== 'scanner' && activeTab !== 'ask' && activeTab !== 'gap' && (
          <div style={{
            fontSize: '0.72rem',
            color: 'var(--ink-faint)',
            padding: '6px 10px',
            borderRadius: 6,
            background: 'var(--surface-3)',
            marginBottom: 16,
            lineHeight: 1.5,
          }}>
            {data.meta.disclaimer}
          </div>
        )}

        {/* Results / Scanner / Ask / Gap */}
        {activeTab === 'gap' ? (
          <GapAuditor />
        ) : activeTab === 'ask' ? (
          <AaykarMitra />
        ) : activeTab === 'scanner' ? (
          <DocumentScanner data={data} />
        ) : activeTab === 'sections' ? (
          filteredSections.length > 0 ? (
            <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredSections.map((section, i) => (
                <SectionCard key={section.id} section={section} index={i} />
              ))}
            </div>
          ) : (
            <EmptyState query={query} onSuggest={setQuery} tab="sections" />
          )
        ) : (
          filteredForms.length > 0 ? (
            <div className="stagger" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {filteredForms.map((form, i) => (
                <FormCard key={form.id} form={form} index={i} />
              ))}
            </div>
          ) : (
            <EmptyState query={query} onSuggest={setQuery} tab="forms" />
          )
        )}
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '20px',
        textAlign: 'center',
        fontSize: '0.78rem',
        color: 'var(--ink-faint)',
        background: 'var(--surface)',
      }}>
        <p style={{ margin: 0 }}>
          AaykarSetu · Data sourced from CBDT official concordance · Built for India&rsquo;s Tax Year 2026-27 transition
        </p>
        <p style={{ margin: '4px 0 0' }}>
          Always verify with a qualified CA before relying on any mapping.
        </p>
        <p style={{ margin: '8px 0 0', color: 'var(--ink-faint)' }}>
          Built by{' '}
          <span style={{ fontWeight: 500, color: 'var(--ink-muted)' }}>MSB Digital Labs</span>
          {' · '}
          <a href="/privacy" style={{ color: 'var(--ink-faint)', textDecoration: 'underline' }}>Privacy Policy</a>
        </p>
      </footer>
    </div>
  )
}

function EmptyState({ query, onSuggest, tab }: { query: string; onSuggest: (q: string) => void; tab: string }) {
  const sectionSuggestions = ['TDS', 'Deductions', 'salary', 'capital gains', '194C']
  const formSuggestions = ['Form 16', 'Form 24Q', '15G', 'ITR', 'TDS certificate']
  const suggestions = tab === 'sections' ? sectionSuggestions : formSuggestions

  return (
    <div style={{
      textAlign: 'center',
      padding: '60px 20px',
      color: 'var(--ink-muted)',
    }}>
      <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔍</div>
      <p style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--ink)', marginBottom: 6 }}>
        No results for &ldquo;{query}&rdquo;
      </p>
      <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)', marginBottom: 20 }}>
        Try a keyword, section number, or form name
      </p>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
        {suggestions.map(s => (
          <button
            key={s}
            onClick={() => onSuggest(s)}
            style={{
              fontSize: '0.8rem',
              padding: '5px 12px',
              borderRadius: 100,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--ink-muted)',
              cursor: 'pointer',
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
