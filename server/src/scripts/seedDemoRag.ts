// Demo: index a few short journal entries and run a semantic search, proving the
// Morpheus→Chroma RAG path end-to-end. Run with AI_PROVIDER=morpheus and a Chroma
// instance reachable at CHROMA_URL.
// Usage: SEED_UID=demo npx tsx src/scripts/seedDemoRag.ts
import 'dotenv/config'
import { indexEntryChunks, searchChunks } from '../services/ragStore'

const uid = process.env.SEED_UID || 'demo-user'

// Short entries → one chunk each, so the demo needs no server-side chunker (the
// real chunker lives on the client). This exercises embed → store → search only.
const ENTRIES: Array<{ id: string; text: string }> = [
  { id: 'demo-1', text: 'I felt calm this morning after a long walk by the river.' },
  { id: 'demo-2', text: 'Work was stressful today; the deadline is looming and I felt anxious.' },
  { id: 'demo-3', text: 'Grateful for dinner with old friends — lots of laughter and warmth.' },
  { id: 'demo-4', text: 'Started reading a book on stoicism; the idea of controlling only what I can resonated.' },
]

async function main() {
  for (let i = 0; i < ENTRIES.length; i++) {
    const e = ENTRIES[i]
    const n = await indexEntryChunks({
      userId: uid, entryId: e.id, type: 'text', dayIndex: i,
      wordCount: e.text.split(/\s+/).length, chunks: [e.text],
    })
    console.log(`indexed ${e.id} (${n} chunk)`)
  }
  const query = 'when did I feel anxious or stressed?'
  const hits = await searchChunks(uid, query, 3)
  console.log(`\nquery: ${query}`)
  for (const h of hits) {
    console.log(`  ${h.entryId} chunk#${h.chunkIndex} score=${h.score.toFixed(3)}`)
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1) })
