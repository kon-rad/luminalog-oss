import { describe, it, expect } from 'vitest'
import {
  GOAL_WORDS,
  localDayKey,
  localYesterdayKey,
  nextStats,
  streakStep,
} from '@/lib/stats/dailyGoalStreak'
import type { Stats } from '@/lib/firestore/models'

const TZ = 'America/Los_Angeles'

const emptyStats = (over: Partial<Stats> = {}): Stats => ({
  streakCount: 0,
  maxStreakCount: 0,
  totalWords: 0,
  goalDayWords: 0,
  promptsAnswered: 0,
  ...over,
})

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)

// A wall-clock instant in America/Los_Angeles. All streak tests use June dates
// (PDT = UTC-07:00), matching the shipping iOS test suite.
const la = (y: number, m: number, d: number, hour = 12): Date =>
  new Date(`${y}-${pad(m)}-${pad(d)}T${pad(hour)}:00:00-07:00`)

describe('GOAL_WORDS', () => {
  it('is 750 (matches iOS DailyGoal.wordTarget)', () => {
    expect(GOAL_WORDS).toBe(750)
  })
})

describe('localDayKey', () => {
  it('buckets by local day, not UTC day (Kiritimati UTC+14)', () => {
    // 2026-06-10T12:00Z is already 2026-06-11 in Pacific/Kiritimati (+14).
    const instant = new Date('2026-06-10T12:00:00Z')
    expect(localDayKey(instant, 'Pacific/Kiritimati')).toBe('2026-06-11')
    expect(localDayKey(instant, 'UTC')).toBe('2026-06-10')
  })

  it('11 PM June 9 in LA is still June 9 local though June 10 UTC', () => {
    const instant = la(2026, 6, 9, 23) // 2026-06-10T06:00Z
    expect(localDayKey(instant, 'UTC')).toBe('2026-06-10')
    expect(localDayKey(instant, TZ)).toBe('2026-06-09')
  })
})

describe('localYesterdayKey', () => {
  it('decrements the local calendar day', () => {
    expect(localYesterdayKey(la(2026, 6, 10), TZ)).toBe('2026-06-09')
  })

  it('rolls back across a month boundary', () => {
    expect(localYesterdayKey(la(2026, 6, 1), TZ)).toBe('2026-05-31')
  })

  it('is DST-safe across the spring-forward boundary', () => {
    // 2026-03-08 is a 23-hour day in LA (PST→PDT); day math must stay on parts.
    expect(localYesterdayKey(new Date('2026-03-08T18:00:00-07:00'), TZ)).toBe('2026-03-07')
    expect(localYesterdayKey(new Date('2026-03-09T18:00:00-07:00'), TZ)).toBe('2026-03-08')
  })

  it('handles a large positive offset (Kiritimati)', () => {
    const instant = new Date('2026-06-10T12:00:00Z') // local 2026-06-11
    expect(localYesterdayKey(instant, 'Pacific/Kiritimati')).toBe('2026-06-10')
  })
})

describe('nextStats', () => {
  it('(a) first-ever entry reaching 750 → streak 1', () => {
    const result = nextStats(emptyStats(), 750, la(2026, 6, 10), TZ)
    expect(result.streakCount).toBe(1)
    expect(result.maxStreakCount).toBe(1)
    expect(result.goalDayWords).toBe(750)
    expect(result.totalWords).toBe(750)
    expect(localDayKey(result.lastEntryDate!, TZ)).toBe('2026-06-10')
  })

  it('(b) second qualifying entry same local day → streak unchanged, words accumulate', () => {
    const start = emptyStats({
      streakCount: 4,
      maxStreakCount: 4,
      totalWords: 800,
      lastEntryDate: la(2026, 6, 10, 9),
      goalDayDate: la(2026, 6, 10, 9),
      goalDayWords: 800,
    })
    const result = nextStats(start, 100, la(2026, 6, 10, 21), TZ)
    expect(result.goalDayWords).toBe(900)
    expect(result.totalWords).toBe(900)
    expect(result.streakCount).toBe(4) // already credited today — no double count
  })

  it('(c) consecutive day crossing 750 → streak + 1', () => {
    const start = emptyStats({
      streakCount: 3,
      maxStreakCount: 3,
      totalWords: 100,
      lastEntryDate: la(2026, 6, 9),
    })
    const result = nextStats(start, 800, la(2026, 6, 10), TZ)
    expect(result.streakCount).toBe(4)
    expect(result.maxStreakCount).toBe(4)
    expect(result.goalDayWords).toBe(800)
    expect(localDayKey(result.lastEntryDate!, TZ)).toBe('2026-06-10')
  })

  it('(d) gap day → reset to 1 (max holds)', () => {
    const start = emptyStats({
      streakCount: 9,
      maxStreakCount: 9,
      totalWords: 5000,
      lastEntryDate: la(2026, 6, 6),
    })
    const result = nextStats(start, 800, la(2026, 6, 10), TZ)
    expect(result.streakCount).toBe(1)
    expect(result.maxStreakCount).toBe(9)
    expect(result.goalDayWords).toBe(800)
  })

  it('(e) below-target entry → totalWords grows but streak/lastEntryDate unchanged', () => {
    const start = emptyStats({
      streakCount: 3,
      maxStreakCount: 3,
      totalWords: 100,
      lastEntryDate: la(2026, 6, 9),
    })
    const result = nextStats(start, 300, la(2026, 6, 10), TZ)
    expect(result.totalWords).toBe(400)
    expect(result.goalDayWords).toBe(300)
    expect(result.streakCount).toBe(3)
    // lastEntryDate must not re-anchor to the (unqualified) new day.
    expect(localDayKey(result.lastEntryDate!, TZ)).toBe('2026-06-09')
  })

  it('(f) two below-target entries same day crossing 750 → credits once', () => {
    const start = emptyStats({
      streakCount: 3,
      maxStreakCount: 3,
      totalWords: 100,
      lastEntryDate: la(2026, 6, 9),
    })
    const afterFirst = nextStats(start, 400, la(2026, 6, 10, 9), TZ)
    expect(afterFirst.streakCount).toBe(3) // 400 < 750
    expect(afterFirst.goalDayWords).toBe(400)

    const afterSecond = nextStats(afterFirst, 400, la(2026, 6, 10, 21), TZ)
    expect(afterSecond.goalDayWords).toBe(800)
    expect(afterSecond.streakCount).toBe(4) // crossing credits once

    const afterThird = nextStats(afterSecond, 100, la(2026, 6, 10, 22), TZ)
    expect(afterThird.goalDayWords).toBe(900)
    expect(afterThird.streakCount).toBe(4) // already credited today
  })

  it('(g) timezone edge: 11 PM local yesterday → next-morning entry counts as +1', () => {
    // last entry 2026-06-09 23:00 PDT (= 2026-06-10 06:00Z);
    // new entry 2026-06-10 01:00 PDT (= 2026-06-10 08:00Z).
    // Same UTC calendar day, but local yesterday → today, so streak advances.
    const start = emptyStats({
      streakCount: 3,
      maxStreakCount: 3,
      lastEntryDate: la(2026, 6, 9, 23),
    })
    const result = nextStats(start, 800, la(2026, 6, 10, 1), TZ)
    expect(result.streakCount).toBe(4)
  })
})

describe('streakStep', () => {
  it('no lastEntryDate → 1', () => {
    expect(streakStep(emptyStats(), la(2026, 6, 10), TZ)).toBe(1)
  })

  it('same local day → max(current, 1)', () => {
    const s = emptyStats({ streakCount: 5, lastEntryDate: la(2026, 6, 10, 6) })
    expect(streakStep(s, la(2026, 6, 10, 21), TZ)).toBe(5)
    const zero = emptyStats({ streakCount: 0, lastEntryDate: la(2026, 6, 10, 6) })
    expect(streakStep(zero, la(2026, 6, 10, 21), TZ)).toBe(1)
  })

  it('local yesterday → current + 1', () => {
    const s = emptyStats({ streakCount: 5, lastEntryDate: la(2026, 6, 9) })
    expect(streakStep(s, la(2026, 6, 10), TZ)).toBe(6)
  })

  it('gap → 1', () => {
    const s = emptyStats({ streakCount: 12, lastEntryDate: la(2026, 6, 6) })
    expect(streakStep(s, la(2026, 6, 10), TZ)).toBe(1)
  })
})
