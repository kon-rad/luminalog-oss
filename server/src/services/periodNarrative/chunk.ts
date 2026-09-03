export interface PeriodNarrativeBeatInput {
  text: string
  kind: string
  domain: string
  isSpine: boolean
}

export interface PeriodNarrativeDayInput {
  dayIndex: number
  beats: PeriodNarrativeBeatInput[]
}

/**
 * Starting chunk-size constant (design spec: "beats-per-chunk sized to typical
 * entry-beat-count x 15-20 entries", picked here as ~150). Not validated against real
 * token counts yet; tune from real measurements once this is live (spec's open item).
 */
export const MAX_BEATS_PER_CHUNK = 150

/**
 * Groups a period's days into chunks that each fit comfortably in one prompt, never
 * splitting a single day's beats across two chunks. Days with no beats are dropped
 * (nothing to synthesize about them). Input order does not matter: chunks are always
 * built oldest-day-first, matching `getPeriodPositions`'s sort convention.
 *
 * A day whose own beat count exceeds `maxBeatsPerChunk` still gets exactly one chunk
 * to itself (not split, not dropped): the alternative is an infinite loop or silently
 * losing that day's data.
 */
export function chunkDays(
  days: PeriodNarrativeDayInput[],
  maxBeatsPerChunk: number = MAX_BEATS_PER_CHUNK,
): PeriodNarrativeDayInput[][] {
  const nonEmpty = days
    .filter(d => d.beats.length > 0)
    .slice()
    .sort((a, b) => a.dayIndex - b.dayIndex)

  const chunks: PeriodNarrativeDayInput[][] = []
  let current: PeriodNarrativeDayInput[] = []
  let currentCount = 0

  for (const day of nonEmpty) {
    if (current.length > 0 && currentCount + day.beats.length > maxBeatsPerChunk) {
      chunks.push(current)
      current = []
      currentCount = 0
    }
    current.push(day)
    currentCount += day.beats.length
  }
  if (current.length > 0) chunks.push(current)

  return chunks
}
