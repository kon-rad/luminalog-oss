import { describe, it, expect } from 'vitest'
import {
  dayIndexFor, weekIndexFromDayIndex, monthIndexFromDayIndex,
  quarterIndexFromDayIndex, yearIndexFromDayIndex, thursdayDayIndexFromDayIndex,
} from './periodIndex'

const dayIndexForYMD = (y: number, m: number, d: number): number =>
  Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)

describe('dayIndexFor', () => {
  it('matches Math.floor(epochMs / 86_400_000)', () => {
    const date = new Date(Date.UTC(2026, 5, 1))
    expect(dayIndexFor(date)).toBe(Math.floor(date.getTime() / 86_400_000))
  })
})

describe('monthIndexFromDayIndex', () => {
  it('encodes year*12 + zero-based month', () => {
    expect(monthIndexFromDayIndex(dayIndexForYMD(2026, 1, 15))).toBe(2026 * 12 + 0)
    expect(monthIndexFromDayIndex(dayIndexForYMD(2026, 12, 31))).toBe(2026 * 12 + 11)
  })
})

describe('quarterIndexFromDayIndex', () => {
  it('encodes year*4 + zero-based quarter', () => {
    expect(quarterIndexFromDayIndex(dayIndexForYMD(2026, 2, 1))).toBe(2026 * 4 + 0)
    expect(quarterIndexFromDayIndex(dayIndexForYMD(2026, 5, 1))).toBe(2026 * 4 + 1)
    expect(quarterIndexFromDayIndex(dayIndexForYMD(2026, 8, 1))).toBe(2026 * 4 + 2)
    expect(quarterIndexFromDayIndex(dayIndexForYMD(2026, 11, 1))).toBe(2026 * 4 + 3)
  })
})

describe('yearIndexFromDayIndex', () => {
  it('is the calendar year', () => {
    expect(yearIndexFromDayIndex(dayIndexForYMD(2026, 1, 1))).toBe(2026)
    expect(yearIndexFromDayIndex(dayIndexForYMD(2026, 12, 31))).toBe(2026)
  })
})

describe('weekIndexFromDayIndex', () => {
  it('places 2018-12-31 (a Monday) in ISO week 2019-W01, matching the server fixture', () => {
    expect(weekIndexFromDayIndex(dayIndexForYMD(2018, 12, 31))).toBe(2019 * 100 + 1)
  })

  it('places 2021-01-01 (a Friday) in ISO week 2020-W53, matching the server fixture', () => {
    expect(weekIndexFromDayIndex(dayIndexForYMD(2021, 1, 1))).toBe(2020 * 100 + 53)
  })

  it('is stable across every day in the same ISO week', () => {
    expect(weekIndexFromDayIndex(dayIndexForYMD(2026, 6, 1)))
      .toBe(weekIndexFromDayIndex(dayIndexForYMD(2026, 6, 7)))
  })
})

describe('thursdayDayIndexFromDayIndex', () => {
  it('returns the actual Thursday for a boundary-spanning week, matching the server fixture', () => {
    expect(thursdayDayIndexFromDayIndex(dayIndexForYMD(2026, 6, 29))).toBe(dayIndexForYMD(2026, 7, 2))
  })
})
