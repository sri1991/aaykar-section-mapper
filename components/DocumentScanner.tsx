'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { MappingData } from '@/lib/types'
import { processText, type TextSegment, type ScanStats } from '@/lib/scanner'
import { openPrintWindow, downloadDocx } from '@/lib/document-export'
import ImpactPanel from '@/components/ImpactPanel'

interface Props {
  data: MappingData
}

type InputMode = 'paste' | 'upload'
type FileType = 'pdf' | 'docx' | null

const STYLES = {
  'term-replaced':  { bg: '#e6f4f1', border: '#1d7a6e', text: '#155f55', label: 'Term updated' },
  'term-ambiguous': { bg: '#fdf0e7', border: '#e07b39', text: '#b85f25', label: 'Review needed' },
  'section-mapped': { bg: '#eff6ff', border: '#3b82f6', text: '#1d4ed8', label: 'Section remapped' },
  'limit-warning':  { bg: '#fffbeb', border: '#f59e0b', text: '#b45309', label: 'Limit may have changed' },
} as const

const ACCEPTED_STYLE  = { bg: '#f0fdf4', border: '#22c55e', text: '#15803d' }
const REJECTED_STYLE  = { bg: '#f9fafb', border: '#d1d5db', text: '#9ca3af' }

// Auto-accept confident changes, leave ambiguous ones pending
function initAccepted(segments: TextSegment[]): Map<number, boolean> {
  const map = new Map<number, boolean>()
  segments.forEach((seg, i) => {
    if (!seg.type) return
    map.set(i, seg.type === 'term-replaced' || seg.type === 'section-mapped')
  })
  return map
}


export default function DocumentScanner({ data }: Props) {
  const [inputMode, setInputMode]     = useState<InputMode>('paste')
  const [pasteText, setPasteText]     = useState('')
  const [fileName, setFileName]       = useState<string | null>(null)
  const [fileType, setFileType]       = useState<FileType>(null)
  const [extractedText, setExtracted] = useState<string | null>(null)
  const [scanning, setScanning]       = useState(false)
  const [segments, setSegments]             = useState<TextSegment[] | null>(null)
  const [stats, setStats]                   = useState<ScanStats | null>(null)
  const [flaggedSectionIds, setFlaggedIds]  = useState<string[]>([])
  const [accepted, setAccepted]             = useState<Map<number, boolean>>(new Map())
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [ocrProgress, setOcrProgress] = useState<string | null>(null)
  const [tooltip, setTooltip]         = useState<{ text: string; x: number; y: number } | null>(null)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragCounterRef = useRef(0)

  useEffect(() => {
    const hide = () => setTooltip(null)
    window.addEventListener('scroll', hide, true)
    return () => window.removeEventListener('scroll', hide, true)
  }, [])

  // Auto-scan the moment text-based extraction completes — no manual button click needed
  useEffect(() => {
    if (!extractedText || extractedText.trim().length <= 10) return
    setScanning(true)
    const timer = setTimeout(() => {
      const result = processText(extractedText, data)
      setSegments(result.segments)
      setStats(result.stats)
      setFlaggedIds(result.flaggedSectionIds)
      setAccepted(initAccepted(result.segments))
      setScanning(false)
    }, 30)
    return () => clearTimeout(timer)
  }, [extractedText, data])

  const handleFileUpload = useCallback(async (file: File) => {
    const name = file.name.toLowerCase()
    if (!name.endsWith('.docx') && !name.endsWith('.pdf')) {
      alert('Only .docx and .pdf files are supported.')
      return
    }
    const type: FileType = name.endsWith('.pdf') ? 'pdf' : 'docx'
    setFileName(file.name)
    setFileType(type)
    setExtracted(null)
    setSegments(null)
    setStats(null)
    setFlaggedIds([])
    setAccepted(new Map())
    setUploadError(null)
    setOcrProgress(null)

    try {
      const buffer = await file.arrayBuffer()

      if (type === 'pdf') {
        if (!(window as unknown as Record<string, unknown>).pdfjsLib) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script')
            script.src = '/pdf.min.js'
            script.onload = () => resolve()
            script.onerror = () => reject(new Error('Failed to load PDF engine.'))
            document.head.appendChild(script)
          })
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const pdfjsLib = (window as any).pdfjsLib
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
        const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise
        const pages: string[] = []
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const content = await page.getTextContent()
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pageText = content.items.map((item: any) => item.str ?? '').join(' ')
          pages.push(pageText)
        }
        const directText = pages.join('\n\n')

        if (directText.trim().length > 10) {
          setExtracted(directText)
        } else {
          setOcrProgress('Starting OCR engine…')
          const { createWorker } = await import('tesseract.js')
          const worker = await createWorker('eng', 1, {
            workerPath: '/tesseract-worker.min.js',
            corePath: '/tesseract-core-lstm.wasm.js',
            workerBlobURL: false,
            logger: () => {},
          })
          const ocrPages: string[] = []
          for (let i = 1; i <= pdf.numPages; i++) {
            setOcrProgress(`OCR: page ${i} of ${pdf.numPages}…`)
            const page = await pdf.getPage(i)
            const viewport = page.getViewport({ scale: 2.0 })
            const canvas = document.createElement('canvas')
            canvas.width = viewport.width
            canvas.height = viewport.height
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await page.render({ canvasContext: canvas.getContext('2d') as any, viewport }).promise
            const { data: { text } } = await worker.recognize(canvas)
            ocrPages.push(text)
          }
          await worker.terminate()
          setOcrProgress(null)
          setExtracted(ocrPages.join('\n\n'))
        }
      } else {
        const mammoth = await import('mammoth')
        const result = await mammoth.extractRawText({ arrayBuffer: buffer })
        setExtracted(result.value)
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to extract text from file.')
      setFileName(null)
      setFileType(null)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current = 0
    setIsDraggingOver(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      setInputMode('upload')
      handleFileUpload(file)
    }
  }, [handleFileUpload])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current += 1
    setIsDraggingOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current -= 1
    if (dragCounterRef.current === 0) setIsDraggingOver(false)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const handleScan = useCallback(() => {
    const text = inputMode === 'paste' ? pasteText : (extractedText ?? '')
    if (!text.trim()) return
    setScanning(true)
    setTimeout(() => {
      const result = processText(text, data)
      setSegments(result.segments)
      setStats(result.stats)
      setFlaggedIds(result.flaggedSectionIds)
      setAccepted(initAccepted(result.segments))
      setScanning(false)
    }, 30)
  }, [inputMode, pasteText, extractedText, data])

  const toggleAccepted = useCallback((i: number) => {
    setAccepted(prev => {
      const next = new Map(prev)
      next.set(i, !next.get(i))
      return next
    })
  }, [])

  const acceptAll = useCallback(() => {
    setAccepted(prev => {
      const next = new Map(prev)
      for (const k of next.keys()) next.set(k, true)
      return next
    })
  }, [])

  const rejectAll = useCallback(() => {
    setAccepted(prev => {
      const next = new Map(prev)
      for (const k of next.keys()) next.set(k, false)
      return next
    })
  }, [])

  const handleDownload = useCallback(async (format: 'pdf' | 'docx', mode: 'clean' | 'redline') => {
    if (!segments) return
    if (format === 'pdf') openPrintWindow(segments, accepted, mode, fileName)
    else await downloadDocx(segments, accepted, mode, fileName)
  }, [segments, accepted, fileName])

  const activeText = inputMode === 'paste' ? pasteText : (extractedText ?? '')
  const canScan = activeText.trim().length > 10 && !scanning

  const annotatedCount = accepted.size
  const approvedCount  = [...accepted.values()].filter(Boolean).length
  const pendingCount   = [...accepted.values()].filter(v => !v).length

  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'relative' }}
      onDrop={handleDrop}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
    >
      {isDraggingOver && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 50, borderRadius: 14,
          border: '2px dashed var(--saffron)', background: 'rgba(245,158,11,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            background: 'var(--saffron)', color: 'white', borderRadius: 10,
            padding: '12px 24px', fontWeight: 700, fontSize: '1rem',
          }}>
            Drop PDF or DOCX to scan
          </div>
        </div>
      )}

      {/* Intro */}
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 22px' }}>
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--ink-muted)', lineHeight: 1.6 }}>
          Upload a PDF or DOCX — AaykarSetu flags deprecated terminology and remaps section references.
          Review each change, approve or reject, then download in the same format you uploaded.
        </p>
      </div>

      {/* Input mode toggle */}
      <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--surface-3)', borderRadius: 10, width: 'fit-content' }}>
        {(['paste', 'upload'] as InputMode[]).map(mode => (
          <button
            key={mode}
            className={`tab-btn${inputMode === mode ? ' active' : ''}`}
            onClick={() => { setInputMode(mode); setSegments(null); setStats(null); setFlaggedIds([]); setAccepted(new Map()) }}
          >
            {mode === 'paste' ? 'Paste text' : 'Upload file'}
          </button>
        ))}
      </div>

      {/* Input area */}
      {inputMode === 'paste' ? (
        <textarea
          value={pasteText}
          onChange={e => { setPasteText(e.target.value); setSegments(null); setStats(null); setFlaggedIds([]); setAccepted(new Map()) }}
          placeholder="Paste your document text here — salary structure, agreement, filing notice, audit report..."
          rows={10}
          style={{
            width: '100%', fontFamily: 'var(--font-body)', fontSize: '0.92rem',
            color: 'var(--ink)', background: 'var(--surface)', border: '1.5px solid var(--border)',
            borderRadius: 12, padding: '14px 16px', outline: 'none', resize: 'vertical',
            lineHeight: 1.7, transition: 'border-color 0.15s', boxSizing: 'border-box',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--saffron)' }}
          onBlur={e =>  { e.currentTarget.style.borderColor = 'var(--border)' }}
        />
      ) : (
        <div
          onDragOver={e => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: '2px dashed var(--border)', borderRadius: 12, padding: '48px 24px',
            textAlign: 'center', cursor: 'pointer', background: 'var(--surface)',
            transition: 'border-color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--saffron)'; e.currentTarget.style.background = 'var(--saffron-light)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)';  e.currentTarget.style.background = 'var(--surface)' }}
        >
          <input
            ref={fileInputRef} type="file"
            accept=".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }}
          />
          {fileName ? (
            <>
              <div style={{ fontSize: '2rem', marginBottom: 10 }}>{fileType === 'pdf' ? '📕' : '📄'}</div>
              <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 4 }}>{fileName}</div>
              {extractedText
                ? <div style={{ color: 'var(--ink-muted)', fontSize: '0.82rem' }}>{extractedText.length.toLocaleString()} characters extracted · click to replace</div>
                : <div style={{ color: 'var(--ink-muted)', fontSize: '0.82rem' }}>Extracting text…</div>
              }
            </>
          ) : (
            <>
              <div style={{ fontSize: '2rem', marginBottom: 10 }}>⬆</div>
              <div style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: 6 }}>Drop your file here</div>
              <div style={{ color: 'var(--ink-muted)', fontSize: '0.82rem' }}>or click to browse · .pdf and .docx supported</div>
            </>
          )}
        </div>
      )}

      {uploadError && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', fontSize: '0.87rem', color: '#b91c1c' }}>
          {uploadError}
        </div>
      )}

      {ocrProgress && (
        <div style={{ background: '#eff6ff', border: '1px solid #3b82f6', borderRadius: 10, padding: '12px 16px', fontSize: '0.87rem', color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          {ocrProgress}
        </div>
      )}

      {/* Scan button — upload mode auto-scans; only shown for paste mode */}
      {inputMode === 'paste' && (
        <div>
          <button
            onClick={handleScan}
            disabled={!canScan}
            style={{
              padding: '12px 32px', background: canScan ? 'var(--saffron)' : 'var(--surface-3)',
              color: canScan ? 'white' : 'var(--ink-faint)', border: 'none', borderRadius: 10,
              fontFamily: 'var(--font-body)', fontSize: '0.95rem', fontWeight: 600,
              cursor: canScan ? 'pointer' : 'not-allowed', transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (canScan) e.currentTarget.style.background = 'var(--saffron-dark)' }}
            onMouseLeave={e => { if (canScan) e.currentTarget.style.background = 'var(--saffron)' }}
          >
            {scanning ? 'Scanning…' : 'Scan document'}
          </button>
        </div>
      )}
      {inputMode === 'upload' && scanning && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.88rem', color: 'var(--ink-muted)' }}>
          <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid var(--saffron)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          Scanning document…
        </div>
      )}

      {/* Results */}
      {segments && stats && (
        <>
          {/* Summary + actions */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--ink-muted)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Scan summary
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  <StatChip bg={STYLES['term-replaced'].bg}  border={STYLES['term-replaced'].border}  text={STYLES['term-replaced'].text}  count={stats.termsReplaced}  label="terms updated" />
                  <StatChip bg={STYLES['term-ambiguous'].bg} border={STYLES['term-ambiguous'].border} text={STYLES['term-ambiguous'].text} count={stats.termsAmbiguous} label="to review" />
                  <StatChip bg={STYLES['section-mapped'].bg} border={STYLES['section-mapped'].border} text={STYLES['section-mapped'].text} count={stats.sectionsMapped} label="sections remapped" />
                  <StatChip bg={STYLES['limit-warning'].bg}  border={STYLES['limit-warning'].border}  text={STYLES['limit-warning'].text}  count={stats.limitWarnings}  label="limit warnings" />
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>
                  <span style={{ color: '#15803d', fontWeight: 600 }}>{approvedCount} approved</span>
                  {' · '}
                  <span style={{ color: '#b45309', fontWeight: 600 }}>{pendingCount} pending</span>
                  {' · '}
                  <span style={{ fontSize: '0.75rem', color: 'var(--ink-faint)' }}>{annotatedCount} total changes · click any highlight to approve/reject</span>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                {/* Accept/reject all */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={acceptAll} style={smallBtnStyle('#f0fdf4', '#22c55e', '#15803d')}>✓ Accept all</button>
                  <button onClick={rejectAll} style={smallBtnStyle('#f9fafb', '#d1d5db', '#6b7280')}>✗ Reject all</button>
                </div>
                {/* Download buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ fontSize: '0.7rem', color: 'var(--ink-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>Download</div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button onClick={() => handleDownload('pdf', 'clean')} className="tab-btn active" style={{ fontSize: '0.78rem', padding: '6px 11px' }}>↓ Final PDF</button>
                    <button onClick={() => handleDownload('pdf', 'redline')} className="tab-btn" style={{ fontSize: '0.78rem', padding: '6px 11px' }}>↓ Redline PDF</button>
                  </div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    <button onClick={() => handleDownload('docx', 'clean')} className="tab-btn active" style={{ fontSize: '0.78rem', padding: '6px 11px' }}>↓ Final DOCX</button>
                    <button onClick={() => handleDownload('docx', 'redline')} className="tab-btn" style={{ fontSize: '0.78rem', padding: '6px 11px' }}>↓ Redline DOCX</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
            {(Object.entries(STYLES) as [string, typeof STYLES[keyof typeof STYLES]][]).map(([key, s]) => (
              <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, background: s.bg, border: `1.5px solid ${s.border}`, borderRadius: 3 }} />
                {s.label}
              </span>
            ))}
            <span style={{ fontSize: '0.72rem', color: 'var(--ink-faint)' }}>· click any highlight to approve / reject</span>
          </div>

          {/* Annotated output */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14,
            padding: '22px 24px', fontFamily: 'var(--font-body)', fontSize: '0.93rem',
            lineHeight: 1.85, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
          }}>
            {segments.map((seg, i) => {
              if (!seg.type) return <span key={i}>{seg.text}</span>

              const isAccepted = accepted.get(i) === true
              const isRejected = accepted.get(i) === false

              const s = isAccepted ? ACCEPTED_STYLE : isRejected ? REJECTED_STYLE : STYLES[seg.type]
              const badge = isAccepted ? '✓' : isRejected ? '✗' : '?'
              const badgeColor = isAccepted ? '#15803d' : isRejected ? '#9ca3af' : STYLES[seg.type].text

              return (
                <span
                  key={i}
                  onClick={() => toggleAccepted(i)}
                  style={{
                    background: s.bg,
                    borderBottom: `2px solid ${s.border}`,
                    color: s.text,
                    borderRadius: 3,
                    padding: '1px 3px',
                    cursor: 'pointer',
                    fontWeight: 500,
                    textDecoration: isRejected ? 'line-through' : 'none',
                    opacity: isRejected ? 0.5 : 1,
                    transition: 'all 0.15s',
                    userSelect: 'none',
                  }}
                  onMouseEnter={e => {
                    const r = e.currentTarget.getBoundingClientRect()
                    const lines: string[] = []
                    if (seg.replacement) lines.push(`→ ${seg.replacement}`)
                    if (seg.note) lines.push(seg.note)
                    lines.push(isAccepted ? 'Click to reject' : isRejected ? 'Click to approve' : 'Click to approve or reject')
                    setTooltip({ text: lines.join('\n'), x: r.left + r.width / 2, y: r.top })
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {seg.text}
                  <span style={{
                    fontSize: '0.65rem',
                    marginLeft: 3,
                    fontWeight: 700,
                    color: badgeColor,
                    fontFamily: 'var(--font-mono)',
                    verticalAlign: 'super',
                  }}>
                    {badge}
                  </span>
                  {isAccepted && seg.replacement && (
                    <span style={{ fontSize: '0.74rem', marginLeft: 3, fontWeight: 400, opacity: 0.7, fontFamily: 'var(--font-mono)' }}>
                      →{seg.replacement}
                    </span>
                  )}
                </span>
              )
            })}
          </div>

          <p style={{ fontSize: '0.75rem', color: 'var(--ink-faint)', textAlign: 'center', margin: 0 }}>
            Automated scan only. Always verify with a qualified CA before filing or relying on any mapping.
          </p>

          {flaggedSectionIds.length > 0 && (
            <ImpactPanel
              documentText={activeText}
              flaggedSectionIds={flaggedSectionIds}
            />
          )}
        </>
      )}

      {/* Floating tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed', left: tooltip.x, top: tooltip.y - 8,
          transform: 'translate(-50%, -100%)', background: '#1f2937', color: '#f9fafb',
          borderRadius: 8, padding: '8px 12px', fontSize: '0.78rem', lineHeight: 1.5,
          maxWidth: 300, pointerEvents: 'none', zIndex: 9999,
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)', whiteSpace: 'pre-line',
        }}>
          {tooltip.text}
          <div style={{
            position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)',
            width: 10, height: 10, background: '#1f2937', clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
          }} />
        </div>
      )}
    </div>
  )
}

function smallBtnStyle(bg: string, border: string, color: string): React.CSSProperties {
  return {
    fontSize: '0.78rem', padding: '5px 12px', borderRadius: 7,
    border: `1px solid ${border}`, background: bg, color, cursor: 'pointer', fontWeight: 600,
  }
}

function StatChip({ bg, border, text, count, label }: { bg: string; border: string; text: string; count: number; label: string }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: '6px 12px' }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1rem', color: text }}>{count}</span>
      <span style={{ fontSize: '0.78rem', color: text, opacity: 0.85 }}>{label}</span>
    </div>
  )
}
