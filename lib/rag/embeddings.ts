/**
 * Google Generative AI embeddings — direct REST client.
 *
 * Uses v1 (not v1beta) — text-embedding-004 is only available on v1.
 * Calls embedContent per item in parallel batches of BATCH_SIZE.
 */

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001'
const DIMENSIONS = 768   // request truncated output to match Supabase vector(768)
const BATCH_SIZE = 20

// ─── Single query embedding ───────────────────────────────────────────────────

export async function embedQuery(text: string): Promise<number[]> {
  return embedSingle(text, 'RETRIEVAL_QUERY')
}

// ─── Batch document embeddings (ingestion) ────────────────────────────────────

export async function embedDocuments(
  texts: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<number[][]> {
  const allEmbeddings: number[][] = new Array(texts.length)

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map(text => embedSingle(text, 'RETRIEVAL_DOCUMENT'))
    )
    for (let j = 0; j < results.length; j++) {
      allEmbeddings[i + j] = results[j]
    }
    onProgress?.(Math.min(i + BATCH_SIZE, texts.length), texts.length)
  }

  return allEmbeddings
}

// ─── Raw call ─────────────────────────────────────────────────────────────────

async function embedSingle(
  text: string,
  taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY',
): Promise<number[]> {
  const apiKey = process.env.GOOGLE_API_KEY
  if (!apiKey) throw new Error('GOOGLE_API_KEY is not set')

  const response = await fetch(`${BASE_URL}:embedContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskType,
      content: { parts: [{ text }] },
      outputDimensionality: DIMENSIONS,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Google Embedding API error ${response.status}: ${body}`)
  }

  const json = await response.json() as { embedding: { values: number[] } }
  return json.embedding.values
}

// ─── Utility ──────────────────────────────────────────────────────────────────

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

export const EMBEDDING_DIMENSIONS = DIMENSIONS
