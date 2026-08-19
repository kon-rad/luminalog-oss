import { describe, it, expect, beforeAll } from 'vitest'
import type { CognitiveMap } from '@/lib/cognitive-map'
import { AAD } from '@/lib/crypto/aad'
import { decodeCognitiveMap, encodeCognitiveMap, needsCognitiveMap } from './codec'
import type { JournalEntry } from './models'

let key: CryptoKey

const sampleMap: CognitiveMap = {
  v: 1,
  beats: [{
    id: 'b0', tier: 'map', kind: 'event', text: 'Only three signed up',
    quote: 'Only three signed up.', quoteStart: 0, domain: 'craft',
    isSpine: true, isKeeper: false, generality: 0.1, keepScore: 0.24, degree: 0,
    mentions: [{ surface: 'the beta', type: 'project' }],
  }],
  edges: [],
}

const entry = (over: Partial<JournalEntry> = {}): JournalEntry =>
  ({ id: 'e1', content: 'Only three signed up.', ...over }) as JournalEntry

beforeAll(async () => {
  key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'],
  )
})

describe('AAD', () => {
  it('uses the exact context string iOS uses', () => {
    // Must match the iOS `CognitiveMapGeneration.context` byte for byte, or a map
    // written on the phone cannot be opened in the browser.
    expect(AAD.journalsCognitiveMapData).toBe('journals.cognitiveMap.data')
  })
})

describe('cognitive map codec', () => {
  it('round-trips a map', async () => {
    const encoded = await encodeCognitiveMap(
      { map: sampleMap, generatedAt: new Date('2026-08-16T10:00:00Z'), model: 'm', version: 1 },
      key,
    )
    const decoded = await decodeCognitiveMap(encoded, key)
    expect(decoded!.map).toEqual(sampleMap)
    expect(decoded!.model).toBe('m')
    expect(decoded!.version).toBe(1)
    expect(decoded!.generatedAt.toISOString()).toBe('2026-08-16T10:00:00.000Z')
  })

  it('keeps the metadata plaintext and the map encrypted', async () => {
    const encoded = await encodeCognitiveMap(
      { map: sampleMap, generatedAt: new Date(), model: 'm', version: 1 }, key,
    )
    expect(encoded.model).toBe('m')
    expect(encoded.version).toBe(1)
    expect(typeof encoded.data).toBe('object')
    expect(JSON.stringify(encoded.data)).not.toContain('Only three signed up')
  })

  it('returns undefined for a missing field', async () => {
    expect(await decodeCognitiveMap(undefined, key)).toBeUndefined()
  })

  it('returns undefined rather than throwing when decryption fails', async () => {
    const other = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'],
    )
    const encoded = await encodeCognitiveMap(
      { map: sampleMap, generatedAt: new Date(), model: 'm', version: 1 }, key,
    )
    expect(await decodeCognitiveMap(encoded, other)).toBeUndefined()
  })

  it('returns undefined when the decrypted payload is not a structurally valid map', async () => {
    const broken = {
      v: 1, beats: [],
      edges: [{ from: 'x', to: 'y', type: 'caused', phrasing: 'p', polarity: 0 }],
    } as unknown as CognitiveMap
    const encoded = await encodeCognitiveMap(
      { map: broken, generatedAt: new Date(), model: 'm', version: 1 }, key,
    )
    expect(await decodeCognitiveMap(encoded, key)).toBeUndefined()
  })
})

describe('needsCognitiveMap', () => {
  it('is true when there is no map', () => {
    expect(needsCognitiveMap(entry())).toBe(true)
  })

  it('is false when a fresh map exists', () => {
    expect(needsCognitiveMap(entry({
      cognitiveMap: { map: sampleMap, generatedAt: new Date(), model: 'm', version: 1 },
    }))).toBe(false)
  })

  it('is true when the entry was edited after mapping', () => {
    expect(needsCognitiveMap(entry({
      contentEditedAt: new Date('2026-08-16T12:00:00Z'),
      cognitiveMap: {
        map: sampleMap, generatedAt: new Date('2026-08-16T10:00:00Z'), model: 'm', version: 1,
      },
    }))).toBe(true)
  })

  it('is true when the map came from an older schema version', () => {
    expect(needsCognitiveMap(entry({
      cognitiveMap: { map: sampleMap, generatedAt: new Date(), model: 'm', version: 0 },
    }))).toBe(true)
  })

  it('is false for an empty entry', () => {
    expect(needsCognitiveMap(entry({ content: '   ' }))).toBe(false)
  })
})
