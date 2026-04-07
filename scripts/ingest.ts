/**
 * One-time ingestion script.
 *
 * Usage:
 *   npx tsx scripts/ingest.ts --pdf path/to/it_act_2025.pdf --doc-id it_act_2025
 *
 * What it does:
 * 1. Chunks the PDF using the section-aware chunker (~400 tokens per chunk)
 * 2. Embeds all chunks in batches using Voyage AI voyage-law-2
 * 3. Upserts chunks + embeddings into Supabase (idempotent — safe to re-run)
 *
 * Requirements:
 * - .env.local must have SUPABASE_SERVICE_ROLE_KEY, VOYAGE_API_KEY
 * - Supabase migration (supabase/migrations/001_rag_schema.sql) must be applied first
 *
 * The service role key is used (not the anon key) so we can bypass RLS for bulk insert.
 * This script never runs in production — it's a one-time data preparation step.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import * as readline from 'node:readline'

// Load env files: .env first, then .env.local overrides (standard dotenv convention)
import { config as loadEnv } from 'dotenv'
loadEnv({ path: path.resolve(process.cwd(), '.env') })
loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: true })

import { createClient } from '@supabase/supabase-js'
import { chunkPdf } from '../lib/rag/chunker'
import { embedDocuments } from '../lib/rag/embeddings'
import type { Chunk } from '../lib/rag/types'

// ─── CLI args ─────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const i = args.indexOf(flag)
    return i !== -1 ? args[i + 1] : undefined
  }
  const pdfPath = get('--pdf')
  const docId   = get('--doc-id') ?? 'it_act_2025'
  if (!pdfPath) {
    console.error('Usage: npx tsx scripts/ingest.ts --pdf <path> [--doc-id <id>]')
    process.exit(1)
  }
  return { pdfPath: path.resolve(pdfPath), docId }
}

// ─── Supabase client (service role — bypasses RLS) ───────────────────────────

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  })
}

// ─── Upsert helper ───────────────────────────────────────────────────────────

const UPSERT_BATCH = 100   // rows per upsert call

async function upsertChunks(
  supabase: ReturnType<typeof getServiceClient>,
  chunks: Chunk[],
  embeddings: number[][],
) {
  for (let i = 0; i < chunks.length; i += UPSERT_BATCH) {
    const batch = chunks.slice(i, i + UPSERT_BATCH).map((chunk, j) => ({
      id:              chunk.id,
      doc_id:          chunk.doc_id,
      text:            chunk.text,
      embedding:       embeddings[i + j],
      chapter_number:  chunk.chapter_number,
      chapter_title:   chunk.chapter_title,
      section_number:  chunk.section_number,
      section_title:   chunk.section_title,
      hierarchy_path:  chunk.hierarchy_path,
      page_start:      chunk.page_start,
      page_end:        chunk.page_end,
      chunk_index:     chunk.chunk_index,
      token_count:     chunk.token_count,
    }))

    const { error } = await supabase
      .from('chunks')
      .upsert(batch, { onConflict: 'id' })

    if (error) throw new Error(`Upsert failed at batch ${i}: ${error.message}`)

    process.stdout.write(`\r  Upserted ${Math.min(i + UPSERT_BATCH, chunks.length)} / ${chunks.length} chunks`)
  }
  process.stdout.write('\n')
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { pdfPath, docId } = parseArgs()

  if (!fs.existsSync(pdfPath)) {
    console.error(`PDF not found: ${pdfPath}`)
    process.exit(1)
  }

  console.log(`\nAaykarSetu Ingestion Pipeline`)
  console.log(`════════════════════════════`)
  console.log(`PDF:    ${pdfPath}`)
  console.log(`Doc ID: ${docId}`)
  console.log()

  // ── Step 1: Chunk ──────────────────────────────────────────────────────────
  console.log('Step 1/3 — Chunking PDF...')
  const chunks = await chunkPdf(pdfPath, docId)
  console.log(`  ${chunks.length} chunks created`)
  console.log(`  Avg size: ${Math.round(chunks.reduce((s, c) => s + c.token_count, 0) / chunks.length)} tokens`)

  const chapterCounts = new Map<string, number>()
  for (const c of chunks) {
    const key = c.chapter_number ?? '(preamble)'
    chapterCounts.set(key, (chapterCounts.get(key) ?? 0) + 1)
  }
  console.log(`  Chapters detected: ${chapterCounts.size}`)
  console.log()

  // ── Step 2: Embed ──────────────────────────────────────────────────────────
  console.log('Step 2/3 — Embedding with Google gemini-embedding-001...')
  const texts = chunks.map(c => c.text)
  const embeddings = await embedDocuments(texts, (done, total) => {
    process.stdout.write(`\r  Embedded ${done} / ${total} chunks`)
  })
  process.stdout.write('\n')
  console.log(`  ${embeddings.length} embeddings ready (1024-dim each)`)
  console.log()

  // ── Step 3: Upsert to Supabase ─────────────────────────────────────────────
  console.log('Step 3/3 — Upserting to Supabase...')
  const supabase = getServiceClient()
  await upsertChunks(supabase, chunks, embeddings)
  console.log()

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('Ingestion complete.')
  console.log(`  ${chunks.length} chunks stored in Supabase table "chunks"`)
  console.log(`  Run \`npx tsx scripts/ingest.ts --pdf <new_file>\` to re-ingest.`)
  console.log()
}

main().catch(err => {
  console.error('\nIngestion failed:', err)
  process.exit(1)
})
