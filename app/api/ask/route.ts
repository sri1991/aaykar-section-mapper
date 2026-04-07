/**
 * POST /api/ask
 *
 * Streaming RAG endpoint. Pipeline per request:
 *   1. Validate & parse request body
 *   2. Hybrid retrieval (vector + full-text, RRF fusion) → 20 candidates
 *   3. Cohere rerank → top 5 chunks
 *   4. Claude streaming generation with citations
 *   5. Stream events as newline-delimited JSON (NDJSON)
 *
 * Stream format (each line is a JSON-encoded StreamEvent):
 *   {"type":"delta","text":"..."}      — append to answer
 *   {"type":"sources","chunks":[...]}  — source cards (sent once at end)
 *   {"type":"error","message":"..."}   — terminal error
 *
 * Error handling:
 * - Input validation errors → 400 with JSON body (not streamed)
 * - Pipeline errors mid-stream → streamed error event, then stream closes
 */

import { type NextRequest } from 'next/server'
import { retrieve } from '@/lib/rag/retriever'
import { rerank } from '@/lib/rag/reranker'
import { generateAnswer, type GeneratorModel } from '@/lib/rag/generator'
import type { AskRequest, StreamEvent } from '@/lib/rag/types'

export const dynamic = 'force-dynamic'

// Max question length to prevent abuse
const MAX_QUESTION_LENGTH = 500

export async function POST(request: NextRequest) {
  // ── Parse & validate ────────────────────────────────────────────────────────
  let body: AskRequest
  try {
    body = await request.json() as AskRequest
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { question, filter_chapter, filter_section, model } = body as AskRequest & { model?: GeneratorModel }

  if (!question || typeof question !== 'string') {
    return Response.json({ error: 'question is required' }, { status: 400 })
  }
  if (question.trim().length < 5) {
    return Response.json({ error: 'question is too short' }, { status: 400 })
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return Response.json({ error: `question must be under ${MAX_QUESTION_LENGTH} characters` }, { status: 400 })
  }

  // ── Build streaming response ─────────────────────────────────────────────
  const encoder = new TextEncoder()

  function encodeEvent(event: StreamEvent): Uint8Array {
    return encoder.encode(JSON.stringify(event) + '\n')
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Step 1: Retrieve
        const candidates = await retrieve(question.trim(), {
          filterChapter: filter_chapter,
          filterSection: filter_section,
        })

        if (candidates.length === 0) {
          controller.enqueue(encodeEvent({
            type: 'error',
            message: 'No relevant passages found. The document may not have been ingested yet, or try rephrasing your question.',
          }))
          controller.close()
          return
        }

        // Step 2: Rerank
        const reranked = await rerank(question.trim(), candidates)

        // Step 3: Generate + stream
        for await (const event of generateAnswer(question.trim(), reranked, model)) {
          controller.enqueue(encodeEvent(event))
        }

        controller.close()
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An unexpected error occurred'
        try {
          controller.enqueue(encodeEvent({ type: 'error', message }))
        } catch {
          // controller may already be closed
        }
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
