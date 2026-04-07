import type { MappingData } from './types'

export type AnnotationType = 'term-replaced' | 'term-ambiguous' | 'section-mapped' | 'limit-warning'

export interface TextSegment {
  text: string
  type?: AnnotationType
  original?: string
  replacement?: string
  note?: string
}

export interface ScanStats {
  termsReplaced: number
  termsAmbiguous: number
  sectionsMapped: number
  limitWarnings: number
}

export interface ScanResult {
  segments: TextSegment[]
  stats: ScanStats
}

interface Match {
  start: number
  end: number
  original: string
  type: AnnotationType
  replacement?: string
  note?: string
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Add optional hyphens between digit→letter transitions (e.g. "80C" → "80-?C")
function addOptionalHyphens(escaped: string): string {
  return escaped.replace(/(\d)([A-Za-z])/g, '$1-?$2')
}

// Extract the section number from old_ref like "Section 80C" → "80C"
function extractSectionNum(oldRef: string): string | null {
  const m = oldRef.match(/^Section\s+(.+)$/i)
  return m ? m[1].trim() : null
}

function buildSectionRegex(oldRef: string): RegExp | null {
  const num = extractSectionNum(oldRef)
  if (!num) return null

  const escaped = escapeRegex(num)
  const pattern = addOptionalHyphens(escaped)

  // Standard prefix variants
  const prefix = `(?:u\\/s\\.?\\s*|section\\.?\\s*|sec\\.?\\s*|s\\.\\s*)`
  const prefixed = `${prefix}${pattern}`

  // Bare match only for "typed" numbers: has letter, parens, or 3+ digits
  const hasLetter = /[A-Za-z]/.test(num)
  const hasParens = /\(/.test(num)
  const isLongNumber = /^\d{3,}$/.test(num)

  if (hasLetter || hasParens || isLongNumber) {
    return new RegExp(`(?:${prefixed}|\\b${pattern}\\b)`, 'gi')
  }
  return new RegExp(prefixed, 'gi')
}

export function processText(text: string, data: MappingData): ScanResult {
  const matches: Match[] = []

  // 1. Terminology matches
  for (const term of data.terminology) {
    // Skip unchanged terms
    if (term.old_term === term.new_term) continue

    const regex = new RegExp(`\\b${escapeRegex(term.old_term)}s?\\b`, 'gi')
    let m: RegExpExecArray | null
    while ((m = regex.exec(text)) !== null) {
      const isAmbiguous = term.note.toLowerCase().includes('flag for')
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        original: m[0],
        type: isAmbiguous ? 'term-ambiguous' : 'term-replaced',
        replacement: term.new_term,
        note: term.note,
      })
    }
  }

  // 2. Section reference matches
  for (const section of data.sections) {
    const regex = buildSectionRegex(section.old_ref)
    if (!regex) continue

    let m: RegExpExecArray | null
    while ((m = regex.exec(text)) !== null) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        original: m[0],
        type: section.limit_changed ? 'limit-warning' : 'section-mapped',
        replacement: section.new_ref,
        note: section.limit_changed
          ? `Limit updated — verify amount.${section.limit_changed_note ? ` ${section.limit_changed_note}.` : ''} ${section.plain_english_summary}`
          : section.plain_english_summary,
      })
    }
  }

  // Sort by start, resolve overlaps (first match wins)
  matches.sort((a, b) => a.start - b.start || b.end - a.end)
  const resolved: Match[] = []
  let cursor = 0
  for (const m of matches) {
    if (m.start >= cursor) {
      resolved.push(m)
      cursor = m.end
    }
  }

  // Build segments
  const segments: TextSegment[] = []
  let pos = 0
  for (const m of resolved) {
    if (m.start > pos) segments.push({ text: text.slice(pos, m.start) })
    segments.push({
      text: m.original,
      type: m.type,
      original: m.original,
      replacement: m.replacement,
      note: m.note,
    })
    pos = m.end
  }
  if (pos < text.length) segments.push({ text: text.slice(pos) })

  const stats: ScanStats = {
    termsReplaced: resolved.filter(m => m.type === 'term-replaced').length,
    termsAmbiguous: resolved.filter(m => m.type === 'term-ambiguous').length,
    sectionsMapped: resolved.filter(m => m.type === 'section-mapped').length,
    limitWarnings: resolved.filter(m => m.type === 'limit-warning').length,
  }

  return { segments, stats }
}

// Returns plain text with confirmed replacements applied (ambiguous left as-is)
export function getReplacedText(segments: TextSegment[]): string {
  return segments.map(s => {
    if ((s.type === 'term-replaced' || s.type === 'section-mapped') && s.replacement) {
      return s.replacement
    }
    return s.text
  }).join('')
}
