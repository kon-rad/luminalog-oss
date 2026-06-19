import { describe, it, expect } from 'vitest'
import { nextStats, type GoalStats } from './dailyGoalStreak'

const TZ = 'America/Los_Angeles'
// 2026-06-19 10:00 PT (17:00Z) and the day before.
const day19 = new Date('2026-06-19T17:00:00Z')
const day18 = new Date('2026-06-18T17:00:00Z')

const empty: GoalStats = {
  streakCount: 0,
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
      lastEntryDate: day19,
      totalWords: 800,
      goalDayDate: day19,
      goalDayWords: 800,
    }
    const next = nextStats(credited, -300, day19, TZ)
    expect(next.goalDayWords).toBe(500)
    expect(next.streakCount).toBe(2)
  })
})
