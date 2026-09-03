import { describe, it, expect } from 'vitest'
import {
  weekIndexFromDayIndex, monthIndexFromDayIndex, quarterIndexFromDayIndex,
  yearIndexFromDayIndex, LIFETIME_INDEX, thursdayDayIndexFromDayIndex,
} from './periodIndex'

const dayIndexFor = (y: number, m: number, d: number): number =>
  Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)

describe('monthIndexFromDayIndex', () => {
  it('encodes year*12 + zero-based month', () => {
    expect(monthIndexFromDayIndex(dayIndexFor(2026, 1, 15))).toBe(2026 * 12 + 0)
    expect(monthIndexFromDayIndex(dayIndexFor(2026, 12, 31))).toBe(2026 * 12 + 11)
  })

  it('is stable across every day in the same month', () => {
    expect(monthIndexFromDayIndex(dayIndexFor(2026, 6, 1)))
      .toBe(monthIndexFromDayIndex(dayIndexFor(2026, 6, 30)))
  })
})

describe('quarterIndexFromDayIndex', () => {
  it('encodes year*4 + zero-based quarter', () => {
    expect(quarterIndexFromDayIndex(dayIndexFor(2026, 2, 1))).toBe(2026 * 4 + 0)
    expect(quarterIndexFromDayIndex(dayIndexFor(2026, 5, 1))).toBe(2026 * 4 + 1)
    expect(quarterIndexFromDayIndex(dayIndexFor(2026, 8, 1))).toBe(2026 * 4 + 2)
    expect(quarterIndexFromDayIndex(dayIndexFor(2026, 11, 1))).toBe(2026 * 4 + 3)
  })
})

describe('yearIndexFromDayIndex', () => {
  it('is the calendar year', () => {
    expect(yearIndexFromDayIndex(dayIndexFor(2026, 1, 1))).toBe(2026)
    expect(yearIndexFromDayIndex(dayIndexFor(2026, 12, 31))).toBe(2026)
  })
})

describe('weekIndexFromDayIndex', () => {
  it('places 2018-12-31 (a Monday) in ISO week 2019-W01', () => {
    // Canonical ISO 8601 edge case: 2019-01-01 is a Tuesday, so the Monday two
    // days before it already belongs to the new ISO week-numbering year.
    expect(weekIndexFromDayIndex(dayIndexFor(2018, 12, 31))).toBe(2019 * 100 + 1)
  })

  it('places 2021-01-01 (a Friday) in ISO week 2020-W53', () => {
    // Canonical ISO 8601 edge case: 2020 is a 53-week year, and Jan 1-3 2021
    // fall before the first Monday of 2021 (Jan 4), so they roll back to it.
    expect(weekIndexFromDayIndex(dayIndexFor(2021, 1, 1))).toBe(2020 * 100 + 53)
  })

  it('is stable across every day in the same ISO week', () => {
    // 2026-06-01 is a Monday; 2026-06-07 is the following Sunday.
    expect(weekIndexFromDayIndex(dayIndexFor(2026, 6, 1)))
      .toBe(weekIndexFromDayIndex(dayIndexFor(2026, 6, 7)))
  })

  it('advances between adjacent weeks', () => {
    expect(weekIndexFromDayIndex(dayIndexFor(2026, 6, 8)))
      .toBeGreaterThan(weekIndexFromDayIndex(dayIndexFor(2026, 6, 1)))
  })
})

describe('thursdayDayIndexFromDayIndex', () => {
  it('is stable across every day in the same ISO week', () => {
    const monday = dayIndexFor(2026, 6, 1)
    const sunday = dayIndexFor(2026, 6, 7)
    expect(thursdayDayIndexFromDayIndex(monday)).toBe(thursdayDayIndexFromDayIndex(sunday))
  })

  it('returns the actual Thursday for a boundary-spanning week', () => {
    // 2026-06-29 (Mon) .. 2026-07-05 (Sun) is one ISO week; its Thursday is 2026-07-02.
    const monday = dayIndexFor(2026, 6, 29)
    expect(thursdayDayIndexFromDayIndex(monday)).toBe(dayIndexFor(2026, 7, 2))
  })
})

describe('LIFETIME_INDEX', () => {
  it('is a fixed constant', () => {
    expect(LIFETIME_INDEX).toBe(0)
  })
})
