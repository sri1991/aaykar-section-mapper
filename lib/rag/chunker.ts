/**
 * Section-aware chunker for the Income Tax Act 2025 PDF.
 *
 * Strategy:
 * 1. Extract raw text page-by-page using pdfjs-dist (Node/legacy build).
 * 2. Detect structural boundaries:
 *    - Chapter headings:  "CHAPTER XII" / "CHAPTER IV-A"
 *    - Section headings:  "45." / "80C." / "194C." at line start
 *    - Sub-section start: "(1)" "(a)" at line start (used for overlap, not splits)
 * 3. Accumulate text into chunks of ~TARGET_TOKENS tokens.
 *    When a new section heading is detected AND the current chunk is over
 *    MIN_TOKENS, close the current chunk and start a new one — so section
 *    boundaries are never buried mid-chunk.
 * 4. Each chunk carries full structural metadata (chapter, section, hierarchy
 *    path, page range) so citations in the UI are precise.
 * 5. Overlap: the last OVERLAP_TOKENS tokens of a closed chunk are prepended
 *    to the next one so context is not lost at boundaries.
 *
 * Token approximation: 1 token ≈ 4 characters (conservative for legal English).
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import type { Chunk } from './types'

// ─── Config ──────────────────────────────────────────────────────────────────

const TARGET_TOKENS  = 350  // target chunk size — force splits more aggressively
const MIN_TOKENS     = 100  // minimum before a section boundary triggers a new chunk
const OVERLAP_TOKENS = 60   // tokens of trailing context carried into next chunk
const CHARS_PER_TOKEN = 4

const TARGET_CHARS  = TARGET_TOKENS  * CHARS_PER_TOKEN
const MIN_CHARS     = MIN_TOKENS     * CHARS_PER_TOKEN
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN

// ─── Regex patterns ──────────────────────────────────────────────────────────

// Chapter headings — matches all common formats in Indian legislation PDFs:
//   "CHAPTER XII"  "Chapter 4"  "CHAPTER IV-A"  "Chapter XII—Title"
// Case-insensitive, at start of line (after optional whitespace)
const CHAPTER_RE = /^\s*CHAPTER\s+([IVXLCDM\d]+(?:[—\-][A-Z\d]+)?)[^\n]*/im

// Section heading — "45." "80C." "194C." "10AA." "2(24)." at start of line
// Followed by space + capital letter (title starts immediately)
// Also handles em-dash and en-dash separators used in some PDFs
const SECTION_RE = /^\s*(\d{1,3}[A-Z]{0,4}(?:\([A-Z0-9]+\))?)\.\s{1,4}([A-Z][^\n]{2,})/m

// Roman numerals for chapter number normalisation
const ROMAN_RE = /^[IVXLCDM]+$/i

// ─── Helpers ─────────────────────────────────────────────────────────────────

function approxTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN)
}

function normaliseChapterNum(raw: string): string {
  return raw.trim().toUpperCase()
}

function trailingOverlap(text: string): string {
  if (text.length <= OVERLAP_CHARS) return text
  return text.slice(text.length - OVERLAP_CHARS)
}

// ─── Types (internal) ────────────────────────────────────────────────────────

interface ParsedPage {
  page: number   // 1-indexed
  text: string
}

interface StructuralState {
  chapterNumber: string | null
  chapterTitle: string | null
  sectionNumber: string | null
  sectionTitle: string | null
}

// ─── Core chunker ────────────────────────────────────────────────────────────

export async function chunkPdf(
  pdfPath: string,
  docId: string,
): Promise<Chunk[]> {
  const pages = await extractPages(pdfPath)
  return chunkPages(pages, docId)
}

/**
 * Also accepts pre-extracted page texts (e.g. from browser PDF.js).
 * The ingestion script uses chunkPdf; the browser scanner could call this directly.
 */
export function chunkPages(pages: ParsedPage[], docId: string): Chunk[] {
  const chunks: Chunk[] = []
  let chunkIndex = 0

  // Mutable state tracking where we are in the document structure
  const state: StructuralState = {
    chapterNumber: null,
    chapterTitle: null,
    sectionNumber: null,
    sectionTitle: null,
  }

  // Current accumulation buffer
  let buffer = ''
  let bufferPageStart = 1
  let bufferPageEnd = 1
  let overlapPrefix = ''   // overlap carried from previous chunk

  function flushChunk(pageEnd: number) {
    const text = (overlapPrefix + buffer).trim()
    if (text.length < 20) return   // skip near-empty chunks

    chunks.push({
      id: `${docId}_${chunkIndex}`,
      doc_id: docId,
      text,
      chunk_index: chunkIndex++,
      token_count: approxTokens(text),
      chapter_number: state.chapterNumber,
      chapter_title: state.chapterTitle,
      section_number: state.sectionNumber,
      section_title: state.sectionTitle,
      hierarchy_path: buildHierarchyPath(state),
      page_start: bufferPageStart,
      page_end: pageEnd,
    })

    overlapPrefix = trailingOverlap(buffer)
    buffer = ''
    bufferPageStart = pageEnd
  }

  for (const { page, text: pageText } of pages) {
    bufferPageEnd = page
    const lines = pageText.split('\n')

    for (const line of lines) {
      // ── Detect chapter heading ──────────────────────────────────────────
      const chapterMatch = line.match(CHAPTER_RE)
      if (chapterMatch) {
        // Flush before updating state so the old chapter's context is sealed
        if (buffer.length >= MIN_CHARS) flushChunk(page)
        state.chapterNumber = normaliseChapterNum(chapterMatch[1])
        state.chapterTitle = line.trim()
        state.sectionNumber = null
        state.sectionTitle = null
        buffer += line + '\n'
        continue
      }

      // ── Detect section heading ──────────────────────────────────────────
      const sectionMatch = line.match(SECTION_RE)
      if (sectionMatch) {
        if (buffer.length >= MIN_CHARS) flushChunk(page)
        state.sectionNumber = sectionMatch[1]
        state.sectionTitle = sectionMatch[2].trim()
        buffer += line + '\n'
        continue
      }

      // ── Normal line — accumulate ────────────────────────────────────────
      buffer += line + '\n'

      // Flush at target size (natural line break split)
      // Hard-cap at 2× target to prevent runaway chunks when section
      // boundaries aren't detected (e.g. PDFs with non-standard formatting)
      if (buffer.length >= TARGET_CHARS) {
        flushChunk(page)
        bufferPageStart = page
      }
    }
  }

  // Flush remaining buffer
  if (buffer.trim().length > 0) flushChunk(bufferPageEnd)

  return chunks
}

function buildHierarchyPath(state: StructuralState): string {
  const parts: string[] = []
  if (state.chapterNumber) {
    parts.push(
      state.chapterTitle
        ? `Chapter ${state.chapterNumber}`
        : `Chapter ${state.chapterNumber}`,
    )
  }
  if (state.sectionNumber) {
    parts.push(
      state.sectionTitle
        ? `Section ${state.sectionNumber} — ${state.sectionTitle}`
        : `Section ${state.sectionNumber}`,
    )
  }
  return parts.join(' > ') || 'Preamble'
}

// ─── PDF extraction (Node.js, uses pdfjs-dist legacy build) ─────────────────

async function extractPages(pdfPath: string): Promise<ParsedPage[]> {
  // Use the legacy build which ships a Node-compatible entry point
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js')
  pdfjsLib.GlobalWorkerOptions.workerSrc = false  // disable worker in Node

  const data = new Uint8Array(fs.readFileSync(path.resolve(pdfPath)))
  const pdf = await pdfjsLib.getDocument({ data, useSystemFonts: true }).promise

  const pages: ParsedPage[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const content = await page.getTextContent()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pageText = content.items.map((item: any) => item.str ?? '').join(' ')
    pages.push({ page: i, text: pageText })
  }
  return pages
}
