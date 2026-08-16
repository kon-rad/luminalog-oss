import { describe, it, expect } from 'vitest'
import { layout } from './layout'
import type { CognitiveMap } from './types'
import raw from '../fixtures/sample-map.json'

const fixture = raw as unknown as CognitiveMap

describe('layout', () => {
  it('draws only tier "map" beats', () => {
    const result = layout(fixture)
    expect(result.nodes.map(n => n.id).sort()).toEqual(['b0', 'b1', 'b2', 'b3', 'b4'])
    expect(result.nodes.find(n => n.id === 'b5')).toBeUndefined()
  })

  it('places a cause above its effect', () => {
    const result = layout(fixture)
    const cause = result.nodes.find(n => n.id === 'b0')!
    const effect = result.nodes.find(n => n.id === 'b1')!
    expect(cause.y).toBeLessThan(effect.y)
  })

  it('never overlaps two nodes', () => {
    const { nodes } = layout(fixture)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i]!, b = nodes[j]!
        const disjoint =
          a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y
        expect(disjoint).toBe(true)
      }
    }
  })

  it('is deterministic: identical input gives byte-identical output', () => {
    expect(JSON.stringify(layout(fixture))).toBe(JSON.stringify(layout(fixture)))
  })

  it('emits one layout edge per map-tier graph edge, with its phrasing', () => {
    const { edges } = layout(fixture)
    expect(edges).toHaveLength(4)
    expect(edges.find(e => e.from === 'b0' && e.to === 'b1')!.label).toBe('drained')
  })

  it('carries entity surface forms onto the node as chips', () => {
    const node = layout(fixture).nodes.find(n => n.id === 'b0')!
    expect(node.chips).toEqual(['the beta'])
  })

  it('gives every node a positive size and a non-empty label', () => {
    for (const node of layout(fixture).nodes) {
      expect(node.w).toBeGreaterThan(0)
      expect(node.h).toBeGreaterThan(0)
      expect(node.lines.length).toBeGreaterThan(0)
    }
  })

  it('reports a bounding box that contains every node', () => {
    const { nodes, width, height } = layout(fixture)
    for (const n of nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0)
      expect(n.y).toBeGreaterThanOrEqual(0)
      expect(n.x + n.w).toBeLessThanOrEqual(width)
      expect(n.y + n.h).toBeLessThanOrEqual(height)
    }
  })

  it('handles a single beat with no edges', () => {
    const single: CognitiveMap = { v: 1, beats: [fixture.beats[0]!], edges: [] }
    const result = layout(single)
    expect(result.nodes).toHaveLength(1)
    expect(result.edges).toHaveLength(0)
    expect(result.width).toBeGreaterThan(0)
  })

  it('returns an empty layout for an empty map', () => {
    const result = layout({ v: 1, beats: [], edges: [] })
    expect(result.nodes).toEqual([])
    expect(result.width).toBe(0)
  })

  it('drops edges that touch a ledger beat', () => {
    const withLedgerEdge: CognitiveMap = {
      ...fixture,
      edges: [
        ...fixture.edges,
        { from: 'b5', to: 'b0', type: 'caused', phrasing: 'x', polarity: 0 },
      ],
    }
    expect(layout(withLedgerEdge).edges).toHaveLength(4)
  })

  it('gives a two-line label a taller box than a one-line label', () => {
    const { nodes } = layout(fixture)
    const oneLine = nodes.find(n => n.lines.length === 1 && n.chips.length === 0)
    const twoLine = nodes.find(n => n.lines.length === 2 && n.chips.length === 0)
    if (oneLine && twoLine) expect(twoLine.h).toBeGreaterThan(oneLine.h)
  })
})
