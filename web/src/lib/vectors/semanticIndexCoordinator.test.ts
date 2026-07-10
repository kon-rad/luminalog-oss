import { describe, it, expect, beforeAll } from 'vitest'
import { SemanticIndexCoordinator } from '@/lib/vectors/semanticIndexCoordinator'
import { VectorIndex } from '@/lib/vectors/vectorIndex'
import type { VectorItem } from '@/lib/vectors/vectorService'

let dek: CryptoKey
beforeAll(async () => {
  dek = await crypto.subtle.importKey('raw', new Uint8Array(32), 'AES-GCM', false, ['encrypt', 'decrypt'])
})

// Deterministic fake embedder: a unit vector whose 1-hot position depends on
// text length, so equal-length texts embed identically (easy top-K assertions).
const fakeEmbed = async (t: string) => {
  const v = new Float32Array(512)
  v[t.length % 512] = 1
  return v
}

function makeStore() {
  const store = new Map<string, VectorItem>()
  return {
    store,
    service: {
      list: async () => Array.from(store.values()),
      upsert: async (items: VectorItem[]) => items.forEach((i) => store.set(i.entryId, i)),
      delete: async (id: string) => void store.delete(id),
    },
  }
}

function makeCoordinator(service: ReturnType<typeof makeStore>['service'], index = new VectorIndex()) {
  return new SemanticIndexCoordinator({ embed: fakeEmbed, service, index, getDEK: () => dek, model: 'distiluse-multilingual-v1' })
}

describe('SemanticIndexCoordinator', () => {
  it('indexEntry embeds, wraps, upserts a blob, and adds it to the index', async () => {
    const { store, service } = makeStore()
    const coord = makeCoordinator(service)
    await coord.indexEntry('e1', 'hello')
    expect(store.get('e1')).toMatchObject({ entryId: 'e1', dim: 512, model: 'distiluse-multilingual-v1' })
    expect(typeof store.get('e1')!.blob).toBe('string')
    const hits = await coord.search('hello', 5) // same length → same vector
    expect(hits[0].entryId).toBe('e1')
  })

  it('removeEntry deletes the blob and drops it from the index', async () => {
    const { store, service } = makeStore()
    const coord = makeCoordinator(service)
    await coord.indexEntry('e1', 'hello')
    await coord.removeEntry('e1')
    expect(store.has('e1')).toBe(false)
    expect(await coord.search('hello', 5)).toEqual([])
  })

  it('loadIndex decrypts stored blobs back into a fresh in-memory index', async () => {
    const { store, service } = makeStore()
    await makeCoordinator(service).indexEntry('e1', 'hello')
    const coord2 = makeCoordinator({ ...service, list: async () => Array.from(store.values()) })
    await coord2.loadIndex()
    expect((await coord2.search('hello', 5))[0].entryId).toBe('e1')
  })

  it('backfill only embeds entries not already indexed', async () => {
    const { store, service } = makeStore()
    const coord = makeCoordinator(service)
    await coord.indexEntry('e1', 'hello')
    await coord.backfill([
      { id: 'e1', text: 'hello' }, // already indexed → skipped
      { id: 'e2', text: 'longer text here' }, // new → embedded
    ])
    expect(store.has('e2')).toBe(true)
    expect(store.get('e2')).toMatchObject({ entryId: 'e2', dim: 512 })
  })

  it('search returns [] when the index is empty (no query embed needed)', async () => {
    const { service } = makeStore()
    expect(await makeCoordinator(service).search('anything', 5)).toEqual([])
  })
})
