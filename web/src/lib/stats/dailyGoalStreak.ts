// Goal-gated streak computation, ported EXACTLY from the shipping iOS logic:
//   - `Core/Persistence/DailyGoalStreak.swift`  (nextStats: totalWords add,
//     day-accumulator, qualify-and-credit-once)
//   - `Core/Persistence/StreakCalculator.swift` (streakStep: yesterday → +1,
//     today → keep, gap → reset to 1)
// The 750-word goal comes from `Core/Models/DailyGoal.swift` (wordTarget).
//
// Day equality MUST use the USER's timezone, not the browser's. iOS uses a
// Gregorian `Calendar` in the user tz and `isDate(_:inSameDayAs:)`; we mirror
// that with a timezone-local `YYYY-MM-DD` day key (`localDayKey`) and compare
// keys. "Local yesterday" is computed by decrementing the local calendar date
// purely on its Y/M/D parts (via a neutral UTC calendar), so it is DST-safe and
// correct even for large offsets (e.g. Pacific/Kiritimati, UTC+14).

import type { Stats } from '@/lib/firestore/models'

/** Fixed daily journaling goal (~"Morning Pages", 750 words). */
export const GOAL_WORDS = 750

const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`)

/**
 * The user-timezone-local calendar day of `date` as a `YYYY-MM-DD` key.
 * Uses `en-CA` which formats as `YYYY-MM-DD`. Two instants share a local day
 * iff their keys are equal — the JS equivalent of `Calendar.isDate(_,
 * inSameDayAs:)` in that timezone.
 */
export const localDayKey = (date: Date, timezone: string): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)

/**
 * The `YYYY-MM-DD` key of the local calendar day BEFORE `date`'s local day.
 * We take the entry's local Y/M/D and decrement it as an abstract calendar
 * date using a neutral UTC vehicle (UTC has no DST and correct month/year
 * rollover), so this matches iOS `calendar.date(byAdding:.day,value:-1,...)`
 * without any offset/DST edge cases.
 */
export const localYesterdayKey = (date: Date, timezone: string): string => {
  const key = localDayKey(date, timezone)
  const [y, m, d] = key.split('-').map(Number)
  const prev = new Date(Date.UTC(y, m - 1, d) - 86_400_000)
  return `${prev.getUTCFullYear()}-${pad2(prev.getUTCMonth() + 1)}-${pad2(prev.getUTCDate())}`
}

/**
 * Pure day-adjacency streak step — ported from `StreakCalculator.nextStats`.
 * Returns the streak value the entry's qualifying day should have. Called only
 * on the day a goal is newly crossed (see `nextStats`).
 */
export const streakStep = (current: Stats, entryDate: Date, timezone: string): number => {
  const last = current.lastEntryDate
  if (!last) return 1

  const entryKey = localDayKey(entryDate, timezone)
  const lastKey = localDayKey(last, timezone)

  if (lastKey === entryKey) {
    // Another entry today — streak unchanged (but never below 1).
    return Math.max(current.streakCount, 1)
  }
  if (lastKey === localYesterdayKey(entryDate, timezone)) {
    return current.streakCount + 1
  }
  return 1
}

/**
 * Goal-gated stats advance — ported from `DailyGoalStreak.nextStats`. Adds the
 * word delta, accumulates the day's running total, and — only when the day
 * newly crosses `GOAL_WORDS` and hasn't already been credited — advances the
 * streak and re-anchors `lastEntryDate`. `maxStreakCount` is monotonic.
 */
export const nextStats = (
  current: Stats,
  wordCountDelta: number,
  entryDate: Date,
  timezone: string,
): Stats => {
  const next: Stats = { ...current }
  next.totalWords = current.totalWords + wordCountDelta

  const entryKey = localDayKey(entryDate, timezone)

  // Accumulate the day's running word total.
  if (current.goalDayDate && localDayKey(current.goalDayDate, timezone) === entryKey) {
    next.goalDayWords = current.goalDayWords + wordCountDelta
  } else {
    next.goalDayDate = entryDate
    next.goalDayWords = wordCountDelta
  }

  const qualifies = next.goalDayWords >= GOAL_WORDS
  const alreadyCreditedToday = current.lastEntryDate
    ? localDayKey(current.lastEntryDate, timezone) === entryKey
    : false

  // Advance only when the day newly crosses the goal.
  if (qualifies && !alreadyCreditedToday) {
    next.streakCount = streakStep(current, entryDate, timezone)
    next.lastEntryDate = entryDate
  }
  // Otherwise streakCount and lastEntryDate stay as `current`.

  next.maxStreakCount = Math.max(current.maxStreakCount, next.streakCount)

  return next
}
