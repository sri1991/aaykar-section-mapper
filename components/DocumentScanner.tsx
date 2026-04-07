'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { MappingData } from '@/lib/types'
import { processText, getReplacedText, type TextSegment, type ScanStats } from '@/lib/scanner'

interface Props {
  data: MappingData
}

type InputMode = 'paste' | 'upload'

const STYLES = {
  'term-replaced':  { bg: '#e6f4f1', border: '#1d7a6e', text: '#155f55', label: 'Term updated' },
  'term-ambiguous': { bg: '#fdf0e7', border: '#e07b39', text: '#b85f25', label: 'Review needed' },
  'section-mapped': { bg: '#eff6ff', border: '#3b82f6', text: '#1d4ed8', label: 'Section remapped' },
  'limit-warning':  { bg: '#fffbeb', border: '#f59e0b', text: '#b45309', label: 'Limit may have changed' },
} as const

export default function DocumentScanner({ data }: Props) {
  const [inputMode, setInputMode] = useState<InputMode>('paste')
  const [pasteText, setPasteText] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [extractedText, setExtractedText] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [segments, setSegments] = useState<TextSegment[] | null>(null)
  const [stats, setStats] = useState<ScanStats | null>(null)
  const [copied, setCopied] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [ocrProgress, setOcrProgress] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<{ replacement?: string; note?: string; x: number; y: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Hide tooltip on scroll
  useEffect(() => {
    const hide = () => setTooltip(null)
    window.addEventListener('scroll', hide, true)
    return () => window.removeEventListener('scroll', hide, true)
  }, [])

  const handleFileUpload = useCallback(async (file: File) => {
    const name = file.name.toLowerCase()
    if (!name.endsWith('.docx') && !name.endsWith('.pdf')) {
      alert('Only .docx and .pdf files are supported.')
      return
    }
    setFileName(file.name)
    setExtractedText(null)
    setSegments(null)
    setStats(null)
    setUploadError(null)
    setOcrProgress(null)
    try {
      const buffer = await file.arrayBuffer()
      if (name.endsWith('.pdf')) {
        // Load pdfjs as a plain script tag to avoid Turbopack bundler interference
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
          setExtractedText(directText)
        } else {
          // Scanned PDF — fall back to OCR via Tesseract.js
          setOcrProgress('Starting OCR engine…')
          const { createWorker } = await import('tesseract.js')
          const worker = await createWorker('eng', 1, {
            logger: () => {}, // suppress verbose logs
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
          setExtractedText(ocrPages.join('\n\n'))
        }
      } else {
        const mammoth = await import('mammoth')
        const result = await mammoth.extractRawText({ arrayBuffer: buffer })
        setExtractedText(result.value)
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to extract text from file.')
      setFileName(null)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFileUpload(file)
  }, [handleFileUpload])

  const handleScan = useCallback(() => {
    const text = inputMode === 'paste' ? pasteText : (extractedText ?? '')
    if (!text.trim()) return
    setScanning(true)
    setTimeout(() => {
      const result = processText(text, data)
      setSegments(result.segments)
      setStats(result.stats)
      setScanning(false)
    }, 30)
  }, [inputMode, pasteText, extractedText, data])

  const handleCopy = useCallback(async () => {
    if (!segments) return
    await navigator.clipboard.writeText(getReplacedText(segments))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [segments])

  const handleDownloadDocx = useCallback(async () => {
    if (!segments) return
    const { Document, Paragraph, TextRun, Packer } = await import('docx')
    const lines = getReplacedText(segments).split('\n')
    const doc = new Document({
      sections: [{
        properties: {},
        children: lines.map(line => new Paragraph({ children: [new TextRun(line || ' ')] })),
      }],
    })
    const blob = await Packer.toBlob(doc)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName ? fileName.replace(/\.(docx|pdf)$/i, '_updated.docx') : 'aaykar_updated.docx'
    a.click()
    URL.revokeObjectURL(url)
  }, [segments, fileName])

  const activeText = inputMode === 'paste' ? pasteText : (extractedText ?? '')
  const canScan = activeText.trim().length > 10 && !scanning

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Intro */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '18px 22px',
      }}>
        <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--ink-muted)', lineHeight: 1.6 }}>
          Paste any document — salary structure, agreement, ITR draft, notice — and AaykarSetu will flag
          deprecated terminology, remap section references to the 2025 Act, and warn you where monetary
          limits may have changed.
        </p>
      </div>

      {/* Input mode toggle */}
      <div style={{ display: 'flex', gap: 4, padding: 4, background: 'var(--surface-3)', borderRadius: 10, width: 'fit-content' }}>
        {(['paste', 'upload'] as InputMode[]).map(mode => (
          <button
            key={mode}
            className={`tab-btn${inputMode === mode ? ' active' : ''}`}
            onClick={() => { setInputMode(mode); setSegments(null); setStats(null) }}
          >
            {mode === 'paste' ? 'Paste text' : 'Upload file'}
          </button>
        ))}
      </div>

      {/* Input area */}
      {inputMode === 'paste' ? (
        <textarea
          value={pasteText}
          onChange={e => { setPasteText(e.target.value); setSegments(null); setStats(null) }}
          placeholder="Paste your document text here — e.g. salary structure, agreement, filing notice, audit report..."
          rows={10}
          style={{
            width: '100%',
            fontFamily: 'var(--font-body)',
            fontSize: '0.92rem',
            color: 'var(--ink)',
            background: 'var(--surface)',
            border: '1.5px solid var(--border)',
            borderRadius: 12,
            padding: '14px 16px',
            outline: 'none',
            resize: 'vertical',
            lineHeight: 1.7,
            transition: 'border-color 0.15s',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--saffron)' }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
        />
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: '2px dashed var(--border-strong)',
            borderRadius: 12,
            padding: '48px 24px',
            textAlign: 'center',
            cursor: 'pointer',
            background: 'var(--surface)',
            transition: 'border-color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--saffron)'
            e.currentTarget.style.background = 'var(--saffron-light)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border-strong)'
            e.currentTarget.style.background = 'var(--surface)'
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }}
          />
          {fileName ? (
            <>
              <div style={{ fontSize: '2rem', marginBottom: 10 }}>📄</div>
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
              <div style={{ color: 'var(--ink-muted)', fontSize: '0.82rem' }}>or click to browse · .docx and .pdf supported</div>
            </>
          )}
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fca5a5',
          borderRadius: 10,
          padding: '12px 16px',
          fontSize: '0.87rem',
          color: '#b91c1c',
        }}>
          {uploadError}
        </div>
      )}

      {/* OCR progress */}
      {ocrProgress && (
        <div style={{
          background: '#eff6ff',
          border: '1px solid #3b82f6',
          borderRadius: 10,
          padding: '12px 16px',
          fontSize: '0.87rem',
          color: '#1d4ed8',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          {ocrProgress}
        </div>
      )}

      {/* Scan button */}
      <div>
        <button
          onClick={handleScan}
          disabled={!canScan}
          style={{
            padding: '12px 32px',
            background: canScan ? 'var(--saffron)' : 'var(--surface-3)',
            color: canScan ? 'white' : 'var(--ink-faint)',
            border: 'none',
            borderRadius: 10,
            fontFamily: 'var(--font-body)',
            fontSize: '0.95rem',
            fontWeight: 600,
            cursor: canScan ? 'pointer' : 'not-allowed',
            transition: 'background 0.15s, opacity 0.15s',
          }}
          onMouseEnter={e => { if (canScan) e.currentTarget.style.background = 'var(--saffron-dark)' }}
          onMouseLeave={e => { if (canScan) e.currentTarget.style.background = 'var(--saffron)' }}
        >
          {scanning ? 'Scanning…' : 'Scan document'}
        </button>
      </div>

      {/* Results */}
      {segments && stats && (
        <>
          {/* Summary panel */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: '20px 22px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--ink-muted)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Scan summary
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <StatChip style={STYLES['term-replaced']}  count={stats.termsReplaced}  label="terms replaced" />
                  <StatChip style={STYLES['term-ambiguous']} count={stats.termsAmbiguous} label="to review" />
                  <StatChip style={STYLES['section-mapped']} count={stats.sectionsMapped} label="sections remapped" />
                  <StatChip style={STYLES['limit-warning']}  count={stats.limitWarnings}  label="limit warnings" />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button
                  onClick={handleCopy}
                  className="tab-btn active"
                  style={{ fontSize: '0.83rem', padding: '7px 16px' }}
                >
                  {copied ? '✓ Copied' : 'Copy text'}
                </button>
                <button
                  onClick={handleDownloadDocx}
                  className="tab-btn"
                  style={{ fontSize: '0.83rem', padding: '7px 16px' }}
                >
                  Download DOCX
                </button>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center' }}>
            {(Object.entries(STYLES) as [string, typeof STYLES[keyof typeof STYLES]][]).map(([key, s]) => (
              <span key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.78rem', color: 'var(--ink-muted)' }}>
                <span style={{ display: 'inline-block', width: 11, height: 11, background: s.bg, border: `1.5px solid ${s.border}`, borderRadius: 3 }} />
                {s.label}
              </span>
            ))}
            <span style={{ fontSize: '0.75rem', color: 'var(--ink-faint)' }}>· hover annotations for details</span>
          </div>

          {/* Annotated output */}
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: '22px 24px',
            fontFamily: 'var(--font-body)',
            fontSize: '0.93rem',
            lineHeight: 1.85,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {segments.map((seg, i) => {
              if (!seg.type) return <span key={i}>{seg.text}</span>
              const s = STYLES[seg.type]
              return (
                <span
                  key={i}
                  style={{
                    background: s.bg,
                    borderBottom: `2px solid ${s.border}`,
                    color: s.text,
                    borderRadius: 3,
                    padding: '1px 3px',
                    cursor: 'help',
                    fontWeight: 500,
                  }}
                  onMouseEnter={e => {
                    const r = e.currentTarget.getBoundingClientRect()
                    setTooltip({ replacement: seg.replacement, note: seg.note, x: r.left + r.width / 2, y: r.top })
                  }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {seg.text}
                  {seg.replacement && (
                    <span style={{
                      fontSize: '0.74rem',
                      marginLeft: 4,
                      fontWeight: 400,
                      opacity: 0.75,
                      fontFamily: 'var(--font-mono)',
                    }}>
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
        </>
      )}

      {/* Floating tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed',
          left: tooltip.x,
          top: tooltip.y - 8,
          transform: 'translate(-50%, -100%)',
          background: '#1f2937',
          color: '#f9fafb',
          borderRadius: 8,
          padding: '8px 12px',
          fontSize: '0.8rem',
          lineHeight: 1.5,
          maxWidth: 280,
          pointerEvents: 'none',
          zIndex: 9999,
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
        }}>
          {tooltip.replacement && (
            <div style={{ marginBottom: tooltip.note ? 4 : 0 }}>
              <span style={{ opacity: 0.6, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Updated to</span>
              <br />
              <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#86efac' }}>{tooltip.replacement}</span>
            </div>
          )}
          {tooltip.note && (
            <div style={{ opacity: 0.85, fontSize: '0.77rem' }}>{tooltip.note}</div>
          )}
          {/* Arrow */}
          <div style={{
            position: 'absolute',
            bottom: -5,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 10,
            height: 10,
            background: '#1f2937',
            clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
          }} />
        </div>
      )}
    </div>
  )
}

function StatChip({
  style,
  count,
  label,
}: {
  style: { bg: string; border: string; text: string }
  count: number
  label: string
}) {
  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      background: style.bg,
      border: `1px solid ${style.border}`,
      borderRadius: 8,
      padding: '6px 14px',
    }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '1.05rem', color: style.text }}>{count}</span>
      <span style={{ fontSize: '0.8rem', color: style.text, opacity: 0.85 }}>{label}</span>
    </div>
  )
}
