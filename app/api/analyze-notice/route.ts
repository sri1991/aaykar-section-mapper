/**
 * POST /api/analyze-notice
 * 
 * Uses Gemini to extract structured data from an Income Tax notice.
 */

import { type NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export const dynamic = 'force-dynamic'

export interface NoticeAnalysis {
  notice_type: '143(1)' | '143(1)(a)' | '143(2)' | '148' | '148A' | '156' | '245' | '270A' | '271' | 'OTHER'
  section_cited: string[]
  assessment_year: string | null
  financial_year: string | null
  pan_number: string | null
  demand_amount: number | null
  deadline_date: string | null
  issuing_officer: string | null
  din_number: string | null
  key_claims: string[]
  plain_english_summary: string
  confidence_score: number
  required_documents: string[]
}

export async function POST(request: NextRequest) {
  let body: { text: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { text } = body
  if (!text || typeof text !== 'string' || text.trim().length < 50) {
    return Response.json({ error: 'Valid notice text is required (min 50 chars)' }, { status: 400 })
  }

  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) {
    return Response.json({ error: 'GOOGLE_API_KEY is not set' }, { status: 500 })
  }

  const prompt = `You are an expert Indian Tax Auditor. Analyze the provided Income Tax notice text and extract structured information.

Notice Text:
---
${text.slice(0, 10000)}
---

Extract the following JSON structure:
{
  "notice_type": "One of: '143(1)', '143(1)(a)', '143(2)', '148', '148A', '156', '245', '270A', '271', 'OTHER'. Identify based on context or explicit mention.",
  "section_cited": ["Array of all Income Tax Act sections mentioned, e.g., '139(1)', '143(2)'. Include sub-sections if present."],
  "assessment_year": "Format: 'YYYY-YY', e.g., '2023-24'. null if not found.",
  "financial_year": "Format: 'YYYY-YY', e.g., '2022-23'. null if not found.",
  "pan_number": "Standard 10-char PAN format. null if not found.",
  "demand_amount": number or null. Extract only the primary demand/penalty amount in INR. No commas.,
  "deadline_date": "ISO format 'YYYY-MM-DD'. null if not stated.",
  "issuing_officer": "Name or designation of the officer. null if not found.",
  "din_number": "Document Identification Number. null if not found.",
  "key_claims": ["Array of strings summarizing exactly what the department is questioning or claiming (e.g., 'Discrepancy in HRA claim', 'Undisclosed foreign income')."],
  "plain_english_summary": "3-4 sentences explaining what this notice is about and what immediate action the taxpayer/CA must take.",
  "confidence_score": number between 0.0 and 1.0 representing your confidence in extraction.,
  "required_documents": ["List 5-8 specific documents the CA should gather to respond to this specific notice (e.g., 'Bank statements for FY 2022-23', 'Rent receipts and agreement')."]
}

Rules:
- Be extremely precise with section numbers.
- If an amount is mentioned in words, convert to number.
- Ensure 'notice_type' is exactly one of the allowed strings.`

  try {
    const client = new GoogleGenerativeAI(apiKey)
    const model = client.getGenerativeModel({
      model: 'gemini-2.5-pro',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    })

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()
    const analysis = JSON.parse(responseText) as NoticeAnalysis

    return Response.json(analysis)
  } catch (err) {
    console.error('Notice Analysis Error:', err)
    return Response.json({ error: 'Failed to analyze notice. The document might be too complex or unclear.' }, { status: 500 })
  }
}
