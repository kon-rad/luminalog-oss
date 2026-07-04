// Shared, pure formatting helpers for the journal list rows. `EntryRow`
// (a saved `JournalEntry`) and `DraftRow` (a local `DraftEntry`) render their
// date/preview the same way despite reading from different source shapes, so
// the formatting logic itself lives here once.

/** `"Jul 4, 3:42 PM"` in the viewer's own locale/timezone. */
export function formatEntryDateTime(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

/** Collapses whitespace and clips to `max` chars with an ellipsis (design:
 * "~100-char content preview"). */
export function truncatePreview(text: string, max = 100): string {
  const collapsed = text.trim().replace(/\s+/g, ' ')
  if (collapsed.length <= max) return collapsed
  return `${collapsed.slice(0, max).trimEnd()}…`
}
