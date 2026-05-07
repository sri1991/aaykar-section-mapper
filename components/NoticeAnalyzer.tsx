'use client'

import { useState, useCallback, useRef } from 'react'
import type { NoticeAnalysis } from '@/app/api/analyze-notice/route'

export default function NoticeAnalyzer() {
  const [fileName, setFileName] = useState<string | null>(null)
  const [extractedText, setExtracted] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysis, setAnalysis] = useState<NoticeAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ocrProgress, setOcrProgress] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileUpload = useCallback(async (file: File) => {
    const name = file.name.toLowerCase()
    if (!name.endsWith('.pdf') && !name.endsWith('.docx')) {
      alert('Only .pdf and .docx files are supported.')
      return
    }
    
    setFileName(file.name)
    setExtracted(null)
    setAnalysis(null)
    setError(null)
    setOcrProgress(null)

    try {
      const buffer = await file.arrayBuffer()
      let text = ''

      if (name.endsWith('.pdf')) {
        if (!(window as any).pdfjsLib) {
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
        text = pages.join('\n\n')

        if (text.trim().length <= 10) {
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
            const { data: { text: ocrText } } = await worker.recognize(canvas)
            ocrPages.push(ocrText)
          }
          await worker.terminate()
          text = ocrPages.join('\n\n')
          setOcrProgress(null)
        }
      } else {
        const mammoth = await import('mammoth')
        const result = await mammoth.extractRawText({ arrayBuffer: buffer })
        text = result.value
      }

      if (text.trim().length < 50) {
        throw new Error('Document seems empty or could not be read.')
      }

      setExtracted(text)
      // Auto-trigger analysis
      triggerAnalysis(text)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process file.')
      setFileName(null)
    }
  }, [])

  const triggerAnalysis = async (text: string) => {
    setAnalyzing(true)
    setError(null)
    try {
      const resp = await fetch('/api/analyze-notice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!resp.ok) {
        const data = await resp.json()
        throw new Error(data.error || 'Failed to analyze notice')
      }
      const data = await resp.json()
      setAnalysis(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during analysis.')
    } finally {
      setAnalyzing(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Upload Box */}
      <div
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: '2px dashed var(--border)', borderRadius: 14, padding: '40px 24px',
          textAlign: 'center', cursor: 'pointer', background: 'var(--surface)',
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--saffron)'; e.currentTarget.style.background = 'var(--saffron-light)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)';  e.currentTarget.style.background = 'var(--surface)' }}
      >
        <input
          ref={fileInputRef} type="file"
          accept=".docx,.pdf"
          style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }}
        />
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>{analyzing ? '⌛' : '📄'}</div>
        <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: '1.1rem', marginBottom: 6 }}>
          {fileName || 'Upload Income Tax Notice'}
        </div>
        <p style={{ color: 'var(--ink-muted)', fontSize: '0.85rem', margin: 0 }}>
          {analyzing ? 'Gemini is reading your notice...' : 'Drop PDF or DOCX to extract sections, demands, and checklist'}
        </p>
      </div>

      {ocrProgress && (
        <div style={{ background: '#eff6ff', border: '1px solid #3b82f6', borderRadius: 10, padding: '12px 16px', fontSize: '0.87rem', color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #3b82f6', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          {ocrProgress}
        </div>
      )}

      {error && (
        <div style={{ padding: '16px', background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 12, color: '#b91c1c', fontSize: '0.9rem' }}>
          {error}
        </div>
      )}

      {analysis && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} className="stagger">
          {/* Summary Strip */}
          <div style={{ 
            background: 'var(--surface)', 
            border: '1px solid var(--border)', 
            borderRadius: 14, 
            padding: '20px 24px',
            borderLeft: '5px solid var(--saffron)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <span style={{ 
                  fontSize: '0.7rem', 
                  fontWeight: 700, 
                  textTransform: 'uppercase', 
                  letterSpacing: '0.08em', 
                  color: 'var(--saffron-dark)',
                  background: 'var(--saffron-light)',
                  padding: '2px 8px',
                  borderRadius: 100,
                  marginBottom: 8,
                  display: 'inline-block'
                }}>
                  Section {analysis.notice_type}
                </span>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--ink)' }}>
                  Notice Analysis Summary
                </h2>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--ink-faint)', marginBottom: 2 }}>Confidence Score</div>
                <div style={{ fontWeight: 700, color: analysis.confidence_score > 0.8 ? 'var(--teal)' : 'var(--saffron)' }}>
                  {Math.round(analysis.confidence_score * 100)}%
                </div>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--ink)', lineHeight: 1.6 }}>
              {analysis.plain_english_summary}
            </p>
          </div>

          {/* Key Data Grid */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: 16 
          }}>
            <DataCard label="Assessment Year" value={analysis.assessment_year} />
            <DataCard label="Financial Year" value={analysis.financial_year} />
            <DataCard label="PAN Number" value={analysis.pan_number} isMono />
            <DataCard label="Demand Amount" value={analysis.demand_amount ? `₹${analysis.demand_amount.toLocaleString('en-IN')}` : 'N/A'} isBold />
            <DataCard label="Deadline Date" value={analysis.deadline_date || 'Not stated'} />
            <DataCard label="DIN Number" value={analysis.din_number} isMono />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Key Claims */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 16, color: 'var(--ink)' }}>Key Issues / Claims</h3>
              <ul style={{ padding: 0, margin: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {analysis.key_claims.map((claim, i) => (
                  <li key={i} style={{ fontSize: '0.88rem', color: 'var(--ink)', display: 'flex', gap: 10 }}>
                    <span style={{ color: 'var(--saffron)', fontWeight: 700 }}>•</span>
                    {claim}
                  </li>
                ))}
              </ul>
            </div>

            {/* Sections Cited */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px' }}>
              <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 16, color: 'var(--ink)' }}>Sections Cited</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {analysis.section_cited.map((s, i) => (
                  <span key={i} style={{ 
                    padding: '4px 10px', 
                    background: 'var(--surface-3)', 
                    borderRadius: 6, 
                    fontFamily: 'var(--font-mono)', 
                    fontSize: '0.8rem',
                    color: 'var(--teal-dark)'
                  }}>
                    u/s {s}
                  </span>
                ))}
              </div>
              {analysis.issuing_officer && (
                <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--ink-faint)', marginBottom: 4 }}>Issuing Officer</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--ink)' }}>{analysis.issuing_officer}</div>
                </div>
              )}
            </div>
          </div>

          {/* Required Documents */}
          <div style={{ background: 'var(--teal-light)', border: '1px solid #b3ddd7', borderRadius: 14, padding: '24px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 16, color: 'var(--teal-dark)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Documents required for CA response
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {analysis.required_documents.map((doc, i) => (
                <div key={i} style={{ 
                  background: 'rgba(255,255,255,0.6)', 
                  padding: '10px 14px', 
                  borderRadius: 10, 
                  fontSize: '0.85rem', 
                  color: 'var(--ink)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  border: '1px solid rgba(0,0,0,0.04)'
                }}>
                  <div style={{ width: 6, height: 6, background: 'var(--teal)', borderRadius: '50%' }} />
                  {doc}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => { setAnalysis(null); setFileName(null); setExtracted(null) }}
            style={{
              alignSelf: 'flex-start', padding: '10px 20px', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--surface)',
              color: 'var(--ink-muted)', cursor: 'pointer', fontSize: '0.85rem'
            }}
          >
            ← Analyze another notice
          </button>
        </div>
      )}
    </div>
  )
}

function DataCard({ label, value, isMono, isBold }: { label: string; value: string | null; isMono?: boolean; isBold?: boolean }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ 
        fontSize: '0.95rem', 
        fontWeight: isBold ? 700 : 500, 
        color: value ? 'var(--ink)' : 'var(--ink-faint)',
        fontFamily: isMono ? 'var(--font-mono)' : 'inherit'
      }}>
        {value || 'Not found'}
      </div>
    </div>
  )
}
