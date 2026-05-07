'use client'

import { useState, useCallback } from 'react'
import type { ImpactItem, ExtractionConfidence } from '@/app/api/scan-impact/route'

interface Props {
  documentText: string
  flaggedSectionIds: string[]
}

type LoadState = 'idle' | 'loading' | 'done' | 'error'

function formatINR(n: number): string {
  return '₹' + Math.abs(n).toLocaleString('en-IN')
}

function deltaLabel(item: ImpactItem): { text: string; color: string } | null {
  if (item.delta == null) return null

  if (item.impact_category === 'deduction' || item.impact_category === 'exemption') {
    if (item.delta > 0) return { text: `+${formatINR(item.delta)} additional deduction available`, color: '#15803d' }
    if (item.delta < 0) return { text: `${formatINR(item.delta)} deduction reduced`, color: '#b91c1c' }
  }
  if (item.impact_category === 'tds_threshold') {
    if (item.delta > 0) return { text: `TDS threshold raised by ${formatINR(item.delta)} — review past deductions`, color: '#1d4ed8' }
  }
  if (item.impact_category === 'tcs_threshold') {
    if (item.delta > 0) return { text: `TCS threshold raised by ${formatINR(item.delta)}`, color: '#1d4ed8' }
  }
  if (item.impact_category === 'rebate') {
    if (item.delta > 0) return { text: `Rebate income threshold raised from ${formatINR(item.old_limit!)} to ${formatINR(item.new_limit!)}`, color: '#15803d' }
  }
  return null
}

function categoryLabel(cat: string | null): string {
  switch (cat) {
    case 'deduction': return 'Deduction'
    case 'exemption': return 'Exemption'
    case 'rebate': return 'Rebate'
    case 'tds_threshold': return 'TDS Threshold'
    case 'tcs_threshold': return 'TCS Threshold'
    case 'audit_threshold': return 'Audit Threshold'
    case 'rate': return 'Rate Change'
    default: return 'Change'
  }
}

const CONFIDENCE_CONFIG: Record<ExtractionConfidence, {
  dot: string
  label: string
  hint: string
  cardBorder: string
}> = {
  high:   { dot: '#16a34a', label: 'Cross-validated',          hint: 'Amount matches a known statutory limit.',              cardBorder: '#86efac' },
  medium: { dot: '#d97706', label: 'Please verify this figure', hint: 'AI found an amount — confirm it matches your document.', cardBorder: '#fcd34d' },
  low:    { dot: '#dc2626', label: 'Amount not found',          hint: 'No amount detected. Enter manually if applicable.',    cardBorder: '#fca5a5' },
  failed: { dot: '#dc2626', label: 'Extraction failed',         hint: 'AI call failed. Enter figures manually.',              cardBorder: '#fca5a5' },
}

function ConfidenceBadge({ confidence }: { confidence: ExtractionConfidence }) {
  const cfg = CONFIDENCE_CONFIG[confidence]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
      <span style={{
        display: 'inline-block', width: 7, height: 7,
        borderRadius: '50%', background: cfg.dot, flexShrink: 0,
      }} />
      <span style={{ fontSize: '0.76rem', fontWeight: 600, color: cfg.dot }}>
        {cfg.label}
      </span>
      <span style={{ fontSize: '0.74rem', color: 'var(--ink-faint)' }}>
        — {cfg.hint}
      </span>
    </div>
  )
}

export default function ImpactPanel({ documentText, flaggedSectionIds }: Props) {
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [items, setItems]         = useState<ImpactItem[]>([])
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set())
  const [errorMsg, setErrorMsg]   = useState<string | null>(null)

  const runAnalysis = useCallback(async () => {
    setLoadState('loading')
    setErrorMsg(null)
    try {
      const res = await fetch('/api/scan-impact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: documentText, flagged_section_ids: flaggedSectionIds }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }
      const { items: fetched } = await res.json() as { items: ImpactItem[] }
      setItems(fetched)
      setConfirmed(new Set()) // nothing confirmed until CA explicitly clicks
      setLoadState('done')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Analysis failed')
      setLoadState('error')
    }
  }, [documentText, flaggedSectionIds])

  const toggleConfirmed = useCallback((id: string) => {
    setConfirmed(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  // Net benefit only across CA-confirmed deduction/exemption items
  const netDeductionDelta = items
    .filter(i => confirmed.has(i.section_id) && (i.impact_category === 'deduction' || i.impact_category === 'exemption') && i.delta != null)
    .reduce((sum, i) => sum + (i.delta ?? 0), 0)

  const confirmedDeductionCount = items.filter(
    i => confirmed.has(i.section_id) && (i.impact_category === 'deduction' || i.impact_category === 'exemption')
  ).length

  if (loadState === 'idle') {
    return (
      <div style={{
        background: '#fffbeb', border: '1px solid #f59e0b',
        borderRadius: 14, padding: '18px 22px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#92400e', marginBottom: 4 }}>
              Limit changes detected in this document
            </div>
            <div style={{ fontSize: '0.82rem', color: '#b45309', lineHeight: 1.5 }}>
              Analyse how the new Act limits affect this client — extract amounts and compute net impact.
            </div>
          </div>
          <button
            onClick={runAnalysis}
            style={{
              padding: '10px 22px', background: '#f59e0b', color: 'white',
              border: 'none', borderRadius: 9, fontFamily: 'var(--font-body)',
              fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#d97706' }}
            onMouseLeave={e => { e.currentTarget.style.background = '#f59e0b' }}
          >
            Analyse client impact
          </button>
        </div>
        {/* Privacy disclosure */}
        <div style={{
          borderTop: '1px solid #fde68a', paddingTop: 10,
          fontSize: '0.74rem', color: '#92400e', lineHeight: 1.5,
        }}>
          Your document text is sent to the Google Gemini API for amount extraction.
          Google does not train on API inputs. No data is stored after processing.
          Do not use this feature if your firm's policy prohibits sending client data to third-party cloud services.
        </div>
      </div>
    )
  }

  if (loadState === 'loading') {
    return (
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '22px 24px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{
          display: 'inline-block', width: 16, height: 16,
          border: '2px solid #f59e0b', borderTopColor: 'transparent',
          borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0,
        }} />
        <span style={{ fontSize: '0.88rem', color: 'var(--ink-muted)' }}>
          Extracting amounts and computing impact…
        </span>
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div style={{
        background: '#fef2f2', border: '1px solid #fca5a5',
        borderRadius: 14, padding: '18px 22px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '0.87rem', color: '#b91c1c' }}>{errorMsg}</span>
        <button
          onClick={runAnalysis}
          style={{ fontSize: '0.82rem', padding: '6px 14px', background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', borderRadius: 7, cursor: 'pointer' }}
        >
          Retry
        </button>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 22px' }}>
        <span style={{ fontSize: '0.87rem', color: 'var(--ink-muted)' }}>No impactable limit changes found in this document.</span>
      </div>
    )
  }

  const needsAttention = items.filter(i => i.confidence === 'medium' || i.confidence === 'low' || i.confidence === 'failed').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 14, padding: '18px 22px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--ink)', marginBottom: 4 }}>
            Client Impact Report
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
            {items.length} limit change{items.length !== 1 ? 's' : ''} found
            {needsAttention > 0 && (
              <span style={{ color: '#d97706', fontWeight: 600 }}>
                {' '}· {needsAttention} item{needsAttention !== 1 ? 's' : ''} need your review
              </span>
            )}
          </div>
        </div>
        {netDeductionDelta !== 0 && (
          <div style={{
            background: netDeductionDelta > 0 ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${netDeductionDelta > 0 ? '#86efac' : '#fca5a5'}`,
            borderRadius: 10, padding: '10px 18px', textAlign: 'right',
          }}>
            <div style={{ fontSize: '0.72rem', color: 'var(--ink-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
              Net deduction change
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.1rem', color: netDeductionDelta > 0 ? '#15803d' : '#b91c1c' }}>
              {netDeductionDelta > 0 ? '+' : ''}{formatINR(netDeductionDelta)}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', marginTop: 2 }}>
              across {confirmedDeductionCount} confirmed item{confirmedDeductionCount !== 1 ? 's' : ''}
            </div>
          </div>
        )}
      </div>

      {/* Item cards */}
      {items.map(item => {
        const isConfirmed = confirmed.has(item.section_id)
        const cfg = CONFIDENCE_CONFIG[item.confidence] ?? CONFIDENCE_CONFIG['medium']
        const dl = deltaLabel(item)

        return (
          <div
            key={item.section_id}
            style={{
              background: 'var(--surface)',
              border: `1px solid ${isConfirmed ? '#86efac' : cfg.cardBorder}`,
              borderRadius: 12, padding: '16px 20px',
              transition: 'border-color 0.15s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                {/* Section heading */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--ink)' }}>
                    {item.old_ref}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--ink-faint)' }}>→</span>
                  <span style={{ fontWeight: 500, fontSize: '0.82rem', color: 'var(--ink-muted)' }}>
                    {item.new_ref}
                  </span>
                  <span style={{
                    fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                    background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
                    borderRadius: 5, padding: '2px 7px',
                  }}>
                    {categoryLabel(item.impact_category)}
                  </span>
                </div>

                {/* Confidence signal */}
                <ConfidenceBadge confidence={item.confidence} />

                {/* Limit change */}
                {item.old_limit != null && item.new_limit != null && (
                  <div style={{ fontSize: '0.82rem', color: 'var(--ink-muted)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', color: '#b91c1c', textDecoration: 'line-through' }}>{formatINR(item.old_limit)}</span>
                    <span style={{ color: 'var(--ink-faint)' }}>→</span>
                    <span style={{ fontFamily: 'var(--font-mono)', color: '#15803d', fontWeight: 600 }}>{formatINR(item.new_limit)}</span>
                  </div>
                )}

                {/* Extracted amount */}
                {item.extracted_amount != null && (
                  <div style={{
                    background: '#fffbeb', border: '1px solid #fde68a',
                    borderRadius: 7, padding: '7px 11px', marginBottom: 6,
                    fontSize: '0.8rem', color: '#92400e',
                  }}>
                    <span style={{ fontWeight: 600 }}>Found in document: </span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{formatINR(item.extracted_amount)}</span>
                    {item.context_snippet && (
                      <div style={{ marginTop: 4, fontSize: '0.75rem', color: '#b45309', fontStyle: 'italic', lineHeight: 1.4 }}>
                        "{item.context_snippet}"
                      </div>
                    )}
                  </div>
                )}

                {/* Delta */}
                {dl && (
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: dl.color, marginBottom: 4 }}>
                    {dl.text}
                  </div>
                )}

                {/* Note */}
                <div style={{ fontSize: '0.77rem', color: 'var(--ink-faint)', lineHeight: 1.5 }}>
                  {item.limit_changed_note}
                </div>
              </div>

              {/* Confirm button — CA must explicitly act */}
              <button
                onClick={() => toggleConfirmed(item.section_id)}
                style={{
                  padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
                  fontSize: '0.78rem', fontWeight: 600, flexShrink: 0,
                  background: isConfirmed ? '#f0fdf4' : 'var(--surface-3)',
                  border: `1px solid ${isConfirmed ? '#86efac' : 'var(--border)'}`,
                  color: isConfirmed ? '#15803d' : 'var(--ink-muted)',
                  transition: 'all 0.15s',
                }}
              >
                {isConfirmed ? '✓ Confirmed' : 'Confirm figure'}
              </button>
            </div>
          </div>
        )
      })}

      <p style={{ fontSize: '0.72rem', color: 'var(--ink-faint)', margin: 0, lineHeight: 1.5 }}>
        Amounts extracted by AI — confirm each figure against the source document before advising clients.
        Net deduction total includes only items you have explicitly confirmed.
      </p>
    </div>
  )
}
