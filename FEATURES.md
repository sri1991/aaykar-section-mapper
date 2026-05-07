# AaykarSetu — Feature Documentation

> Current as of April 2026. Covers all features live in the codebase.

---

## What is AaykarSetu?

AaykarSetu is a compliance workbench for Indian CAs, finance teams, and SMEs navigating the transition from the Income Tax Act 1961 to the Income Tax Act 2025 (effective Tax Year 2026-27). It has four tools accessible as tabs in a single-page application — no login, no backend required for the core mapper.

---

## Tab 1 — Section Mapper

**Search any 1961 section and instantly see its 2025 equivalent.**

### Search
- Fuzzy full-text search powered by **Fuse.js** — runs entirely client-side, results in under 200ms
- Searches across: old section number, new section number, old title, new title, keywords, plain-English summary, category
- Bidirectional — works whether you type the old number (`80C`) or the new one
- Minimum 2 characters to trigger search; clears gracefully with an × button
- Quick-suggestion pills on the hero for common queries: `80C`, `194C`, `Form 16`, `HRA`, `TDS salary`, `87A`, `gratuity`, `Form 24Q`

### Results
Each result card shows:
- **Old reference → New reference** as monospace chips with colour coding (old = warm grey, new = teal; deleted = red)
- **Change type badge**: `Renumbered` (blue) · `Amended` (amber) · `Merged` (purple) · `Relocated` (green) · `Deleted` (red)
- **Category pill**: TDS, Deductions, Salary, Capital Gains, Business Income, etc.
- **Old title and new title** (new title shown only if it changed)
- **Plain-English summary**: 2–3 line explanation of what changed and why it matters
- **Monetary limit alert**: amber warning box shown when a section's monetary limit has changed, with the specific change note

### Category filter
- Filter pills below the search bar: All · TDS · TCS · Deductions · Salary · Capital Gains · Business Income · House Property · Audit · Tax Regimes · Assessment & Compliance · Interest & Penalties · Losses · Trusts & NGOs · General
- Each pill shows the result count for the current search query
- Selecting a category stacks with the current search (intersection, not replacement)
- Resets automatically when the search query changes

### Stats bar
- Live counts: total sections mapped · total forms mapped · sections with limit changes
- Result count updates as you filter

---

## Tab 2 — Forms Mapper

**All TDS/TCS and filing forms — old number to new number.**

Same search and card architecture as the Section Mapper, applied to forms:
- **Old form → New form** mapping
- **Old purpose → New purpose** description
- **Related section** cross-reference (old and new)
- **Structural changes** summary: what fields changed, what was removed, what was added
- **Merged forms alert**: purple warning box when multiple old forms have been consolidated into one, prompting workflow updates

---

## Tab 3 — Document Scanner

**Upload or paste any document and get an annotated, terminology-corrected output.**

### Input modes
- **Paste text**: textarea accepts any pasted content — salary structures, agreements, ITR drafts, notices, audit reports
- **Upload file**: drag-and-drop or click-to-browse; supports `.docx` and `.pdf`

### PDF extraction
- **Text-based PDFs**: extracted directly using PDF.js (loaded as a plain script tag to avoid Turbopack bundler issues)
- **Scanned/image PDFs**: automatic fallback to OCR via **Tesseract.js**
  - Detects low text yield (≤10 characters extracted) and silently switches to OCR
  - Renders each page to a canvas at 2× scale for better accuracy
  - Shows a live progress indicator: `OCR: page X of Y…` with a spinner

### DOCX extraction
- Extracts raw text from `.docx` files using **Mammoth.js**

### Scan engine
Four annotation types, each colour-coded:

| Type | Colour | Trigger |
|------|--------|---------|
| **Term updated** | Teal | Deprecated terminology replaced with 2025 equivalent (e.g. "Previous Year" → "Tax Year") |
| **Review needed** | Orange | Ambiguous term that may or may not need replacement — flagged rather than silently changed |
| **Section remapped** | Blue | Old section reference detected and replaced with new 2025 section number |
| **Limit may have changed** | Yellow | Section reference where a monetary limit has changed — requires manual verification |

### Section reference matching
Catches all common variants of section citations:
- `80C` · `Sec 80C` · `Section 80C` · `u/s 80C` · `s. 80C` · `section 80-C`
- Optional hyphen handling between digit→letter transitions
- Word-boundary aware to avoid false positives on partial matches

### Annotations
- Highlighted inline in the annotated output with colour-coded underlines
- **Hover tooltip**: dark popover showing the replacement term (in green monospace) and the explanatory note — `position: fixed` so it's never clipped by overflow
- Inline replacement preview: `→NewTerm` shown in small monospace next to each flagged span

### Scan summary panel
- Count chips: terms replaced · terms to review · sections remapped · limit warnings
- Colour-matched to annotation types

### Export
- **Copy text**: copies the replaced plain text to clipboard (confirmed replacements applied, ambiguous terms left as-is)
- **Download DOCX**: generates a `.docx` file with all confirmed replacements applied, using `docx.js`; filename derived from the uploaded file (e.g. `salary_structure_updated.docx`) or `aaykar_updated.docx` for pasted text

---

## Tab 4 — AaykarMitra (RAG chat)

**Ask any question about the Income Tax Act 2025 in plain English. Answers are grounded in the actual Act text with source citations.**

### RAG pipeline (server-side)

**Ingestion** (one-time, run via `npm run ingest`):
1. Section-aware PDF chunker — respects Chapter/Section hierarchy, ~350 token chunks with 60-token overlap, hard-cap at 2× target to prevent runaway chunks
2. Each chunk carries metadata: chapter number, chapter title, section number, section title, hierarchy path, page range
3. Embeddings generated via **Google `gemini-embedding-001`** (768-dim, `RETRIEVAL_DOCUMENT` task type)
4. Chunks + embeddings upserted to **Supabase pgvector** (`vector(768)`, HNSW index)

**Query pipeline** (per user question):
1. Question embedded with **Google `gemini-embedding-001`** (`RETRIEVAL_QUERY` task type)
2. **Hybrid search** against Supabase:
   - Vector ANN search via pgvector (`<=>` cosine distance) → top 20 candidates
   - PostgreSQL full-text search (`tsvector`/`tsquery`) → top 20 candidates
   - Both run in parallel
3. **Reciprocal Rank Fusion (RRF)** merges the two result lists (k=60, parameter-free)
4. **Cohere `rerank-english-v3.0`** cross-encoder rescores the top 20 → selects top 5
5. Top 5 chunks passed to the LLM with `[SOURCE N]` citation instructions

### Generation models (switchable per question)

| Model | Provider | Speed | Strengths |
|-------|----------|-------|-----------|
| **Llama 3.3 70B Versatile** | Groq LPU | ~500 tok/s | Fast, free tier generous (14,400 req/day) |
| **Gemini 2.5 Flash** | Google | Moderate | Better on complex legal language and structured output |

- Toggle shown above the input box — switches per question, not per session
- Disabled while a response is streaming
- Can also be set globally via `GENERATOR_MODEL=gemini` env var

### Chat UI
- Multi-turn conversation — all previous questions and answers shown above the current input
- Streaming answers rendered in real time with a blinking cursor while generating
- Status progression: `Searching the Act…` spinner → streaming text
- **Minimal markdown renderer** (no external library): bold `**text**`, inline code `` `code` ``, bullet lists, `[SOURCE N]` citation badges (orange pill linking visually to source cards)
- **Source cards** shown below each answer — one card per retrieved chunk:
  - Hierarchy path (e.g. `Chapter XII > Section 45 — Capital gains`)
  - Page number from the Act
  - Expand/collapse to read the raw chunk text
- Example questions shown on first load to guide users

### System design
- Streaming via NDJSON (`application/x-ndjson`) — each line is a `StreamEvent` JSON object
- Three event types: `delta` (append text) · `sources` (replace source list, sent once at end) · `error` (terminal)
- API route: `POST /api/ask` — validates input, runs retrieve → rerank → generate, streams response
- `force-dynamic` export prevents Next.js from caching the route

---

## Tab 5 — Notice Analyzer

**Upload any Income Tax notice and get structured extractions and a tailored document checklist.**

### Extraction Engine
Uses **Gemini 2.5 Pro** to analyze the full text of the notice and extract:
- **Notice Type**: Automatic identification (e.g., 143(1), 148, 271)
- **Key Parameters**: Assessment Year, Financial Year, PAN, Demand Amount, Deadline, DIN
- **Cited Sections**: Automatically lists every Income Tax Act section mentioned in the document
- **Plain-English Summary**: A 3-4 sentence "TL;DR" for the CA to understand the core issue instantly

### CA Workflow Tool
- **Key Claims**: Itemized list of specific discrepancies or claims the department is making
- **Required Documents**: Generates a tailored list of 5-8 documents the CA should collect from the client to respond effectively
- **Confidence Score**: Indicates the reliability of the extraction

### Document Support
- Supports **PDF** (with native text extraction + OCR fallback) and **DOCX**
- OCR powered by Tesseract.js for scanned/low-quality PDFs

---

## Infrastructure & Data

### Supabase schema
- `chunks` table: id, doc_id, text, embedding (vector 768), chapter/section metadata, page range, token count
- HNSW index on embedding column (m=16, ef_construction=64)
- GIN index on `tsvector` of text column for full-text search
- Two SQL functions: `vector_search` and `fts_search` — accept optional chapter/section filters
- RLS enabled: publicly readable, write-only via service role key

### Data
- Static JSON (`lib/taxbridge-mapping.json`): sections, forms, terminology mappings sourced from CBDT concordance
- Covers top sections across: TDS, TCS, Deductions, Salary, Capital Gains, Business Income, House Property, Audit, Tax Regimes, Assessment & Compliance, Interest & Penalties, Losses, Trusts & NGOs
- All TDS/TCS forms with old→new mappings

### Tech stack
| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, inline styles, CSS variables |
| Client search | Fuse.js (fuzzy, client-side) |
| PDF extraction (browser) | PDF.js (script tag, avoids Turbopack) |
| OCR (browser) | Tesseract.js |
| DOCX read | Mammoth.js |
| DOCX write | docx.js |
| Vector DB | Supabase pgvector |
| Embeddings | Google gemini-embedding-001 (768-dim) |
| Reranker | Cohere rerank-english-v3.0 |
| LLM (fast) | Groq · Llama 3.3 70B Versatile |
| LLM (quality) | Google Gemini 2.5 Flash |
| Ingestion script | tsx (TypeScript, Node.js) |

---

## Not yet built (planned)

- CA-ready PDF export (jsPDF, email gate via Resend)
- Authentication / saved sessions
- Multi-document ingestion support
- Mobile-optimised layout
