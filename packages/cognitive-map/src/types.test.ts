import { describe, it, expect } from 'vitest'
import { isCognitiveMap } from './types'
// The canonical cross-language fixture. Imported rather than read from disk so the
// same test runs unchanged under the jsdom environment, where import.meta.url is not
// a file: URL.
import fixture from '../fixtures/sample-map.json'

describe('isCognitiveMap', () => {
  it('accepts the canonical fixture', () => {
    expect(isCognitiveMap(fixture)).toBe(true)
  })

  it('round-trips the fixture through JSON without loss', () => {
    expect(JSON.parse(JSON.stringify(fixture))).toEqual(fixture)
  })

  it('rejects a map with an unknown beat kind', () => {
    const bad = { ...fixture, beats: [{ ...fixture.beats[0], kind: 'wish' }] }
    expect(isCognitiveMap(bad)).toBe(false)
  })

  it('rejects an edge pointing at a beat that does not exist', () => {
    const bad = { ...fixture, edges: [{ ...fixture.edges[0], to: 'b999' }] }
    expect(isCognitiveMap(bad)).toBe(false)
  })

  it('rejects a map whose version is not 1', () => {
    expect(isCognitiveMap({ ...fixture, v: 2 })).toBe(false)
  })
})
