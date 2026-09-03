/**
 * Period-index functions for the zoom pyramid's week/month/quarter/year/lifetime tiers.
 *
 * `dayIndex` (see `dailyGoalStreak.dayIndex()`) already bakes in the user's timezone at
 * the point it was computed client-side: it is the UTC-day-number of the calendar date
 * (y, m, d) the user experienced, built via `Date.UTC(y, m - 1, d)`. Every function here
 * takes only that integer and recovers (y, m, d) with UTC accessors, exactly like
 * `constellationService.ts`'s `dateForDayIndex` does, so no timezone parameter is needed
 * anywhere in this file.
 */

export type PeriodType = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'lifetime'

/** Single lifetime tier per user: there is only ever one row, indexed 0. */
export const LIFETIME_INDEX = 0

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
 * or week 52/53 (the two tested edge cases).
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
 * flip depending on which day in the week triggered the computation, since (unlike
 * day/month/quarter/year, which always nest cleanly) an ISO week can straddle a
 * calendar month, quarter, or year boundary.
 */
export function thursdayDayIndexFromDayIndex(dayIndex: number): number {
  const d = dateForDayIndex(dayIndex)
  const mondayBasedDow = (d.getUTCDay() + 6) % 7
  const thursday = new Date(d)
  thursday.setUTCDate(d.getUTCDate() - mondayBasedDow + 3)
  return Math.floor(thursday.getTime() / 86_400_000)
}
