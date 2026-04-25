import type { TextSegment } from './scanner'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// Converts segments into an array of HTML paragraph strings, respecting \n\n breaks
function segmentsToHtmlParas(
  segments: TextSegment[],
  accepted: Map<number, boolean>,
  mode: 'clean' | 'redline'
): string[] {
  const paras: string[] = []
  let current = ''

  const flush = () => {
    paras.push(current)
    current = ''
  }

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]

    if (!seg.type) {
      for (const part of seg.text.split(/(\n\n+|\n)/)) {
        if (/^\n\n+$/.test(part)) flush()
        else if (part === '\n') current += '<br>'
        else if (part) current += escapeHtml(part)
      }
      continue
    }

    const isAccepted = accepted.get(i) === true

    if (mode === 'clean') {
      current += escapeHtml(isAccepted && seg.replacement ? seg.replacement : seg.text)
    } else {
      if (isAccepted && seg.replacement) {
        current +=
          `<del style="color:#dc2626">${escapeHtml(seg.text)}</del>` +
          `<ins style="color:#16a34a;font-weight:600;text-decoration:none"> ${escapeHtml(seg.replacement)}</ins>`
      } else {
        // rejected or pending — amber highlight so CA can see what was considered but kept
        current += `<mark style="background:#fef3c7;padding:1px 2px;border-radius:2px">${escapeHtml(seg.text)}</mark>`
      }
    }
  }

  flush()
  return paras
}

function buildHtmlDocument(
  paragraphs: string[],
  title: string,
  isRedline: boolean
): string {
  const legend = isRedline
    ? `<div style="margin-bottom:2em;padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:9pt;color:#475569;line-height:1.6">
        <strong>Redline copy</strong> &mdash;
        <del style="color:#dc2626">Struck-through text</del> was replaced by
        <ins style="color:#16a34a;font-weight:600;text-decoration:none">green text</ins>.
        Amber highlights are changes the CA reviewed but kept as-is.
       </div>`
    : ''

  const body = paragraphs.map(p => `<p>${p || '&nbsp;'}</p>`).join('\n')

  return `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.75; margin: 2.5cm; color: #111; }
    p { margin: 0 0 0.85em 0; }
    del { text-decoration: line-through; }
    ins { text-decoration: none; }
    @media print { body { margin: 1.5cm; } @page { margin: 1.5cm; } }
  </style>
</head><body>
  ${legend}${body}
</body></html>`
}

function deriveTitle(fileName: string | null, mode: 'clean' | 'redline'): string {
  const base = (fileName ?? 'document').replace(/\.(pdf|docx)$/i, '')
  return mode === 'redline' ? `${base} — Redline` : base
}

export function openPrintWindow(
  segments: TextSegment[],
  accepted: Map<number, boolean>,
  mode: 'clean' | 'redline',
  fileName: string | null
) {
  const title = deriveTitle(fileName, mode)
  const paras = segmentsToHtmlParas(segments, accepted, mode)
  const html = buildHtmlDocument(paras, title, mode === 'redline')

  const win = window.open('', '_blank', 'width=850,height=700')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 400)
}

export async function downloadDocx(
  segments: TextSegment[],
  accepted: Map<number, boolean>,
  mode: 'clean' | 'redline',
  fileName: string | null
) {
  const { Document, Paragraph, TextRun, Packer } = await import('docx')

  type DocxParagraph = InstanceType<typeof Paragraph>
  type DocxRun = InstanceType<typeof TextRun>

  const docParas: DocxParagraph[] = []
  let currentRuns: DocxRun[] = []

  const flushPara = () => {
    docParas.push(new Paragraph({ children: currentRuns.length ? currentRuns : [new TextRun('')] }))
    currentRuns = []
  }

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i]

    if (!seg.type) {
      for (const part of seg.text.split(/(\n)/)) {
        if (part === '\n') flushPara()
        else if (part) currentRuns.push(new TextRun({ text: part }))
      }
      continue
    }

    const isAccepted = accepted.get(i) === true

    if (mode === 'clean') {
      currentRuns.push(new TextRun({ text: isAccepted && seg.replacement ? seg.replacement : seg.text }))
    } else {
      if (isAccepted && seg.replacement) {
        currentRuns.push(
          new TextRun({ text: seg.text, strike: true, color: 'DC2626' }),
          new TextRun({ text: ' ' }),
          new TextRun({ text: seg.replacement, color: '16A34A', bold: true }),
        )
      } else {
        currentRuns.push(new TextRun({ text: seg.text, highlight: 'yellow' }))
      }
    }
  }

  flushPara()

  const doc = new Document({ sections: [{ properties: {}, children: docParas }] })
  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const suffix = mode === 'redline' ? '_redline.docx' : '_final.docx'
  a.download = (fileName ?? 'document').replace(/\.(docx|pdf)$/i, suffix)
  a.click()
  URL.revokeObjectURL(url)
}
