// The Cognitive Map contract. THIS IS THE CANONICAL DEFINITION.
//
// It is mirrored, deliberately, in two other places, because the server and the web
// app deploy as independent rsync'd trees and cannot share a build-time dependency.
// Same reasoning as the AAD context strings in web/src/lib/crypto/aad.ts.
//
//   server/src/services/cognitiveMap/types.ts    (TypeScript)
//   ios/LuminaLog/Core/Models/CognitiveMap.swift (Swift)
//   web                                          (imports this file directly)
//
// The drift guard is fixtures/sample-map.json: every one of those test suites decodes
// it and asserts a round trip. Change a field here and you must change it in the
// fixture, which fails the other suites until they follow.

export type BeatKind = 'event' | 'feeling' | 'belief' | 'intent'

export type Domain = 'craft' | 'body' | 'people' | 'place' | 'mind' | 'money' | 'other'

export type EdgeType =
  | 'caused' | 'because' | 'contradicts' | 'counters' | 'evidence_for' | 'part_of'

export type Polarity = 1 | -1 | 0

export type MentionType = 'person' | 'project' | 'place' | 'practice' | 'org'

export interface Mention {
  surface: string
  type: MentionType
}

export interface Beat {
  /** "b0".."bN". Stable within this map only, never across entries. */
  id: string
  /** 'map' survived pruning and is drawn. 'ledger' is stored but never drawn. */
  tier: 'map' | 'ledger'
  kind: BeatKind
  /** 3 to 7 words. The label on the node. */
  text: string
  /** Verified exact substring of the entry's content. */
  quote: string
  /** UTF-16 offset of `quote` in the entry's content, for highlighting. */
  quoteStart: number
  domain: Domain
  isSpine: boolean
  isKeeper: boolean
  /** 0 to 1, from Pass A. The date-strip test. */
  generality: number
  /** 0 to 1, computed in code. */
  keepScore: number
  /** In-entry edge count, after pruning. */
  degree: number
  mentions: Mention[]
}

export interface Edge {
  from: string
  to: string
  type: EdgeType
  /** Display label, 1 or 2 words: "drained", "lifted". */
  phrasing: string
  polarity: Polarity
}

export interface CognitiveMap {
  v: 1
  beats: Beat[]
  edges: Edge[]
}

const BEAT_KINDS: readonly string[] = ['event', 'feeling', 'belief', 'intent']
const DOMAINS: readonly string[] = ['craft', 'body', 'people', 'place', 'mind', 'money', 'other']
const EDGE_TYPES: readonly string[] = [
  'caused', 'because', 'contradicts', 'counters', 'evidence_for', 'part_of',
]
const MENTION_TYPES: readonly string[] = ['person', 'project', 'place', 'practice', 'org']

function isMention(value: unknown): value is Mention {
  const m = value as Mention
  return !!m && typeof m.surface === 'string' && MENTION_TYPES.includes(m.type)
}

function isBeat(value: unknown): value is Beat {
  const b = value as Beat
  return (
    !!b &&
    typeof b.id === 'string' && b.id.length > 0 &&
    (b.tier === 'map' || b.tier === 'ledger') &&
    BEAT_KINDS.includes(b.kind) &&
    typeof b.text === 'string' &&
    typeof b.quote === 'string' &&
    typeof b.quoteStart === 'number' &&
    DOMAINS.includes(b.domain) &&
    typeof b.isSpine === 'boolean' &&
    typeof b.isKeeper === 'boolean' &&
    typeof b.generality === 'number' &&
    typeof b.keepScore === 'number' &&
    typeof b.degree === 'number' &&
    Array.isArray(b.mentions) && b.mentions.every(isMention)
  )
}

/**
 * Runtime validator. Structural only: it does not re-derive keepScore or verify
 * quotes against an entry (the server does both at extraction time). It DOES check
 * referential integrity, because an edge pointing at a missing beat crashes layout.
 */
export function isCognitiveMap(value: unknown): value is CognitiveMap {
  const m = value as CognitiveMap
  if (!m || m.v !== 1) return false
  if (!Array.isArray(m.beats) || !m.beats.every(isBeat)) return false
  if (!Array.isArray(m.edges)) return false
  const ids = new Set(m.beats.map(b => b.id))
  return m.edges.every(e => {
    const edge = e as Edge
    return (
      !!edge &&
      typeof edge.from === 'string' && ids.has(edge.from) &&
      typeof edge.to === 'string' && ids.has(edge.to) &&
      EDGE_TYPES.includes(edge.type) &&
      typeof edge.phrasing === 'string' &&
      (edge.polarity === 1 || edge.polarity === -1 || edge.polarity === 0)
    )
  })
}
