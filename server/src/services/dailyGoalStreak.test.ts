import { describe, it, expect } from 'vitest'
import { nextStats, dayIndex, safeTimeZone, type GoalStats } from './dailyGoalStreak'

const TZ = 'America/Los_Angeles'
// 2026-06-19 10:00 PT (17:00Z) and the day before.
const day19 = new Date('2026-06-19T17:00:00Z')
const day18 = new Date('2026-06-18T17:00:00Z')

const empty: GoalStats = {
  streakCount: 0,
  maxStreakCount: 0,
  lastEntryDate: null,
  totalWords: 0,
  goalDayDate: null,
  goalDayWords: 0,
}

describe('nextStats', () => {
  it('accumulates words for the same day without crossing the goal', () => {
    const next = nextStats(empty, 100, day19, TZ)
    expect(next.goalDayWords).toBe(100)
    expect(next.totalWords).toBe(100)
    expect(next.streakCount).toBe(0)
  })

  it('crossing 750 in a day starts the streak at 1', () => {
    const next = nextStats(
      { ...empty, goalDayDate: day19, goalDayWords: 700 },
      60,
      day19,
      TZ,
    )
    expect(next.goalDayWords).toBe(760)
    expect(next.streakCount).toBe(1)
    expect(next.lastEntryDate?.getTime()).toBe(day19.getTime())
  })

  it('does not double-credit the streak once a day already qualified', () => {
    const credited: GoalStats = {
      streakCount: 1,
      maxStreakCount: 1,
      lastEntryDate: day19,
      totalWords: 800,
      goalDayDate: day19,
      goalDayWords: 800,
    }
    const next = nextStats(credited, 50, day19, TZ)
    expect(next.goalDayWords).toBe(850)
    expect(next.streakCount).toBe(1)
  })

  it('a new qualifying day adjacent to the last increments the streak', () => {
    const prev: GoalStats = {
      streakCount: 3,
      maxStreakCount: 3,
      lastEntryDate: day18,
      totalWords: 3000,
      goalDayDate: day18,
      goalDayWords: 900,
    }
    const next = nextStats(prev, 800, day19, TZ)
    expect(next.goalDayDate?.getTime()).toBe(day19.getTime())
    expect(next.goalDayWords).toBe(800)
    expect(next.streakCount).toBe(4)
  })

  it('negative delta lowers the day total but never revokes a credited streak', () => {
    const credited: GoalStats = {
      streakCount: 2,
      maxStreakCount: 2,
      lastEntryDate: day19,
      totalWords: 800,
      goalDayDate: day19,
      goalDayWords: 800,
    }
    const next = nextStats(credited, -300, day19, TZ)
    expect(next.goalDayWords).toBe(500)
    expect(next.streakCount).toBe(2)
  })

  it('seeds maxStreakCount to the first credited streak', () => {
    const next = nextStats(
      { ...empty, goalDayDate: day19, goalDayWords: 700 },
      60,
      day19,
      TZ,
    )
    expect(next.streakCount).toBe(1)
    expect(next.maxStreakCount).toBe(1)
  })

  it('raises maxStreakCount as the current streak grows', () => {
    const prev: GoalStats = {
      streakCount: 3,
      maxStreakCount: 3,
      lastEntryDate: day18,
      totalWords: 3000,
      goalDayDate: day18,
      goalDayWords: 900,
    }
    const next = nextStats(prev, 800, day19, TZ)
    expect(next.streakCount).toBe(4)
    expect(next.maxStreakCount).toBe(4)
  })

  it('keeps the best maxStreakCount when the current streak resets', () => {
    // Last credited day is day18; jumping to day20 is a 2-day gap → reset to 1.
    const day20 = new Date('2026-06-20T17:00:00Z')
    const prev: GoalStats = {
      streakCount: 5,
      maxStreakCount: 5,
      lastEntryDate: day18,
      totalWords: 5000,
      goalDayDate: day18,
      goalDayWords: 900,
    }
    const next = nextStats(prev, 800, day20, TZ)
    expect(next.streakCount).toBe(1)
    expect(next.maxStreakCount).toBe(5)
  })
})

describe('safeTimeZone', () => {
  it('passes through a valid IANA zone', () => {
    expect(safeTimeZone('America/Los_Angeles')).toBe('America/Los_Angeles')
  })
  it('falls back to UTC for empty/invalid zones', () => {
    expect(safeTimeZone(undefined)).toBe('UTC')
    expect(safeTimeZone('')).toBe('UTC')
    expect(safeTimeZone('Not/AZone')).toBe('UTC')
  })
})

describe('dayIndex', () => {
  it('does not throw on an invalid stored timezone (falls back to UTC)', () => {
    const d = new Date('2026-06-19T18:00:00Z')
    expect(() => dayIndex(d, 'Not/AZone')).not.toThrow()
    expect(dayIndex(d, 'Not/AZone')).toBe(dayIndex(d, 'UTC'))
  })

  it('gives the same integer for two instants on the same LA calendar day', () => {
    const morning = new Date('2026-06-19T16:00:00Z') // 09:00 PT
    const evening = new Date('2026-06-19T23:00:00Z') // 16:00 PT
    expect(dayIndex(morning, 'America/Los_Angeles')).toBe(
      dayIndex(evening, 'America/Los_Angeles'),
    )
  })

  it('gives adjacent integers for consecutive days', () => {
    const d1 = new Date('2026-06-19T18:00:00Z')
    const d2 = new Date('2026-06-20T18:00:00Z')
    expect(dayIndex(d2, 'UTC') - dayIndex(d1, 'UTC')).toBe(1)
  })
})
