/**
 * Period-index functions for the zoom pyramid's week/month/quarter/year tiers,
 * mirrored from `server/src/services/periodCentroid/periodIndex.ts` and
 * `ios/LuminaLog/Core/Vectors/PeriodIndex.swift`. All three must agree: server,
 * iOS, and web each filter entries into the same tiers from the same `dayIndex`.
 *
 * `dayIndex` is UTC days-since-epoch, matching `dayIndexFor` below and the
 * existing web `localDayKey`/`dayKeyToEpochDays` convention in
 * `web/src/lib/stats/dailyGoalStreak.ts` and `journal/page.tsx`.
 */

/** UTC days-since-epoch for `date`, matching the server's `dateForDayIndex` inverted. */
export function dayIndexFor(date: Date): number {
  return Math.floor(date.getTime() / 86_400_000)
}

function dateForDayIndex(dayIndex: number): Date {
  return new Date(dayIndex * 86_400_000)
}

/** `year * 12 + zeroBasedMonth`, unique and monotonically increasing across years. */
export function monthIndexFromDayIndex(dayIndex: number): number {
  const d = dateForDayIndex(dayIndex)
  return d.getUTCFullYear() * 12 + d.getUTCMonth()
}

/** `year * 4 + zeroBasedQuarter`. */
export function quarterIndexFromDayIndex(dayIndex: number): number {
  const d = dateForDayIndex(dayIndex)
  return d.getUTCFullYear() * 4 + Math.floor(d.getUTCMonth() / 3)
}

/** The calendar year. */
export function yearIndexFromDayIndex(dayIndex: number): number {
  return dateForDayIndex(dayIndex).getUTCFullYear()
}

/**
 * `isoYear * 100 + isoWeek`, per ISO 8601 (weeks start Monday, week 1 contains the
 * year's first Thursday). Encodes the ISO week-numbering year, not the calendar year,
 * so a late-December or early-January date can belong to the adjacent year's week 1
 * or week 52/53.
 */
export function weekIndexFromDayIndex(dayIndex: number): number {
  const d = dateForDayIndex(dayIndex)
  const mondayBasedDow = (d.getUTCDay() + 6) % 7 // Mon=0 .. Sun=6
  const thursday = new Date(d)
  thursday.setUTCDate(d.getUTCDate() - mondayBasedDow + 3)

  const isoYear = thursday.getUTCFullYear()
  const jan4 = new Date(Date.UTC(isoYear, 0, 4))
  const jan4MondayBasedDow = (jan4.getUTCDay() + 6) % 7
  const week1Monday = new Date(jan4)
  week1Monday.setUTCDate(jan4.getUTCDate() - jan4MondayBasedDow)

  const isoWeek = Math.round((thursday.getTime() - week1Monday.getTime()) / (7 * 86_400_000)) + 1
  return isoYear * 100 + isoWeek
}

/**
 * The day-index of the Thursday of the ISO week containing `dayIndex`. Used to derive
 * a week's calendar month/quarter/year attribution from a fixed point that cannot
 * flip depending on which day in the week triggered the computation.
 */
export function thursdayDayIndexFromDayIndex(dayIndex: number): number {
  const d = dateForDayIndex(dayIndex)
  const mondayBasedDow = (d.getUTCDay() + 6) % 7
  const thursday = new Date(d)
  thursday.setUTCDate(d.getUTCDate() - mondayBasedDow + 3)
  return Math.floor(thursday.getTime() / 86_400_000)
}
