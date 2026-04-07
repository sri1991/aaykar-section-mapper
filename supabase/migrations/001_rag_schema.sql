-- TaxBridge RAG Schema
-- Apply this in: Supabase Dashboard → SQL Editor → New query → Run
-- Or via: supabase db push (if using Supabase CLI)

-- ─── Extensions ──────────────────────────────────────────────────────────────

-- pgvector: vector similarity search
create extension if not exists vector with schema extensions;

-- pg_trgm: used for text similarity (optional, improves FTS)
create extension if not exists pg_trgm with schema extensions;

-- ─── Table ───────────────────────────────────────────────────────────────────

create table if not exists chunks (
  id              text        primary key,         -- e.g. "it_act_2025_42"
  doc_id          text        not null,            -- e.g. "it_act_2025"
  text            text        not null,            -- raw chunk text (~400 tokens)
  embedding       vector(768),                     -- Google text-embedding-004

  -- Structural metadata
  chapter_number  text,                            -- e.g. "XII", "IV-A"
  chapter_title   text,                            -- full chapter heading
  section_number  text,                            -- e.g. "45", "80C", "194C"
  section_title   text,                            -- section heading text
  hierarchy_path  text        not null default '', -- "Chapter XII > Section 45 — Capital gains"
  page_start      integer     not null default 0,
  page_end        integer     not null default 0,
  chunk_index     integer     not null default 0,
  token_count     integer     not null default 0,

  created_at      timestamptz not null default now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

-- HNSW index for approximate nearest-neighbour vector search.
-- cosine distance is correct for normalised Voyage embeddings.
-- m=16, ef_construction=64 are standard defaults; tune up for better recall
-- at the cost of more memory.
create index if not exists chunks_embedding_hnsw
  on chunks
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- GIN index for full-text search (tsvector)
create index if not exists chunks_fts_gin
  on chunks
  using gin (to_tsvector('english', text));

-- B-tree indexes for metadata filtering
create index if not exists chunks_doc_id_idx       on chunks (doc_id);
create index if not exists chunks_chapter_idx      on chunks (chapter_number);
create index if not exists chunks_section_idx      on chunks (section_number);

-- ─── Search functions ─────────────────────────────────────────────────────────

-- Vector similarity search
-- Returns rows ordered by cosine distance (closest first).
-- Filters by chapter/section if provided.
create or replace function vector_search(
  query_embedding vector(768),
  match_count     int,
  filter_chapter  text default null,
  filter_section  text default null
)
returns table (
  id              text,
  doc_id          text,
  text            text,
  chapter_number  text,
  chapter_title   text,
  section_number  text,
  section_title   text,
  hierarchy_path  text,
  page_start      integer,
  page_end        integer,
  chunk_index     integer,
  token_count     integer
)
language sql stable
as $$
  select
    id, doc_id, text,
    chapter_number, chapter_title,
    section_number, section_title,
    hierarchy_path, page_start, page_end,
    chunk_index, token_count
  from chunks
  where
    (filter_chapter is null or chapter_number = filter_chapter)
    and
    (filter_section is null or section_number = filter_section)
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- Full-text search using PostgreSQL tsvector
-- Returns rows ordered by ts_rank (best match first).
create or replace function fts_search(
  query_text      text,
  match_count     int,
  filter_chapter  text default null,
  filter_section  text default null
)
returns table (
  id              text,
  doc_id          text,
  text            text,
  chapter_number  text,
  chapter_title   text,
  section_number  text,
  section_title   text,
  hierarchy_path  text,
  page_start      integer,
  page_end        integer,
  chunk_index     integer,
  token_count     integer
)
language sql stable
as $$
  select
    id, doc_id, text,
    chapter_number, chapter_title,
    section_number, section_title,
    hierarchy_path, page_start, page_end,
    chunk_index, token_count
  from chunks
  where
    to_tsvector('english', text) @@ to_tsquery('english', query_text)
    and
    (filter_chapter is null or chapter_number = filter_chapter)
    and
    (filter_section is null or section_number = filter_section)
  order by ts_rank(to_tsvector('english', text), to_tsquery('english', query_text)) desc
  limit match_count;
$$;

-- ─── Row Level Security ───────────────────────────────────────────────────────

-- Enable RLS — chunks are publicly readable (no auth needed for search)
alter table chunks enable row level security;

create policy "chunks are publicly readable"
  on chunks for select
  using (true);

-- Inserts/updates only via service role key (used by ingestion script)
-- No insert policy = only service_role (bypasses RLS) can write.
