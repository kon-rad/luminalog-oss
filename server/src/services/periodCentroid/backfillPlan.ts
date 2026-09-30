import { dayIndex } from '../dailyGoalStreak'

export interface JournalDayInput {
  id: string
  createdAt: Date | null
}

export interface LocalDayPlan {
  /** Entry id to its local day (profile timezone). */
  localDayByEntry: Map<string, number>
  /** Distinct local days, ascending. */
  days: number[]
  skippedNoDate: number
}

/** Pure half of the periodCentroids re-key backfill: which local day each entry is on. */
export function planLocalDays(journals: JournalDayInput[], timeZone: string | null | undefined): LocalDayPlan {
  const localDayByEntry = new Map<string, number>()
  let skippedNoDate = 0
  for (const j of journals) {
    if (!j.createdAt || Number.isNaN(j.createdAt.getTime())) {
      skippedNoDate += 1
      continue
    }
    localDayByEntry.set(j.id, dayIndex(j.createdAt, timeZone ?? 'UTC'))
  }
  const days = Array.from(new Set(localDayByEntry.values())).sort((a, b) => a - b)
  return { localDayByEntry, days, skippedNoDate }
}
