/**
 * POST /api/scan-impact
 *
 * Uses Gemini to extract rupee amounts associated with limit-changed sections
 * from a document, then computes per-section deltas against the new Act limits.
 *
 * Input:  { text: string; flagged_section_ids: string[] }
 * Output: { items: ImpactItem[] }
 */

import { type NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import mappingData from '@/lib/data/mapping.json'
import type { MappingData } from '@/lib/types'

const data = mappingData as unknown as MappingData

// Only extract for deductions, rebate, and thresholds — skip rate/audit_threshold
const EXTRACTABLE_CATEGORIES = new Set(['deduction', 'exemption', 'rebate', 'tds_threshold', 'tcs_threshold'])

export type ExtractionConfidence = 'high' | 'medium' | 'low' | 'failed'

export interface ImpactItem {
  section_id: string
  old_ref: string
  new_ref: string
  old_limit: number | null
  new_limit: number | null
  impact_category: string | null
  limit_changed_note: string
  extracted_amount: number | null
  context_snippet: string | null
  delta: number | null
  plain_english_summary: string
  confidence: ExtractionConfidence
}

// high = extracted amount matches a known limit (cross-validated)
// medium = amount found but is a client-specific figure (needs human check)
// low = no amount found in document
// failed = extraction call itself threw
function computeConfidence(
  extracted: number | null,
  oldLimit: number | null,
  newLimit: number | null,
  extractionSucceeded: boolean,
): ExtractionConfidence {
  if (!extractionSucceeded) return 'failed'
  if (extracted == null) return 'low'
  const matches = (known: number | null) =>
    known != null && Math.abs(extracted - known) / known < 0.01
  if (matches(oldLimit) || matches(newLimit)) return 'high'
  return 'medium'
}

interface GeminiExtraction {
  section_id: string
  extracted_amount_inr: number | null
  context_snippet: string | null
}

export async function POST(request: NextRequest) {
  let body: { text: string; flagged_section_ids: string[] }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { text, flagged_section_ids } = body
  if (!text || typeof text !== 'string' || text.trim().length < 10) {
    return Response.json({ error: 'text is required' }, { status: 400 })
  }
  if (!Array.isArray(flagged_section_ids) || flagged_section_ids.length === 0) {
    return Response.json({ items: [] })
  }

  // Find the sections we need to analyse
  const targetSections = data.sections.filter(
    s => flagged_section_ids.includes(s.id) && s.limit_changed
  )

  if (targetSections.length === 0) {
    return Response.json({ items: [] })
  }

  // Build the extraction context for Gemini
  const extractableSections = targetSections.filter(
    s => s.impact_category && EXTRACTABLE_CATEGORIES.has(s.impact_category)
  )

  let extractions: GeminiExtraction[] = []
  let extractionSucceeded = false

  if (extractableSections.length > 0) {
    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return Response.json({ error: 'GOOGLE_API_KEY is not set' }, { status: 500 })
    }

    const sectionList = extractableSections
      .map(s => `- ID "${s.id}": ${s.old_ref} (also written as ${s.old_ref.replace('Section ', 'u/s ')}, ${s.old_ref.replace('Section ', 's.')})`)
      .join('\n')

    const prompt = `You are extracting rupee amounts from an Indian tax document.

The following sections appear in this document. For each one, find any rupee (₹ or Rs.) amount directly associated with it — such as a deduction claimed, income amount, TDS deducted, or limit stated.

Sections to find:
${sectionList}

Document text (first 4000 characters):
${text.slice(0, 4000)}

Return a JSON array. For each section ID listed above, include one object:
{
  "section_id": "<the exact ID from the list above>",
  "extracted_amount_inr": <number in rupees, null if no amount found>,
  "context_snippet": "<the exact phrase/sentence where the amount appears, null if not found>"
}

Rules:
- Only return amounts explicitly in the document. Do not guess or invent amounts.
- If an amount uses lakh notation (e.g. "1.5 lakh"), convert to integer (150000).
- Return exactly one object per section ID, no extras.`

    try {
      const client = new GoogleGenerativeAI(apiKey)
      const model = client.getGenerativeModel({
        model: 'gemini-2.0-flash',
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0,
        },
      })
      const result = await model.generateContent(prompt)
      const raw = result.response.text()
      extractions = JSON.parse(raw) as GeminiExtraction[]
      extractionSucceeded = true
    } catch {
      extractions = extractableSections.map(s => ({ section_id: s.id, extracted_amount_inr: null, context_snippet: null }))
    }
  }

  const extractionMap = new Map(extractions.map(e => [e.section_id, e]))

  const items: ImpactItem[] = targetSections.map(section => {
    const ext = extractionMap.get(section.id)
    const extractedAmount = ext?.extracted_amount_inr ?? null
    const delta = (section.new_limit != null && section.old_limit != null)
      ? section.new_limit - section.old_limit
      : null
    const isExtractable = section.impact_category != null && EXTRACTABLE_CATEGORIES.has(section.impact_category)
    const confidence = isExtractable
      ? computeConfidence(extractedAmount, section.old_limit ?? null, section.new_limit ?? null, extractionSucceeded)
      : 'low'

    return {
      section_id: section.id,
      old_ref: section.old_ref,
      new_ref: section.new_ref,
      old_limit: section.old_limit,
      new_limit: section.new_limit,
      impact_category: section.impact_category,
      limit_changed_note: section.limit_changed_note ?? '',
      extracted_amount: extractedAmount,
      context_snippet: ext?.context_snippet ?? null,
      delta,
      plain_english_summary: section.plain_english_summary,
      confidence,
    }
  })

  return Response.json({ items })
}
