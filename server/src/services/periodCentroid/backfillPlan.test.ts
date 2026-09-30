import { describe, it, expect } from 'vitest'
import { planLocalDays } from './backfillPlan'

const day = (y: number, m: number, d: number) => Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)

describe('planLocalDays', () => {
  it('buckets entries by their local day in the profile timezone', () => {
    const plan = planLocalDays([
      { id: 'early', createdAt: new Date('2026-09-25T23:30:00Z') }, // 07:30 Sat in KL
      { id: 'late', createdAt: new Date('2026-09-26T12:00:00Z') },  // 20:00 Sat in KL
    ], 'Asia/Kuala_Lumpur')
    expect(plan.localDayByEntry.get('early')).toBe(day(2026, 9, 26))
    expect(plan.localDayByEntry.get('late')).toBe(day(2026, 9, 26))
    expect(plan.days).toEqual([day(2026, 9, 26)])
  })

  it('uses UTC without a timezone', () => {
    const plan = planLocalDays([{ id: 'e', createdAt: new Date('2026-09-25T23:30:00Z') }], undefined)
    expect(plan.days).toEqual([day(2026, 9, 25)])
  })

  it('skips entries with no timestamp and sorts days ascending', () => {
    const plan = planLocalDays([
      { id: 'b', createdAt: new Date('2026-09-27T10:00:00Z') },
      { id: 'none', createdAt: null },
      { id: 'a', createdAt: new Date('2026-09-20T10:00:00Z') },
    ], 'UTC')
    expect(plan.skippedNoDate).toBe(1)
    expect(plan.noDateEntryIds).toEqual(['none'])
    expect(plan.localDayByEntry.has('none')).toBe(false)
    expect(plan.days).toEqual([day(2026, 9, 20), day(2026, 9, 27)])
  })

  it('routes entries with a missing or invalid date to the fallback list, not the day map', () => {
    const plan = planLocalDays([
      { id: 'nul', createdAt: null },
      { id: 'bad', createdAt: new Date('nope') },
      { id: 'ok', createdAt: new Date('2026-09-20T10:00:00Z') },
    ], 'UTC')
    expect(plan.noDateEntryIds).toEqual(['nul', 'bad'])
    expect(plan.days).toEqual([day(2026, 9, 20)])
  })
})
