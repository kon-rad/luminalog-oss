import { describe, it, expect } from 'vitest'
import {
  parsePeriodSummaryRequest, buildChildrenBlock, parsePeriodSummary,
  PERIOD_SUMMARY_MAX_CHILDREN, PERIOD_SUMMARY_CHILD_MAX_CHARS, PERIOD_SUMMARY_EXCERPT_MAX_CHARS,
  type PeriodSummaryRequest,
} from './periodSummary'

/** A normalized child, as `parsePeriodSummaryRequest` returns it. `id` defaults to the label. */
const child = (label: string, text: string, extra: Record<string, unknown> = {}) =>
  ({ id: label, label, text, anchors: [], threads: [], ...extra })

const dayReq: PeriodSummaryRequest = {
  periodType: 'day', periodLabel: 'Sat 26 Sep 2026', isOpen: false,
  children: [
    child('08:05 · text', 'You woke early to write.', { id: 'e1', excerpt: 'Woke at 6, could not stop thinking about the launch.' }),
    child('18:30 · voice', 'You walked by the sea with Mira.', { id: 'e2', excerpt: 'Mira said the sea looks like it is breathing.' }),
  ],
}

const weekReq: PeriodSummaryRequest = {
  periodType: 'week', periodLabel: 'Week of Mon 21 Sep 2026', isOpen: false,
  children: [
    child('Mon 21 Sep 2026', 'You shipped the app.', {
      id: 'day_20717', salience: 8,
      anchors: [{ entryId: 'e9', quote: 'I pressed the button and just sat there.' }],
      threads: ['Argo launch'],
    }),
  ],
}

const reply = (fields: Record<string, unknown>) => JSON.stringify({
  title: 'The launch', sentence: 'You shipped.', summary: 'A week of shipping.', salience: 7, ...fields,
})

describe('parsePeriodSummaryRequest', () => {
  it('accepts a well-formed body', () => {
    const r = parsePeriodSummaryRequest({
      periodType: 'week', periodLabel: 'Week of Mon 21 Sep 2026', isOpen: true,
      children: [child('Mon 21 Sep 2026', 'You shipped the app.')],
    })
    expect(r).toEqual({
      periodType: 'week', periodLabel: 'Week of Mon 21 Sep 2026', isOpen: true,
      children: [child('Mon 21 Sep 2026', 'You shipped the app.')],
    })
  })

  it('rejects an unknown periodType', () => {
    expect(parsePeriodSummaryRequest({ periodType: 'decade', periodLabel: 'x', children: [child('a', 'b')] }))
      .toEqual({ error: 'Invalid periodType' })
  })

  it('rejects a missing label', () => {
    expect(parsePeriodSummaryRequest({ periodType: 'day', periodLabel: '  ', children: [child('a', 'b')] }))
      .toEqual({ error: 'Missing periodLabel' })
  })

  it('rejects when no child has an id and usable text', () => {
    expect(parsePeriodSummaryRequest({ periodType: 'day', periodLabel: 'x', children: [child('a', '   '), { label: 'b', text: 'no id' }] }))
      .toEqual({ error: 'No children to summarize' })
    expect(parsePeriodSummaryRequest({ periodType: 'day', periodLabel: 'x' }))
      .toEqual({ error: 'No children to summarize' })
  })

  it('defaults isOpen to false, truncates long text, and keeps the most recent children', () => {
    const many = Array.from({ length: PERIOD_SUMMARY_MAX_CHILDREN + 5 }, (_, i) => child(`c${i}`, 'x'.repeat(2000)))
    const r = parsePeriodSummaryRequest({ periodType: 'all', periodLabel: 'All time', children: many }) as any
    expect(r.isOpen).toBe(false)
    expect(r.children).toHaveLength(PERIOD_SUMMARY_MAX_CHILDREN)
    expect(r.children[0].label).toBe('c5')
    expect(r.children[0].text).toHaveLength(PERIOD_SUMMARY_CHILD_MAX_CHARS)
  })

  it('normalizes the grounding fields and drops malformed ones', () => {
    const r = parsePeriodSummaryRequest({
      periodType: 'week', periodLabel: 'w',
      children: [{
        id: ' d1 ', label: 'Mon', text: 'T', excerpt: 'y'.repeat(900), salience: 14.6,
        anchors: [{ entryId: 'e1', quote: ' Q1 ' }, { entryId: '', quote: 'no id' }, { entryId: 'e2', quote: 'Q2' },
                  { entryId: 'e3', quote: 'Q3' }, { entryId: 'e4', quote: 'Q4' }],
        threads: [' Argo ', '', 'sleep', 'a', 'b', 'c', 'd'],
      }],
    }) as any
    const c = r.children[0]
    expect(c.id).toBe('d1')
    expect(c.excerpt).toHaveLength(PERIOD_SUMMARY_EXCERPT_MAX_CHARS)
    expect(c.salience).toBe(10)
    expect(c.anchors).toEqual([{ entryId: 'e1', quote: 'Q1' }, { entryId: 'e2', quote: 'Q2' }, { entryId: 'e3', quote: 'Q3' }])
    expect(c.threads).toEqual(['Argo', 'sleep', 'a', 'b', 'c'])
  })

  it('rejects a non-object body', () => {
    expect(parsePeriodSummaryRequest(undefined)).toEqual({ error: 'Invalid periodType' })
  })
})

describe('buildChildrenBlock', () => {
  it('labels each child and separates them', () => {
    expect(buildChildrenBlock([child('Mon', 'one'), child('Tue', 'two')]))
      .toBe('[Mon]\none\n\n---\n\n[Tue]\ntwo')
  })

  it('shows excerpts, salience, quotes, and threads with the entry ids the model may cite', () => {
    expect(buildChildrenBlock(dayReq.children.slice(0, 1)))
      .toBe('[08:05 · text]\nYou woke early to write.\nIn their own words (entry e1): "Woke at 6, could not stop thinking about the launch."')
    expect(buildChildrenBlock(weekReq.children))
      .toBe('[Mon 21 Sep 2026] (salience 8)\nYou shipped the app.\nQuote (entry e9): "I pressed the button and just sat there."\nThreads: Argo launch')
  })
})

describe('parsePeriodSummary', () => {
  it('parses strict JSON', () => {
    expect(parsePeriodSummary('{"title":"The rebuild","sentence":"You rebuilt the app.","summary":"A long week.","salience":6}', dayReq))
      .toEqual({
        title: 'The rebuild', sentence: 'You rebuilt the app.', summary: 'A long week.', salience: 6,
        anchors: [], keyScenes: { high: null, low: null, turning: null }, threads: [],
      })
  })

  it('tolerates prose around the JSON and trims', () => {
    expect(parsePeriodSummary('Here you go:\n{"title":" T ","sentence":"  S. ","summary":" Body. ","salience":"4"}\nThanks', dayReq))
      .toMatchObject({ title: 'T', sentence: 'S.', summary: 'Body.', salience: 4 })
  })

  it('strips trailing punctuation and wrapping quotes from the title', () => {
    expect(parsePeriodSummary(reply({ title: '"Launch week."' }), dayReq)?.title).toBe('Launch week')
  })

  it('caps a runaway title at six words', () => {
    expect(parsePeriodSummary(reply({ title: 'one two three four five six seven eight' }), dayReq)?.title)
      .toBe('one two three four five six')
  })

  it('rounds and clamps salience to 1..10', () => {
    expect(parsePeriodSummary(reply({ salience: 0 }), dayReq)?.salience).toBe(1)
    expect(parsePeriodSummary(reply({ salience: 11 }), dayReq)?.salience).toBe(10)
    expect(parsePeriodSummary(reply({ salience: 6.6 }), dayReq)?.salience).toBe(7)
  })

  it('returns null when a required field is missing or empty', () => {
    expect(parsePeriodSummary('{"title":"T","sentence":"S.","salience":5}', dayReq)).toBeNull()
    expect(parsePeriodSummary('{"title":"T","sentence":"","summary":"B","salience":5}', dayReq)).toBeNull()
    expect(parsePeriodSummary('{"sentence":"S.","summary":"B.","salience":5}', dayReq)).toBeNull()
    expect(parsePeriodSummary('{"title":" . ","sentence":"S.","summary":"B.","salience":5}', dayReq)).toBeNull()
    expect(parsePeriodSummary('{"title":"T","sentence":"S.","summary":"B."}', dayReq)).toBeNull()
    expect(parsePeriodSummary('{"title":"T","sentence":"S.","summary":"B.","salience":"high"}', dayReq)).toBeNull()
  })

  it('returns null for non-JSON', () => {
    expect(parsePeriodSummary('I cannot do that.', dayReq)).toBeNull()
    expect(parsePeriodSummary('{not json}', dayReq)).toBeNull()
  })

  it('keeps a day anchor that quotes its entry verbatim, ignoring case, spacing, and quote style', () => {
    const r = parsePeriodSummary(reply({
      anchors: [{ entryId: 'e2', quote: 'Mira said the sea looks like it’s breathing' }, { entryId: 'e1', quote: 'could  NOT stop thinking' }],
    }), dayReq)
    // The first quote swaps "it is" for "it's": a paraphrase, dropped. The second matches after normalization
    // and is stored as the source's own text, not the model's casing and spacing.
    expect(r?.anchors).toEqual([{ entryId: 'e1', quote: 'could not stop thinking' }])
  })

  it('stores the matching substring of the day excerpt, preserving the user\'s casing, spacing, and quotes', () => {
    const req: PeriodSummaryRequest = {
      ...dayReq,
      children: [child('08:05 · text', 'You wrote.', { id: 'e1', excerpt: 'Then I said “GO   now,” and Left.' })],
    }
    const r = parsePeriodSummary(reply({ anchors: [{ entryId: 'e1', quote: 'i said "go now," and left' }] }), req)
    expect(r?.anchors).toEqual([{ entryId: 'e1', quote: 'I said “GO   now,” and Left' }])
  })

  it('stores the matching substring of the child anchor quote on higher tiers', () => {
    const r = parsePeriodSummary(reply({ anchors: [{ entryId: 'e9', quote: 'JUST  sat THERE' }] }), weekReq)
    expect(r?.anchors).toEqual([{ entryId: 'e9', quote: 'just sat there' }])
  })

  it('drops an anchor under three words even when it is verbatim', () => {
    const r = parsePeriodSummary(reply({
      anchors: [{ entryId: 'e1', quote: 'Woke' }, { entryId: 'e1', quote: 'the launch' }, { entryId: 'e1', quote: 'Woke at 6' }],
    }), dayReq)
    expect(r?.anchors).toEqual([{ entryId: 'e1', quote: 'Woke at 6' }])
  })

  it('counts words in Japanese, Chinese and Thai, which have no spaces between words', () => {
    const unspacedReq: PeriodSummaryRequest = {
      ...dayReq,
      children: [
        child('08:05 · text', 'You could not sleep.', { id: 'j1', excerpt: '昨日は全然眠れなかった。' }),
        child('09:10 · text', 'You went for a walk.', { id: 'z1', excerpt: '今天去海边散步了。' }),
        child('10:15 · text', 'You could not sleep.', { id: 't1', excerpt: 'ฉันนอนไม่หลับเลย ไปทะเล' }),
      ],
    }
    const r = parsePeriodSummary(reply({
      anchors: [
        { entryId: 'j1', quote: '昨日は' },           // 昨日|は, dropped
        { entryId: 'j1', quote: '全然眠れなかった' }, // kept
        { entryId: 't1', quote: 'ไปทะเล' },            // ไป|ทะเล, dropped
        { entryId: 'z1', quote: '去海边散步' },       // 去|海边|散步, kept
        { entryId: 't1', quote: 'ฉันนอนไม่หลับเลย' }, // kept
      ],
    }), unspacedReq)
    expect(r?.anchors).toEqual([
      { entryId: 'j1', quote: '全然眠れなかった' },
      { entryId: 'z1', quote: '去海边散步' },
      { entryId: 't1', quote: 'ฉันนอนไม่หลับเลย' },
    ])
  })

  it('drops an anchor whose quote is not in the cited input', () => {
    const r = parsePeriodSummary(reply({
      anchors: [
        { entryId: 'e1', quote: 'Mira said the sea looks like it is breathing.' }, // real quote, wrong entry
        { entryId: 'e3', quote: 'Woke at 6' },                                     // entry never sent
        { entryId: 'e1', quote: 'You woke early to write.' },                      // quotes the AI summary, not their words
      ],
    }), dayReq)
    expect(r?.anchors).toEqual([])
  })

  it('carries a child anchor up a tier, with the entry id it already had', () => {
    const r = parsePeriodSummary(reply({ anchors: [{ entryId: 'e9', quote: 'just sat there' }] }), weekReq)
    expect(r?.anchors).toEqual([{ entryId: 'e9', quote: 'just sat there' }])
  })

  it('keeps at most three anchors', () => {
    const quotes = ['Woke at 6', 'could not stop', 'stop thinking about', 'about the launch'].map(q => ({ entryId: 'e1', quote: q }))
    expect(parsePeriodSummary(reply({ anchors: quotes }), dayReq)?.anchors).toHaveLength(3)
  })

  it('never treats a day child\'s text as quotable, even without an excerpt', () => {
    const req: PeriodSummaryRequest = { ...dayReq, children: [child('09:00 · text', 'You felt calm.', { id: 'e5' })] }
    expect(parsePeriodSummary(reply({ anchors: [{ entryId: 'e5', quote: 'You felt calm.' }] }), req)?.anchors).toEqual([])
  })

  it('drops a key scene that names an unseen entry', () => {
    const r = parsePeriodSummary(reply({ keyScenes: { high: 'e2', low: 'e7', turning: null } }), dayReq)
    expect(r?.keyScenes).toEqual({ high: 'e2', low: null, turning: null })
    const w = parsePeriodSummary(reply({ keyScenes: { high: 'e9', low: 'day_20717', turning: 'e9' } }), weekReq)
    expect(w?.keyScenes).toEqual({ high: 'e9', low: null, turning: 'e9' })
  })

  it('cleans threads: trims, dedupes case-insensitively, caps count and length', () => {
    const r = parsePeriodSummary(reply({ threads: [' Argo launch ', 'argo LAUNCH', '', 'sleep', 'x'.repeat(80), 'a', 'b', 'c'] }), dayReq)
    expect(r?.threads).toEqual(['Argo launch', 'sleep', 'x'.repeat(40), 'a', 'b'])
  })
})
