import { describe, it, expect } from 'vitest'
import { breakCycles, assignRanks, orderRanks, edgeKey } from './rank'
import type { Edge } from './types'

const e = (from: string, to: string): Edge =>
  ({ from, to, type: 'caused', phrasing: 'led to', polarity: 0 })

describe('breakCycles', () => {
  it('leaves an acyclic graph untouched', () => {
    const edges = [e('a', 'b'), e('b', 'c')]
    const out = breakCycles(['a', 'b', 'c'], edges)
    expect(out.reversed.size).toBe(0)
    expect(out.acyclic).toHaveLength(2)
  })

  it('reverses exactly one edge in a three-cycle', () => {
    const edges = [e('a', 'b'), e('b', 'c'), e('c', 'a')]
    const out = breakCycles(['a', 'b', 'c'], edges)
    expect(out.reversed.size).toBe(1)
    // The reversed edge is flipped in the acyclic set, not dropped.
    expect(out.acyclic).toHaveLength(3)
  })

  it('drops self-edges entirely', () => {
    const out = breakCycles(['a'], [e('a', 'a')])
    expect(out.acyclic).toHaveLength(0)
  })

  it('is deterministic across runs', () => {
    const edges = [e('a', 'b'), e('b', 'c'), e('c', 'a'), e('a', 'c')]
    const first = breakCycles(['a', 'b', 'c'], edges)
    const second = breakCycles(['a', 'b', 'c'], edges)
    expect([...first.reversed]).toEqual([...second.reversed])
  })
})

describe('assignRanks', () => {
  it('ranks a chain by longest path from the sources', () => {
    const ranks = assignRanks(['a', 'b', 'c'], [e('a', 'b'), e('b', 'c')])
    expect(ranks.get('a')).toBe(0)
    expect(ranks.get('b')).toBe(1)
    expect(ranks.get('c')).toBe(2)
  })

  it('uses the LONGEST path, not the shortest', () => {
    // a to c directly, and a to b to c. c must sit below b.
    const ranks = assignRanks(['a', 'b', 'c'], [e('a', 'b'), e('b', 'c'), e('a', 'c')])
    expect(ranks.get('c')).toBe(2)
  })

  it('puts every isolated beat at rank 0', () => {
    const ranks = assignRanks(['a', 'b'], [])
    expect(ranks.get('a')).toBe(0)
    expect(ranks.get('b')).toBe(0)
  })
})

describe('orderRanks', () => {
  it('groups ids by rank, preserving input order within a rank', () => {
    const ranks = new Map([['a', 0], ['b', 0], ['c', 1]])
    expect(orderRanks(ranks, [e('a', 'c')])).toEqual([['a', 'b'], ['c']])
  })

  it('reduces crossings by barycenter ordering', () => {
    // Rank 0 is [x, y]; x feeds q and y feeds p. Ordering rank 1 as [q, p] removes
    // the crossing that [p, q] would produce.
    const ranks = new Map([['x', 0], ['y', 0], ['p', 1], ['q', 1]])
    const ordered = orderRanks(ranks, [e('x', 'q'), e('y', 'p')])
    expect(ordered[1]).toEqual(['q', 'p'])
  })
})

describe('edgeKey', () => {
  it('formats from and to', () => {
    expect(edgeKey({ from: 'a', to: 'b' })).toBe('a->b')
  })
})
