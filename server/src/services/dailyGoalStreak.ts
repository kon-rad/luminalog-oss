/**
 * TS mirror of the Swift `DailyGoalStreak` + `StreakCalculator`
 * (ios/LuminaLog/Core/Persistence/DailyGoalStreak.swift, StreakCalculator.swift).
 *
 * A calendar day (in the user's timezone) counts toward the streak only once
 * that day's entries total `target` words. `nextStats` accumulates the day's
 * running total, adds the delta to `totalWords`, and advances the streak only
 * when a day newly crosses the target.
 *
 * KEEP IN SYNC with the Swift originals — both tiers credit the same delta to
 * the same `users/{uid}.stats` document.
 */

export const WORD_TARGET = 750

export interface GoalStats {
  streakCount: number
  maxStreakCount: number
  lastEntryDate: Date | null
  totalWords: number
  goalDayDate: Date | null
  goalDayWords: number
}

/**
 * Return `tz` if it is a valid IANA timezone, else 'UTC'. Guards against a
 * malformed `timezone` stored on the user doc (an invalid but non-empty string
 * survives a `|| 'UTC'` fallback and would make `Intl.DateTimeFormat` throw a
 * RangeError deep inside `dayIndex`/`nextStats`).
 */
export function safeTimeZone(tz: string | undefined | null): string {
  if (!tz) return 'UTC'
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz })
    return tz
  } catch {
    return 'UTC'
  }
}

/** Integer calendar-day index for `date` in `timeZone` (DST-safe). */
export function dayIndex(date: Date, timeZone: string): number {
  // en-CA formats as YYYY-MM-DD. Sanitize the tz so a bad stored value can't throw.
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', {
    timeZone: safeTimeZone(timeZone),
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(date)
    .split('-')
    .map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

function sameDay(a: Date, b: Date, timeZone: string): boolean {
  return dayIndex(a, timeZone) === dayIndex(b, timeZone)
}

export function nextStats(
  current: GoalStats,
  wordCountDelta: number,
  entryDate: Date,
  timeZone: string,
  target: number = WORD_TARGET,
): GoalStats {
  const next: GoalStats = { ...current }
  next.totalWords = current.totalWords + wordCountDelta

  // Accumulate the day's running word total.
  if (current.goalDayDate && sameDay(current.goalDayDate, entryDate, timeZone)) {
    next.goalDayWords = current.goalDayWords + wordCountDelta
  } else {
    next.goalDayDate = entryDate
    next.goalDayWords = wordCountDelta
  }

  const qualifies = next.goalDayWords >= target
  const alreadyCreditedToday = current.lastEntryDate
    ? sameDay(current.lastEntryDate, entryDate, timeZone)
    : false

  // Advance only when the day newly crosses the target.
  if (qualifies && !alreadyCreditedToday) {
    next.lastEntryDate = entryDate
    if (!current.lastEntryDate) {
      next.streakCount = 1
    } else if (
      dayIndex(entryDate, timeZone) - dayIndex(current.lastEntryDate, timeZone) === 1
    ) {
      next.streakCount = current.streakCount + 1
    } else {
      next.streakCount = 1
    }
  }
  // Otherwise streakCount and lastEntryDate stay as `current`.

  // Best-ever streak — only ever rises (drives the leaderboard ranking).
  next.maxStreakCount = Math.max(current.maxStreakCount ?? 0, next.streakCount)

  return next
}
