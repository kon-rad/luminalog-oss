// Server mirror of the Cognitive Map contract.
//
// CANONICAL DEFINITION: packages/cognitive-map/src/types.ts. This file duplicates it
// deliberately, because the server deploys as an independent rsync'd tree and cannot
// take a build-time dependency on packages/. Same reasoning as the AAD context
// strings, which are duplicated across iOS, server, and web on purpose.
//
// The drift guard is packages/cognitive-map/fixtures/sample-map.json, decoded by this
// suite, the renderer suite, and the iOS test target.

export type BeatKind = 'event' | 'feeling' | 'belief' | 'intent'
export type Domain = 'craft' | 'body' | 'people' | 'place' | 'mind' | 'money' | 'other'
export type EdgeType =
  | 'caused' | 'because' | 'contradicts' | 'counters' | 'evidence_for' | 'part_of'
export type Polarity = 1 | -1 | 0
export type MentionType = 'person' | 'project' | 'place' | 'practice' | 'org'

export const BEAT_KINDS: readonly BeatKind[] = ['event', 'feeling', 'belief', 'intent']
export const DOMAINS: readonly Domain[] =
  ['craft', 'body', 'people', 'place', 'mind', 'money', 'other']
export const EDGE_TYPES: readonly EdgeType[] =
  ['caused', 'because', 'contradicts', 'counters', 'evidence_for', 'part_of']
export const MENTION_TYPES: readonly MentionType[] =
  ['person', 'project', 'place', 'practice', 'org']

export interface Mention { surface: string; type: MentionType }

export interface Beat {
  id: string
  tier: 'map' | 'ledger'
  kind: BeatKind
  text: string
  quote: string
  quoteStart: number
  domain: Domain
  isSpine: boolean
  isKeeper: boolean
  generality: number
  keepScore: number
  degree: number
  mentions: Mention[]
}

export interface Edge {
  from: string
  to: string
  type: EdgeType
  phrasing: string
  polarity: Polarity
}

export interface CognitiveMap { v: 1; beats: Beat[]; edges: Edge[] }

/**
 * What Pass A returns, after quote verification but before deduping, edges, pruning,
 * and scoring. Deliberately a different type from `Beat`: the fields the model
 * supplies and the fields we compute must not be confusable.
 */
export interface CandidateBeat {
  id: string
  kind: BeatKind
  text: string
  quote: string
  quoteStart: number
  domain: Domain
  isSpine: boolean
  generality: number
  mentions: Mention[]
}

function isMention(value: unknown): value is Mention {
  const m = value as Mention
  return !!m && typeof m.surface === 'string' && MENTION_TYPES.includes(m.type as MentionType)
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
