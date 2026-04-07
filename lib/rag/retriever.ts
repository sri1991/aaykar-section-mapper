/**
 * Hybrid retriever — combines pgvector ANN search with PostgreSQL full-text
 * search, then fuses the two result lists using Reciprocal Rank Fusion (RRF).
 *
 * Why hybrid?
 * - Pure vector search is great for semantic similarity ("when does a transfer
 *   attract capital gains?") but misses exact matches for things like "194C"
 *   or "Section 80-IAC" where the query IS the term.
 * - Pure full-text search can't handle paraphrases or conceptual queries.
 * - RRF is parameter-free, well-studied, and works better than weighted
 *   score combination in practice.
 *
 * RRF formula: score(d) = Σ 1 / (k + rank(d))  where k = 60 (standard default)
 *
 * Supabase setup required:
 * - pgvector extension enabled
 * - `chunks` table with columns matching the Chunk type
 * - `chunks_embedding` HNSW index on the embedding column
 * - `chunks_fts` GIN index on a tsvector column
 * - Two SQL functions: `vector_search` and `fts_search` (see migration file)
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { embedQuery } from './embeddings'
import type { RetrievedChunk } from './types'

// ─── Config ──────────────────────────────────────────────────────────────────

const VECTOR_CANDIDATES = 20    // how many results to fetch from each search arm
const FTS_CANDIDATES    = 20
const RRF_K             = 60    // standard RRF constant
const FINAL_TOP_N       = 20    // candidates passed to reranker

// ─── Supabase client (server-side only — uses anon key for read) ─────────────

let _client: SupabaseClient | null = null

function getClient(): SupabaseClient {
  if (_client) return _client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase env vars not set')
  _client = createClient(url, key)
  return _client
}

// ─── Public API ──────────────────────────────────────────────────────────────

export interface RetrieverOptions {
  filterChapter?: string
  filterSection?: string
  topN?: number
}

/**
 * Returns up to `topN` chunks ranked by RRF fusion score.
 * These are then passed to the reranker for final cross-encoder scoring.
 */
export async function retrieve(
  question: string,
  options: RetrieverOptions = {},
): Promise<RetrievedChunk[]> {
  const { filterChapter, filterSection, topN = FINAL_TOP_N } = options

  // Embed the question (using "query" input_type — important for Voyage)
  const queryEmbedding = await embedQuery(question)

  // Run both arms in parallel
  const [vectorResults, ftsResults] = await Promise.all([
    vectorSearch(queryEmbedding, VECTOR_CANDIDATES, filterChapter, filterSection),
    fullTextSearch(question, FTS_CANDIDATES, filterChapter, filterSection),
  ])

  // Fuse with RRF
  const fused = reciprocalRankFusion(vectorResults, ftsResults)

  return fused.slice(0, topN)
}

// ─── Vector search ───────────────────────────────────────────────────────────

async function vectorSearch(
  embedding: number[],
  limit: number,
  filterChapter?: string,
  filterSection?: string,
): Promise<RetrievedChunk[]> {
  const client = getClient()

  // Call the `vector_search` SQL function defined in the migration
  const { data, error } = await client.rpc('vector_search', {
    query_embedding: embedding,
    match_count: limit,
    filter_chapter: filterChapter ?? null,
    filter_section: filterSection ?? null,
  })

  if (error) throw new Error(`Vector search failed: ${error.message}`)

  return (data as RawChunkRow[]).map((row, i) => ({
    ...rowToChunk(row),
    vector_rank: i + 1,
  }))
}

// ─── Full-text search ─────────────────────────────────────────────────────────

async function fullTextSearch(
  query: string,
  limit: number,
  filterChapter?: string,
  filterSection?: string,
): Promise<RetrievedChunk[]> {
  const client = getClient()

  // Normalise query for tsquery: join words with & (AND), strip special chars
  const tsQuery = query
    .replace(/[^\w\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .join(' & ')

  if (!tsQuery) return []

  const { data, error } = await client.rpc('fts_search', {
    query_text: tsQuery,
    match_count: limit,
    filter_chapter: filterChapter ?? null,
    filter_section: filterSection ?? null,
  })

  if (error) throw new Error(`Full-text search failed: ${error.message}`)

  return (data as RawChunkRow[]).map((row, i) => ({
    ...rowToChunk(row),
    fts_rank: i + 1,
  }))
}

// ─── Reciprocal Rank Fusion ───────────────────────────────────────────────────

function reciprocalRankFusion(
  vectorResults: RetrievedChunk[],
  ftsResults: RetrievedChunk[],
): RetrievedChunk[] {
  const scores = new Map<string, { chunk: RetrievedChunk; score: number }>()

  function addScores(results: RetrievedChunk[], rankKey: 'vector_rank' | 'fts_rank') {
    for (const chunk of results) {
      const rank = chunk[rankKey] ?? results.length + 1
      const rrfScore = 1 / (RRF_K + rank)
      const existing = scores.get(chunk.id)
      if (existing) {
        existing.score += rrfScore
        // Merge rank metadata onto existing chunk
        if (rankKey === 'vector_rank') existing.chunk.vector_rank = chunk.vector_rank
        if (rankKey === 'fts_rank')    existing.chunk.fts_rank    = chunk.fts_rank
      } else {
        scores.set(chunk.id, { chunk: { ...chunk }, score: rrfScore })
      }
    }
  }

  addScores(vectorResults, 'vector_rank')
  addScores(ftsResults,    'fts_rank')

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score)
    .map(({ chunk, score }) => ({ ...chunk, rrf_score: score }))
}

// ─── Row mapping ─────────────────────────────────────────────────────────────

interface RawChunkRow {
  id: string
  doc_id: string
  text: string
  chapter_number: string | null
  chapter_title: string | null
  section_number: string | null
  section_title: string | null
  hierarchy_path: string
  page_start: number
  page_end: number
  chunk_index: number
  token_count: number
}

function rowToChunk(row: RawChunkRow): RetrievedChunk {
  return {
    id: row.id,
    doc_id: row.doc_id,
    text: row.text,
    chapter_number: row.chapter_number,
    chapter_title: row.chapter_title,
    section_number: row.section_number,
    section_title: row.section_title,
    hierarchy_path: row.hierarchy_path,
    page_start: row.page_start,
    page_end: row.page_end,
    chunk_index: row.chunk_index,
    token_count: row.token_count,
  }
}
