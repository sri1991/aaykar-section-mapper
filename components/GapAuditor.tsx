'use client'

import { useState } from 'react'
import {
  generateGapChecklist,
  type GapAuditAnswers,
  type GapItem,
  type BusinessType,
  type Headcount,
  type DeductionType,
  type TaxRegime,
} from '@/lib/gap-auditor-rules'

const QUESTIONS = [
  {
    id: 'businessType',
    label: 'What is your business structure?',
    sub: 'This determines your audit, MAT, and filing obligations.',
  },
  {
    id: 'headcount',
    label: 'How many employees do you have?',
    sub: 'Includes full-time, part-time, and contractual staff on payroll.',
  },
  {
    id: 'filesTDS',
    label: 'Do you currently file TDS returns?',
    sub: 'Quarterly Form 24Q (salary) or Form 26Q (non-salary payments).',
  },
  {
    id: 'deductions',
    label: 'Which deductions are you or your employees currently claiming?',
    sub: 'Select all that apply.',
  },
  {
    id: 'foreignIncome',
    label: 'Do you or your entity have foreign income or assets?',
    sub: 'Includes foreign bank accounts, investments, ESOPs, property, or overseas business income.',
  },
  {
    id: 'taxRegime',
    label: 'Which tax regime are your employees on?',
    sub: 'If no employees, select N/A.',
  },
]

const SEVERITY_CONFIG = {
  high: { label: 'High priority', color: '#c0392b', bg: '#fdf2f2', border: '#f5c6c6' },
  medium: { label: 'Review needed', color: '#b85f25', bg: '#fdf5ee', border: '#f5d5b8' },
  low: { label: 'Good to know', color: '#1d7a6e', bg: '#e6f4f1', border: '#b3ddd7' },
}

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: '0.72rem',
        color: 'var(--ink-faint)',
        marginBottom: 6,
      }}>
        <span>Question {step} of {total}</span>
        <span>{Math.round((step / total) * 100)}% complete</span>
      </div>
      <div style={{
        height: 4,
        background: 'var(--surface-3)',
        borderRadius: 100,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${(step / total) * 100}%`,
          background: 'var(--teal)',
          borderRadius: 100,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  )
}

function OptionButton({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 16px',
        borderRadius: 10,
        border: `1.5px solid ${selected ? 'var(--teal)' : 'var(--border)'}`,
        background: selected ? 'var(--teal-light)' : 'var(--surface)',
        color: selected ? 'var(--teal-dark)' : 'var(--ink)',
        cursor: 'pointer',
        fontSize: '0.9rem',
        fontWeight: selected ? 600 : 400,
        textAlign: 'left',
        transition: 'all 0.15s',
        width: '100%',
      }}
    >
      <span style={{
        width: 18,
        height: 18,
        borderRadius: '50%',
        border: `2px solid ${selected ? 'var(--teal)' : 'var(--border)'}`,
        background: selected ? 'var(--teal)' : 'transparent',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {selected && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </span>
      {label}
    </button>
  )
}

function CheckboxButton({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '11px 16px',
        borderRadius: 10,
        border: `1.5px solid ${selected ? 'var(--teal)' : 'var(--border)'}`,
        background: selected ? 'var(--teal-light)' : 'var(--surface)',
        color: selected ? 'var(--teal-dark)' : 'var(--ink)',
        cursor: 'pointer',
        fontSize: '0.9rem',
        fontWeight: selected ? 600 : 400,
        textAlign: 'left',
        transition: 'all 0.15s',
        width: '100%',
      }}
    >
      <span style={{
        width: 17,
        height: 17,
        borderRadius: 4,
        border: `2px solid ${selected ? 'var(--teal)' : 'var(--border)'}`,
        background: selected ? 'var(--teal)' : 'transparent',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {selected && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </span>
      {label}
    </button>
  )
}

function GapCard({ item, index }: { item: GapItem; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = SEVERITY_CONFIG[item.severity]

  return (
    <div style={{
      border: `1px solid ${cfg.border}`,
      borderRadius: 12,
      background: cfg.bg,
      overflow: 'hidden',
    }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: '16px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{
          minWidth: 24,
          height: 24,
          borderRadius: '50%',
          background: cfg.color,
          color: '#fff',
          fontSize: '0.7rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 1,
        }}>
          {index + 1}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: '0.72rem',
            fontWeight: 600,
            color: cfg.color,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            marginBottom: 3,
          }}>
            {cfg.label}
          </div>
          <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>
            {item.title}
          </div>
        </div>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--ink-faint)"
          strokeWidth="2"
          style={{
            flexShrink: 0,
            marginTop: 4,
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        >
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {expanded && (
        <div style={{ padding: '0 16px 16px 52px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--ink)', lineHeight: 1.6 }}>
            {item.description}
          </p>
          <div style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: 'rgba(255,255,255,0.7)',
            border: '1px solid rgba(0,0,0,0.06)',
          }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--ink-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>
              Action
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--ink)', lineHeight: 1.6 }}>
              {item.action}
            </p>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--ink-faint)', lineHeight: 1.5 }}>
            <span style={{ fontWeight: 600 }}>Source: </span>{item.source}
            {item.new_ref && (
              <span style={{
                marginLeft: 8,
                padding: '1px 7px',
                borderRadius: 100,
                background: 'var(--teal-light)',
                color: 'var(--teal-dark)',
                fontFamily: 'var(--font-mono)',
                fontSize: '0.68rem',
              }}>
                {item.new_ref}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function GapAuditor() {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<GapAuditAnswers>({
    businessType: null,
    headcount: null,
    filesTDS: null,
    deductions: [],
    foreignIncome: null,
    taxRegime: null,
  })
  const [results, setResults] = useState<GapItem[] | null>(null)

  const total = QUESTIONS.length

  function canAdvance(): boolean {
    if (step === 0) return answers.businessType !== null
    if (step === 1) return answers.headcount !== null
    if (step === 2) return answers.filesTDS !== null
    if (step === 3) return true // deductions are optional
    if (step === 4) return answers.foreignIncome !== null
    if (step === 5) return answers.taxRegime !== null
    return false
  }

  function advance() {
    if (step < total - 1) {
      setStep(s => s + 1)
    } else {
      setResults(generateGapChecklist(answers))
    }
  }

  function reset() {
    setStep(0)
    setAnswers({
      businessType: null,
      headcount: null,
      filesTDS: null,
      deductions: [],
      foreignIncome: null,
      taxRegime: null,
    })
    setResults(null)
  }

  function toggleDeduction(d: DeductionType) {
    setAnswers(a => ({
      ...a,
      deductions: a.deductions.includes(d)
        ? a.deductions.filter(x => x !== d)
        : [...a.deductions, d],
    }))
  }

  if (results !== null) {
    const highCount = results.filter(r => r.severity === 'high').length
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Summary header */}
        <div style={{
          padding: '20px 24px',
          borderRadius: 12,
          background: highCount > 0
            ? 'linear-gradient(135deg, #fdf2f2 0%, #fdf5ee 100%)'
            : 'linear-gradient(135deg, #e6f4f1 0%, #f0faf8 100%)',
          border: `1px solid ${highCount > 0 ? '#f5c6c6' : '#b3ddd7'}`,
        }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 6 }}>
            Your compliance gap report · Tax Year 2026-27
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>
            {results.length} gap{results.length !== 1 ? 's' : ''} identified
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {(['high', 'medium', 'low'] as const).map(sev => {
              const count = results.filter(r => r.severity === sev).length
              if (!count) return null
              const cfg = SEVERITY_CONFIG[sev]
              return (
                <span key={sev} style={{
                  fontSize: '0.8rem',
                  color: cfg.color,
                  fontWeight: 600,
                }}>
                  {count} {cfg.label.toLowerCase()}
                </span>
              )
            })}
          </div>
        </div>

        {/* Disclaimer */}
        <div style={{
          fontSize: '0.72rem',
          color: 'var(--ink-faint)',
          padding: '8px 12px',
          borderRadius: 6,
          background: 'var(--surface-3)',
          lineHeight: 1.5,
        }}>
          Every gap is sourced to a specific statutory provision or CBDT notification. Always verify with a qualified CA before acting. This is not legal or tax advice.
        </div>

        {/* Gap cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {results.map((item, i) => (
            <GapCard key={item.id} item={item} index={i} />
          ))}
        </div>

        <button
          onClick={reset}
          style={{
            alignSelf: 'flex-start',
            padding: '9px 18px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--ink-muted)',
            cursor: 'pointer',
            fontSize: '0.85rem',
            marginTop: 4,
          }}
        >
          ← Start over
        </button>
      </div>
    )
  }

  const q = QUESTIONS[step]

  return (
    <div style={{ maxWidth: 620 }}>
      <ProgressBar step={step + 1} total={total} />

      {/* Question card */}
      <div style={{
        background: 'var(--surface)',
        borderRadius: 14,
        border: '1px solid var(--border)',
        padding: '28px 24px',
        marginBottom: 16,
      }}>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--ink)', margin: '0 0 4px' }}>
            {q.label}
          </h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', margin: 0 }}>{q.sub}</p>
        </div>

        {/* Q1: Business type */}
        {step === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {([
              ['sole_proprietor', 'Sole Proprietor'],
              ['partnership', 'Partnership Firm'],
              ['pvt_ltd', 'Private Limited Company'],
              ['llp', 'LLP'],
              ['other', 'Other'],
            ] as [BusinessType, string][]).map(([val, label]) => (
              <OptionButton
                key={val}
                label={label}
                selected={answers.businessType === val}
                onClick={() => setAnswers(a => ({ ...a, businessType: val }))}
              />
            ))}
          </div>
        )}

        {/* Q2: Headcount */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {([
              ['none', 'No employees (0)'],
              ['small', '1 – 10 employees'],
              ['medium', '11 – 50 employees'],
              ['large', '50+ employees'],
            ] as [Headcount, string][]).map(([val, label]) => (
              <OptionButton
                key={val}
                label={label}
                selected={answers.headcount === val}
                onClick={() => setAnswers(a => ({ ...a, headcount: val }))}
              />
            ))}
          </div>
        )}

        {/* Q3: Files TDS */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <OptionButton
              label="Yes — we file TDS returns regularly"
              selected={answers.filesTDS === true}
              onClick={() => setAnswers(a => ({ ...a, filesTDS: true }))}
            />
            <OptionButton
              label="No — we don't file TDS returns"
              selected={answers.filesTDS === false}
              onClick={() => setAnswers(a => ({ ...a, filesTDS: false }))}
            />
          </div>
        )}

        {/* Q4: Deductions (multi-select) */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ margin: '0 0 8px', fontSize: '0.78rem', color: 'var(--ink-faint)' }}>
              Select all that apply — or skip if none.
            </p>
            {([
              ['80C', '80C — ELSS, PPF, LIC, home loan principal'],
              ['80D', '80D — Health insurance premium'],
              ['HRA', 'HRA — House Rent Allowance'],
              ['LTA', 'LTA — Leave Travel Allowance'],
              ['NPS', 'NPS — National Pension System'],
              ['other', 'Other deductions'],
            ] as [DeductionType, string][]).map(([val, label]) => (
              <CheckboxButton
                key={val}
                label={label}
                selected={answers.deductions.includes(val)}
                onClick={() => toggleDeduction(val)}
              />
            ))}
          </div>
        )}

        {/* Q5: Foreign income */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <OptionButton
              label="Yes — foreign income or assets exist"
              selected={answers.foreignIncome === true}
              onClick={() => setAnswers(a => ({ ...a, foreignIncome: true }))}
            />
            <OptionButton
              label="No — income and assets are entirely domestic"
              selected={answers.foreignIncome === false}
              onClick={() => setAnswers(a => ({ ...a, foreignIncome: false }))}
            />
          </div>
        )}

        {/* Q6: Tax regime */}
        {step === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {([
              ['old', 'Old regime — claiming deductions like 80C, HRA, LTA'],
              ['new', 'New regime — lower slab rates, fewer deductions'],
              ['mixed', 'Mixed — some employees on old, some on new'],
              ['na', 'N/A — no employees'],
            ] as [TaxRegime, string][]).map(([val, label]) => (
              <OptionButton
                key={val}
                label={label}
                selected={answers.taxRegime === val}
                onClick={() => setAnswers(a => ({ ...a, taxRegime: val }))}
              />
            ))}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {step > 0 && (
          <button
            onClick={() => setStep(s => s - 1)}
            style={{
              padding: '10px 18px',
              borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--ink-muted)',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            ← Back
          </button>
        )}
        <button
          onClick={advance}
          disabled={!canAdvance()}
          style={{
            padding: '10px 24px',
            borderRadius: 8,
            border: 'none',
            background: canAdvance() ? 'var(--teal)' : 'var(--surface-3)',
            color: canAdvance() ? '#fff' : 'var(--ink-faint)',
            cursor: canAdvance() ? 'pointer' : 'not-allowed',
            fontSize: '0.875rem',
            fontWeight: 600,
            transition: 'all 0.15s',
          }}
        >
          {step === total - 1 ? 'Generate my checklist →' : 'Next →'}
        </button>
      </div>
    </div>
  )
}
