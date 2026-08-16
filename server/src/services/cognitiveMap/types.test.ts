import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isCognitiveMap } from './types'

// The SAME fixture the renderer and iOS decode. This is the drift guard: adding a
// field to the contract in one language fails this test until the others follow.
const fixture = JSON.parse(
  readFileSync(
    join(__dirname, '../../../../packages/cognitive-map/fixtures/sample-map.json'),
    'utf8',
  ),
)

describe('server cognitive map contract', () => {
  it('accepts the canonical fixture shared with the renderer and iOS', () => {
    expect(isCognitiveMap(fixture)).toBe(true)
  })

  it('exposes every field the fixture uses', () => {
    expect(Object.keys(fixture.beats[0]).sort()).toEqual([
      'degree', 'domain', 'generality', 'id', 'isKeeper', 'isSpine',
      'keepScore', 'kind', 'mentions', 'quote', 'quoteStart', 'text', 'tier',
    ])
  })

  it('rejects an edge pointing at a missing beat', () => {
    expect(isCognitiveMap({ ...fixture, edges: [{ ...fixture.edges[0], to: 'nope' }] })).toBe(false)
  })

  it('rejects an unknown beat kind', () => {
    expect(isCognitiveMap({ ...fixture, beats: [{ ...fixture.beats[0], kind: 'wish' }] }))
      .toBe(false)
  })
})
