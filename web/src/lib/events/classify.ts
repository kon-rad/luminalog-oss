/* ──────────────────────────────────────────────────────────────────────────
 * Event category from an event title.
 *
 * Shared by both event paths so they can never disagree: the live upcoming
 * fetch (luma.ts) and the past-events sync (scripts/sync-luma-past-events.mjs).
 *
 * Order matters. The specific patterns are tested before the broad ones, so a
 * title like "Kids Wholistic Creativity and STEM Class" is not swallowed by a
 * rule meant for something else.
 * ────────────────────────────────────────────────────────────────────────── */

export function classify(name: string): string {
  const n = name.toLowerCase()

  // Specific first.
  if (/kids|\bstem\b/.test(n)) return 'KIDS_STEM'
  if (/yoga|vinyasa|hatha/.test(n)) return 'YOGA'
  if (/dance|k-pop|kpop/.test(n)) return 'DANCE'
  if (/sauna|ice bath|cold plunge|breathwork/.test(n)) return 'WELLNESS'
  if (/party|dinner|coffee/.test(n)) return 'SOCIAL'

  // Existing categories.
  if (/(muay thai|martial|\bbjj\b)/.test(n)) return 'MUAY_THAI'
  // "Robtics Club 010" is a real typo in the Luma calendar, so the `o` is optional.
  if (/rob(o)?tics/.test(n)) return 'ROBOTICS_CLUB'
  if (n.includes('demo') || n.includes('pitch')) return 'DEMO_DAY'
  if (n.includes('film') || n.includes('screening')) return 'FILM_DISCUSSION'
  if (n.includes('writer')) return 'WRITERS_CLUB'
  if (n.includes('speak')) return 'PUBLIC_SPEAKERS'
  if (n.includes('hackathon')) return 'HACKATHON'
  if (/(workshop|claude code|openclaw|agent|ai power users)/.test(n)) return 'WORKSHOP'

  return 'OTHER'
}
