import { describe, it, expect } from 'vitest'
import {
  parseUserFactsRequest, buildEntriesBlock, buildKnownFactsBlock, buildRejectedBlock, parseUserFactOps,
  USER_FACTS_MAX_ENTRIES, USER_FACTS_ENTRY_MAX_CHARS, USER_FACTS_MAX_KNOWN, USER_FACTS_MAX_REJECTED,
  USER_FACTS_MAX_OPS,
} from './userFacts'

const entry = (id: string, text = 'I signed the lease in Forest City today.') =>
  ({ id, date: '2026-09-21', title: 'Lease', text })

const known = (ref: string, extra: Record<string, unknown> = {}) => ({
  ref, category: 'place', subject: 'Kuching', statement: 'You live in Kuching.',
  since: '2026-03-02', userAuthored: false, ...extra,
})

describe('parseUserFactsRequest', () => {
  it('accepts a well-formed body', () => {
    const rejected = [{ category: 'person', statement: 'Tom is your cousin.' }]
    expect(parseUserFactsRequest({ entries: [entry('e1')], facts: [known('f1')], rejected }))
      .toEqual({ entries: [entry('e1')], facts: [known('f1')], rejected })
  })

  it('defaults facts and rejected to empty lists', () => {
    expect(parseUserFactsRequest({ entries: [entry('e1')] }))
      .toEqual({ entries: [entry('e1')], facts: [], rejected: [] })
  })

  it('rejects a body with no entries', () => {
    expect(parseUserFactsRequest({ entries: [] })).toEqual({ error: 'No entries to read' })
    expect(parseUserFactsRequest(undefined)).toEqual({ error: 'No entries to read' })
  })

  it('rejects more than the entry cap instead of dropping any', () => {
    const many = Array.from({ length: USER_FACTS_MAX_ENTRIES + 1 }, (_, i) => entry(`e${i}`))
    expect(parseUserFactsRequest({ entries: many })).toEqual({ error: 'Too many entries' })
  })

  it('rejects a malformed or duplicate entry instead of dropping it', () => {
    expect(parseUserFactsRequest({ entries: [entry('e1'), { id: 'e2', date: 'yesterday', text: 'x' }] }))
      .toEqual({ error: 'Invalid entry' })
    expect(parseUserFactsRequest({ entries: [entry('e1'), entry('e1')] }))
      .toEqual({ error: 'Invalid entry' })
    expect(parseUserFactsRequest({ entries: [{ id: 'e1', date: '2026-09-21', text: '   ' }] }))
      .toEqual({ error: 'Invalid entry' })
  })

  it('truncates long entry text', () => {
    const r = parseUserFactsRequest({ entries: [entry('e1', 'x'.repeat(5000))] }) as any
    expect(r.entries[0].text).toHaveLength(USER_FACTS_ENTRY_MAX_CHARS)
  })

  it('drops malformed known and rejected facts and caps both lists', () => {
    const facts = [
      known('f1'), known('f1'), known('f2', { category: 'pet' }),
      known('f3', { statement: '' }), known('f4', { since: 'March' }),
    ]
    const r = parseUserFactsRequest({
      entries: [entry('e1')], facts, rejected: [{ category: 'pet', statement: 'x' }],
    }) as any
    expect(r.facts.map((f: any) => f.ref)).toEqual(['f1', 'f4'])
    expect(r.facts[1].since).toBeNull()
    expect(r.rejected).toEqual([])

    const lots = Array.from({ length: USER_FACTS_MAX_KNOWN + 10 }, (_, i) => known(`f${i}`))
    const tombs = Array.from({ length: USER_FACTS_MAX_REJECTED + 10 }, (_, i) => ({ category: 'goal', statement: `g${i}` }))
    const capped = parseUserFactsRequest({ entries: [entry('e1')], facts: lots, rejected: tombs }) as any
    expect(capped.facts).toHaveLength(USER_FACTS_MAX_KNOWN)
    expect(capped.facts[0].ref).toBe('f0')
    expect(capped.rejected).toHaveLength(USER_FACTS_MAX_REJECTED)
  })
})

describe('prompt blocks', () => {
  it('labels each entry with its id, date and title', () => {
    expect(buildEntriesBlock([entry('e1'), { id: 'e2', date: '2026-09-22', title: '', text: 'Second.' }]))
      .toBe('[e1 | 2026-09-21 | Lease]\nI signed the lease in Forest City today.\n\n---\n\n[e2 | 2026-09-22]\nSecond.')
  })

  it("renders known facts one per line and marks the user's own", () => {
    expect(buildKnownFactsBlock([
      known('f1') as any,
      known('f2', { subject: '', since: null, userAuthored: true }) as any,
    ])).toBe(
      'f1 | place | Kuching | You live in Kuching. | since 2026-03-02\n' +
      'f2 | place | (no subject) | You live in Kuching. | written by the user',
    )
  })

  it('says so when there are no known or rejected facts', () => {
    expect(buildKnownFactsBlock([])).toBe('(none yet)')
    expect(buildRejectedBlock([])).toBe('(none)')
    expect(buildRejectedBlock([{ category: 'person', statement: 'Tom is your cousin.' }]))
      .toBe('- person: Tom is your cousin.')
  })
})

describe('parseUserFactOps', () => {
  const ctx = { entryIds: new Set(['e1', 'e2']), refs: new Set(['f1', 'f2']) }
  const parse = (ops: unknown[]) => parseUserFactOps(JSON.stringify({ ops }), ctx)

  it('keeps well-formed ops of every kind', () => {
    const ops = [
      { op: 'add', category: 'place', subject: 'Forest City', statement: 'You live in Forest City.', evidence: ['e2'] },
      { op: 'invalidate', ref: 'f1', reason: 'You moved.', evidence: ['e2'] },
      { op: 'update', ref: 'f2', statement: 'Maya is your younger sister in Warsaw.', evidence: ['e1'] },
    ]
    expect(parse(ops)).toEqual(ops)
  })

  it('keeps a confirm and defaults a missing invalidate reason to empty', () => {
    expect(parse([
      { op: 'confirm', ref: 'f1', evidence: ['e1'] },
      { op: 'invalidate', ref: 'f2', evidence: ['e2'] },
    ])).toEqual([
      { op: 'confirm', ref: 'f1', evidence: ['e1'] },
      { op: 'invalidate', ref: 'f2', reason: '', evidence: ['e2'] },
    ])
  })

  it('removes unknown and repeated evidence ids and drops ops left with none', () => {
    expect(parse([
      { op: 'confirm', ref: 'f1', evidence: ['e1', 'zz', 'e1'] },
      { op: 'confirm', ref: 'f2', evidence: ['zz'] },
    ])).toEqual([{ op: 'confirm', ref: 'f1', evidence: ['e1'] }])
  })

  it('drops unknown refs, unknown kinds, incomplete ops, and a second op on the same ref', () => {
    expect(parse([
      { op: 'confirm', ref: 'f9', evidence: ['e1'] },
      { op: 'delete', ref: 'f1', evidence: ['e1'] },
      { op: 'update', ref: 'f1', evidence: ['e1'] },
      { op: 'add', category: 'pet', subject: 'Rex', statement: 'You have a dog.', evidence: ['e1'] },
      { op: 'add', category: 'goal', subject: '', statement: 'Run a marathon.', evidence: ['e1'] },
      { op: 'confirm', ref: 'f1', evidence: ['e1'] },
      { op: 'invalidate', ref: 'f1', reason: 'x', evidence: ['e1'] },
    ])).toEqual([{ op: 'confirm', ref: 'f1', evidence: ['e1'] }])
  })

  it('caps the number of ops', () => {
    const many = Array.from({ length: USER_FACTS_MAX_OPS + 5 }, (_, i) =>
      ({ op: 'add', category: 'goal', subject: `G${i}`, statement: `Goal ${i}.`, evidence: ['e1'] }))
    expect(parse(many)).toHaveLength(USER_FACTS_MAX_OPS)
  })

  it('tolerates prose around the JSON and accepts an empty list', () => {
    expect(parseUserFactOps('Sure:\n{"ops":[]}\nDone', ctx)).toEqual([])
  })

  it('returns null for a reply without an ops array', () => {
    expect(parseUserFactOps('I cannot help with that.', ctx)).toBeNull()
    expect(parseUserFactOps('{"facts":[]}', ctx)).toBeNull()
    expect(parseUserFactOps('{not json}', ctx)).toBeNull()
  })
})
