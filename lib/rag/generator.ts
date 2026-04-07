/**
 * Answer generator — supports multiple LLM backends.
 *
 * Switch via env var:  GENERATOR_MODEL=gemini | groq  (default: groq)
 *
 * Available models:
 *   groq   → llama-3.3-70b-versatile  (~500 tok/s, free tier 14k req/day)
 *   gemini → gemini-2.5-flash         (better at complex legal/structured text)
 */

import Groq from 'groq-sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { RetrievedChunk, StreamEvent, SourceChunk } from './types'

// ─── Config ───────────────────────────────────────────────────────────────────

const GROQ_MODEL   = 'llama-3.3-70b-versatile'
const GEMINI_MODEL = 'gemini-2.5-flash'
const MAX_TOKENS   = 1024

export type GeneratorModel = 'groq' | 'gemini'

export function activeModel(): GeneratorModel {
  const val = process.env.GENERATOR_MODEL?.toLowerCase()
  return val === 'gemini' ? 'gemini' : 'groq'
}

// ─── System prompt (shared) ───────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are AaykarMitra, the AI assistant for AaykarSetu — a precise legal reference tool for the Income Tax Act 2025 (India).

Your role:
- Answer questions about the Income Tax Act 2025 using ONLY the context passages provided.
- Cite sources inline using [SOURCE N] tags (e.g. "Capital gains are taxable under [SOURCE 1]").
- If the provided context is insufficient to answer the question, say: "The retrieved passages don't cover this sufficiently. Please consult the full text of the Act or a qualified CA."
- Never speculate, infer, or use knowledge outside the provided context.
- Be concise but complete. Use bullet points for multi-part answers.
- When a section number is mentioned, always use the 2025 Act numbering.

Format:
- Use markdown for structure (bold for key terms, bullets for lists).
- Keep answers under 300 words unless the question genuinely requires more detail.
- End with a one-line disclaimer: *Always verify with a qualified CA before acting on this information.*`

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function* generateAnswer(
  question: string,
  chunks: RetrievedChunk[],
  model?: GeneratorModel,
): AsyncGenerator<StreamEvent> {
  if (chunks.length === 0) {
    yield {
      type: 'error',
      message: 'No relevant passages found. Try rephrasing or searching for the specific section number.',
    }
    return
  }

  const backend = model ?? activeModel()
  const contextBlock = buildContext(chunks)
  const userMessage = `Context from the Income Tax Act 2025:\n\n${contextBlock}\n\n---\n\nQuestion: ${question}`

  if (backend === 'gemini') {
    yield* generateWithGemini(userMessage, chunks)
  } else {
    yield* generateWithGroq(userMessage, chunks)
  }
}

// ─── Groq (llama-3.3-70b-versatile) ──────────────────────────────────────────

async function* generateWithGroq(
  userMessage: string,
  chunks: RetrievedChunk[],
): AsyncGenerator<StreamEvent> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) throw new Error('GROQ_API_KEY is not set')

  const client = new Groq({ apiKey })
  const stream = await client.chat.completions.create({
    model: GROQ_MODEL,
    max_tokens: MAX_TOKENS,
    temperature: 0,
    stream: true,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: userMessage },
    ],
  })

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content
    if (text) yield { type: 'delta', text }
  }

  yield { type: 'sources', chunks: chunks.map(toSourceChunk) }
}

// ─── Gemini (gemini-2.5-flash) ────────────────────────────────────────────────

async function* generateWithGemini(
  userMessage: string,
  chunks: RetrievedChunk[],
): AsyncGenerator<StreamEvent> {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) throw new Error('GOOGLE_API_KEY is not set')

  const client = new GoogleGenerativeAI(apiKey)
  const model = client.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: { maxOutputTokens: MAX_TOKENS, temperature: 0 },
  })

  const result = await model.generateContentStream(userMessage)

  for await (const chunk of result.stream) {
    const text = chunk.text()
    if (text) yield { type: 'delta', text }
  }

  yield { type: 'sources', chunks: chunks.map(toSourceChunk) }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map((c, i) => `[SOURCE ${i + 1}] ${c.hierarchy_path} (p. ${c.page_start})\n${c.text}`)
    .join('\n\n---\n\n')
}

function toSourceChunk(c: RetrievedChunk): SourceChunk {
  return {
    id: c.id,
    text: c.text,
    chapter_number: c.chapter_number,
    chapter_title: c.chapter_title,
    section_number: c.section_number,
    section_title: c.section_title,
    hierarchy_path: c.hierarchy_path,
    page_start: c.page_start,
    rerank_score: c.rerank_score ?? 0,
  }
}
