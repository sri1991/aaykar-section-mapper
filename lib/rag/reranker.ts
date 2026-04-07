/**
 * Cohere reranker.
 *
 * Why rerank after retrieval?
 * Retrieval (vector + FTS) uses bi-encoders — query and document are embedded
 * independently, so similarity is approximate. A cross-encoder (what Cohere
 * Rerank uses) sees the query and document TOGETHER, giving far more accurate
 * relevance scores at the cost of latency. Running it over 20 candidates rather
 * than the full corpus makes this tractable.
 *
 * Model: rerank-english-v3.0
 * - Best English reranking model from Cohere
 * - Returns a relevance_score in [0, 1]
 * - Free tier: 1000 calls/month; ~$1/1000 calls on pay-as-you-go
 *
 * We return the top TOP_N chunks after reranking. These go directly into the
 * generator prompt as context.
 */

import type { RetrievedChunk } from './types'

const COHERE_RERANK_URL = 'https://api.cohere.com/v2/rerank'
const RERANK_MODEL      = 'rerank-english-v3.0'
const TOP_N             = 5    // chunks actually sent to Claude

export async function rerank(
  question: string,
  chunks: RetrievedChunk[],
  topN: number = TOP_N,
): Promise<RetrievedChunk[]> {
  if (chunks.length === 0) return []
  // If we already have fewer chunks than topN, skip the API call
  if (chunks.length <= topN) {
    return chunks.map(c => ({ ...c, rerank_score: c.rrf_score ?? 0 }))
  }

  const apiKey = process.env.COHERE_API_KEY
  if (!apiKey) throw new Error('COHERE_API_KEY is not set')

  const response = await fetch(COHERE_RERANK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: RERANK_MODEL,
      query: question,
      documents: chunks.map(c => c.text),
      top_n: topN,
      return_documents: false,   // we already have the text; save bandwidth
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Cohere rerank error ${response.status}: ${body}`)
  }

  const json = await response.json() as {
    results: { index: number; relevance_score: number }[]
  }

  // Map scores back to chunks and sort descending by relevance
  return json.results
    .map(r => ({
      ...chunks[r.index],
      rerank_score: r.relevance_score,
    }))
    .sort((a, b) => (b.rerank_score ?? 0) - (a.rerank_score ?? 0))
}
