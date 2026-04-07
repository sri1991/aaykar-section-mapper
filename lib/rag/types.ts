// ─── Chunk ──────────────────────────────────────────────────────────────────
// One unit of retrieved context. Produced by chunker.ts, stored in Supabase,
// returned by retriever.ts after hybrid search + reranking.

export interface Chunk {
  id: string              // uuid, assigned at ingest time
  doc_id: string          // which source document (e.g. "it_act_2025")
  text: string            // raw text of the chunk (~400 tokens)
  embedding?: number[]    // 1024-dim Voyage voyage-law-2 vector (omitted after storage)

  // Structural metadata preserved during section-aware chunking
  chapter_number: string | null   // e.g. "XII", "IV-A"
  chapter_title: string | null    // e.g. "Special Provisions Relating to Tax"
  section_number: string | null   // e.g. "45", "80C", "194C"
  section_title: string | null    // e.g. "Capital gains"
  hierarchy_path: string          // breadcrumb: "Chapter XII > Section 45"
  page_start: number              // first PDF page this chunk comes from
  page_end: number                // last PDF page (chunk may span a page break)
  chunk_index: number             // sequential index within the document
  token_count: number             // approximate token count (chars/4)
}

// ─── Retrieval ───────────────────────────────────────────────────────────────

export interface RetrievedChunk extends Chunk {
  // Scores set during retrieval; removed after reranking
  vector_rank?: number    // rank in vector search results (1 = most similar)
  fts_rank?: number       // rank in full-text search results
  rrf_score?: number      // Reciprocal Rank Fusion combined score

  // Set by reranker
  rerank_score?: number   // Cohere cross-encoder score (higher = more relevant)
}

// ─── Ask API request/response ────────────────────────────────────────────────

export interface AskRequest {
  question: string
  // optional: restrict search to specific chapters or sections
  filter_chapter?: string
  filter_section?: string
}

// Streamed over SSE as newline-delimited JSON.
// Type = "delta"  → append text to current answer
// Type = "sources" → replace source list (sent once, at the end)
// Type = "error"  → show error message, stop streaming

export type StreamEvent =
  | { type: 'delta';   text: string }
  | { type: 'sources'; chunks: SourceChunk[] }
  | { type: 'error';   message: string }

// Lightweight version of RetrievedChunk sent to the client
export interface SourceChunk {
  id: string
  text: string
  chapter_number: string | null
  chapter_title: string | null
  section_number: string | null
  section_title: string | null
  hierarchy_path: string
  page_start: number
  rerank_score: number
}
