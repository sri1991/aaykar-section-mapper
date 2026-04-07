'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { StreamEvent, SourceChunk } from '@/lib/rag/types'
import type { GeneratorModel } from '@/lib/rag/generator'

const EXAMPLE_QUESTIONS = [
  'What are the capital gains tax rates for listed equities under the 2025 Act?',
  'How has Section 80C been renumbered and what deductions does it now cover?',
  'What are the TDS rates for contractor payments in 2025?',
  'Explain the new default tax regime and opt-out provisions.',
  'What changed in the treatment of house property income?',
]

type Status = 'idle' | 'retrieving' | 'streaming' | 'done' | 'error'

interface Turn {
  question: string
  answer: string
  sources: SourceChunk[]
  error?: string
}

export default function AaykarMitra() {
  const [question, setQuestion] = useState('')
  const [model, setModel] = useState<GeneratorModel>('groq')
  const [status, setStatus] = useState<Status>('idle')
  const [turns, setTurns] = useState<Turn[]>([])
  const [currentAnswer, setCurrentAnswer] = useState('')
  const [currentSources, setCurrentSources] = useState<SourceChunk[]>([])
  const [expandedSource, setExpandedSource] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom as answer streams in
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [currentAnswer, turns.length])

  const handleAsk = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (!trimmed || status === 'retrieving' || status === 'streaming') return

    setQuestion('')
    setStatus('retrieving')
    setCurrentAnswer('')
    setCurrentSources([])

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed, model }),
      })

      if (!response.ok) {
        const json = await response.json() as { error?: string }
        throw new Error(json.error ?? `HTTP ${response.status}`)
      }

      if (!response.body) throw new Error('No response body')

      setStatus('streaming')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let answer = ''
      let sources: SourceChunk[] = []

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''   // keep incomplete last line

        for (const line of lines) {
          if (!line.trim()) continue
          let event: StreamEvent
          try {
            event = JSON.parse(line) as StreamEvent
          } catch {
            continue
          }

          if (event.type === 'delta') {
            answer += event.text
            setCurrentAnswer(answer)
          } else if (event.type === 'sources') {
            sources = event.chunks
            setCurrentSources(sources)
          } else if (event.type === 'error') {
            throw new Error(event.message)
          }
        }
      }

      setTurns(prev => [...prev, { question: trimmed, answer, sources }])
      setCurrentAnswer('')
      setCurrentSources([])
      setStatus('done')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong'
      setTurns(prev => [...prev, { question: trimmed, answer: '', sources: [], error: message }])
      setCurrentAnswer('')
      setCurrentSources([])
      setStatus('error')
    }
  }, [status])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleAsk(question)
    }
  }, [question, handleAsk])

  const isLoading = status === 'retrieving' || status === 'streaming'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minHeight: 400 }}>

      {/* Intro — shown only when no turns yet */}
      {turns.length === 0 && status === 'idle' && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          padding: '20px 22px',
        }}>
          <p style={{ margin: '0 0 14px', fontSize: '0.88rem', color: 'var(--ink-muted)', lineHeight: 1.6 }}>
            Ask AaykarMitra any question about the Income Tax Act 2025 in plain English.
            Answers are grounded in the actual Act text with source citations.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
              Try asking
            </div>
            {EXAMPLE_QUESTIONS.map(eq => (
              <button
                key={eq}
                onClick={() => handleAsk(eq)}
                style={{
                  textAlign: 'left',
                  background: 'var(--surface-2)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontSize: '0.84rem',
                  color: 'var(--ink-muted)',
                  cursor: 'pointer',
                  transition: 'all 0.12s',
                  lineHeight: 1.4,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--saffron)'
                  e.currentTarget.style.color = 'var(--ink)'
                  e.currentTarget.style.background = 'var(--saffron-light)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.color = 'var(--ink-muted)'
                  e.currentTarget.style.background = 'var(--surface-2)'
                }}
              >
                {eq}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Past turns */}
      {turns.map((turn, i) => (
        <TurnView
          key={i}
          turn={turn}
          expandedSource={expandedSource}
          onToggleSource={setExpandedSource}
        />
      ))}

      {/* Current streaming turn */}
      {isLoading && (
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 14,
          overflow: 'hidden',
        }}>
          {/* Question echo */}
          <div style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-2)',
            fontSize: '0.9rem',
            fontWeight: 500,
            color: 'var(--ink)',
          }}>
            {turns.length > 0
              ? turns[turns.length - 1]?.question
              : question || '…'}
          </div>

          {/* Status / answer */}
          <div style={{ padding: '18px 20px' }}>
            {status === 'retrieving' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink-muted)', fontSize: '0.88rem' }}>
                <Spinner />
                Searching the Act…
              </div>
            ) : (
              <>
                <MarkdownAnswer text={currentAnswer} streaming />
                {currentSources.length > 0 && (
                  <SourceList
                    sources={currentSources}
                    expandedSource={expandedSource}
                    onToggleSource={setExpandedSource}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div ref={bottomRef} />

      {/* Model toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--ink-faint)' }}>Model:</span>
        <div style={{ display: 'flex', gap: 3, padding: 3, background: 'var(--surface-3)', borderRadius: 8 }}>
          {(['groq', 'gemini'] as GeneratorModel[]).map(m => (
            <button
              key={m}
              onClick={() => setModel(m)}
              disabled={isLoading}
              style={{
                padding: '3px 12px',
                borderRadius: 6,
                border: 'none',
                fontSize: '0.75rem',
                fontWeight: 500,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                background: model === m ? 'var(--surface)' : 'transparent',
                color: model === m ? 'var(--ink)' : 'var(--ink-faint)',
                boxShadow: model === m ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.12s',
              }}
            >
              {m === 'groq' ? 'Groq · Llama 3.3' : 'Gemini 2.5 Flash'}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div style={{
        position: 'sticky',
        bottom: 0,
        background: 'var(--surface-2)',
        paddingTop: 12,
        paddingBottom: 4,
        marginTop: 'auto',
      }}>
        <div style={{
          display: 'flex',
          gap: 8,
          alignItems: 'flex-end',
          background: 'var(--surface)',
          border: `1.5px solid ${isLoading ? 'var(--saffron)' : 'var(--border)'}`,
          borderRadius: 14,
          padding: '10px 12px',
          transition: 'border-color 0.15s',
        }}>
          <textarea
            ref={textareaRef}
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AaykarMitra about the Income Tax Act 2025… (Enter to send, Shift+Enter for newline)"
            rows={2}
            disabled={isLoading}
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontFamily: 'var(--font-body)',
              fontSize: '0.92rem',
              color: 'var(--ink)',
              background: 'transparent',
              lineHeight: 1.6,
            }}
          />
          <button
            onClick={() => handleAsk(question)}
            disabled={!question.trim() || isLoading}
            style={{
              flexShrink: 0,
              width: 36,
              height: 36,
              borderRadius: 9,
              border: 'none',
              background: question.trim() && !isLoading ? 'var(--saffron)' : 'var(--surface-3)',
              color: question.trim() && !isLoading ? 'white' : 'var(--ink-faint)',
              cursor: question.trim() && !isLoading ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.12s',
            }}
          >
            {isLoading
              ? <Spinner size={14} color="var(--ink-faint)" />
              : <SendIcon />}
          </button>
        </div>
        <p style={{ fontSize: '0.72rem', color: 'var(--ink-faint)', margin: '6px 4px 0', textAlign: 'center' }}>
          AaykarMitra · Answers grounded in IT Act 2025 text. Always verify with a qualified CA.
        </p>
      </div>
    </div>
  )
}

// ─── Turn view ────────────────────────────────────────────────────────────────

function TurnView({
  turn,
  expandedSource,
  onToggleSource,
}: {
  turn: Turn
  expandedSource: string | null
  onToggleSource: (id: string | null) => void
}) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      overflow: 'hidden',
    }}>
      {/* Question */}
      <div style={{
        padding: '14px 20px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface-2)',
        fontSize: '0.9rem',
        fontWeight: 500,
        color: 'var(--ink)',
      }}>
        {turn.question}
      </div>

      {/* Answer or error */}
      <div style={{ padding: '18px 20px' }}>
        {turn.error ? (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: '0.87rem',
            color: '#b91c1c',
          }}>
            {turn.error}
          </div>
        ) : (
          <>
            <MarkdownAnswer text={turn.answer} />
            {turn.sources.length > 0 && (
              <SourceList
                sources={turn.sources}
                expandedSource={expandedSource}
                onToggleSource={onToggleSource}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Markdown answer renderer ─────────────────────────────────────────────────
// Minimal markdown: bold, bullets, inline code, line breaks.
// Avoids importing a full markdown library.

function MarkdownAnswer({ text, streaming }: { text: string; streaming?: boolean }) {
  if (!text) return null

  // Split into paragraphs / bullet blocks
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let key = 0

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      elements.push(<div key={key++} style={{ height: 6 }} />)
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      elements.push(
        <div key={key++} style={{ display: 'flex', gap: 8, marginBottom: 2 }}>
          <span style={{ color: 'var(--saffron)', flexShrink: 0, marginTop: 2 }}>•</span>
          <span>{renderInline(trimmed.slice(2))}</span>
        </div>
      )
    } else {
      elements.push(<p key={key++} style={{ margin: '0 0 4px', lineHeight: 1.7 }}>{renderInline(trimmed)}</p>)
    }
  }

  return (
    <div style={{ fontSize: '0.92rem', color: 'var(--ink)', lineHeight: 1.7 }}>
      {elements}
      {streaming && (
        <span style={{
          display: 'inline-block',
          width: 2,
          height: '1em',
          background: 'var(--saffron)',
          marginLeft: 2,
          verticalAlign: 'text-bottom',
          animation: 'blink 1s step-end infinite',
        }} />
      )}
    </div>
  )
}

function renderInline(text: string): React.ReactNode {
  // Bold: **text**
  // Code: `text`
  // [SOURCE N] citations — rendered as orange badge
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[SOURCE \d+\])/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85em', background: 'var(--surface-3)', padding: '1px 4px', borderRadius: 3 }}>
          {part.slice(1, -1)}
        </code>
      )
    }
    if (/^\[SOURCE \d+\]$/.test(part)) {
      const num = part.match(/\d+/)?.[0]
      return (
        <span key={i} style={{
          display: 'inline-flex',
          alignItems: 'center',
          fontSize: '0.72em',
          fontWeight: 600,
          background: 'var(--saffron-light)',
          color: 'var(--saffron-dark)',
          borderRadius: 4,
          padding: '0 5px',
          margin: '0 2px',
          verticalAlign: 'middle',
          border: '1px solid',
          borderColor: 'var(--saffron)',
        }}>
          ↗ {num}
        </span>
      )
    }
    return part
  })
}

// ─── Source list ──────────────────────────────────────────────────────────────

function SourceList({
  sources,
  expandedSource,
  onToggleSource,
}: {
  sources: SourceChunk[]
  expandedSource: string | null
  onToggleSource: (id: string | null) => void
}) {
  return (
    <div style={{ marginTop: 20, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
      <div style={{ fontSize: '0.73rem', fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
        Sources
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {sources.map((source, i) => {
          const isOpen = expandedSource === source.id
          return (
            <div
              key={source.id}
              style={{
                border: '1px solid var(--border)',
                borderRadius: 8,
                overflow: 'hidden',
                background: isOpen ? 'var(--surface-2)' : 'var(--surface)',
              }}
            >
              <button
                onClick={() => onToggleSource(isOpen ? null : source.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 12px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                <span style={{
                  flexShrink: 0,
                  width: 20,
                  height: 20,
                  borderRadius: 4,
                  background: 'var(--saffron-light)',
                  color: 'var(--saffron-dark)',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {i + 1}
                </span>
                <span style={{ flex: 1, fontSize: '0.82rem', color: 'var(--ink)', fontWeight: 500, lineHeight: 1.3 }}>
                  {source.hierarchy_path}
                </span>
                <span style={{ fontSize: '0.73rem', color: 'var(--ink-faint)', flexShrink: 0 }}>
                  p. {source.page_start}
                </span>
                <span style={{ fontSize: '0.73rem', color: 'var(--ink-faint)', flexShrink: 0, marginLeft: 2 }}>
                  {isOpen ? '▲' : '▼'}
                </span>
              </button>

              {isOpen && (
                <div style={{
                  padding: '0 12px 12px',
                  borderTop: '1px solid var(--border)',
                  fontSize: '0.82rem',
                  color: 'var(--ink-muted)',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                }}>
                  <div style={{ paddingTop: 10 }}>{source.text}</div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Icons / micro-components ─────────────────────────────────────────────────

function Spinner({ size = 16, color = 'var(--saffron)' }: { size?: number; color?: string }) {
  return (
    <span style={{
      display: 'inline-block',
      width: size,
      height: size,
      border: `2px solid ${color}`,
      borderTopColor: 'transparent',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  )
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}
