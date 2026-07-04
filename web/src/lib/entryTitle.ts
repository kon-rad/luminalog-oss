// Pure title-derivation rule for the Create screen's Save flow (design §6 /
// B.6), mirroring iOS `EntryProcessor`'s text-entry title logic: a seeded
// prompt always wins and becomes the title verbatim; otherwise the first
// non-blank line of the body, clipped to ~60 chars; otherwise "Untitled".

const MAX_TITLE_LENGTH = 60

export function deriveEntryTitle(text: string, promptText?: string): string {
  if (promptText && promptText.trim()) return promptText.trim()

  const firstLine = text.split('\n').find((line) => line.trim().length > 0)?.trim()
  if (!firstLine) return 'Untitled'

  return firstLine.length > MAX_TITLE_LENGTH
    ? `${firstLine.slice(0, MAX_TITLE_LENGTH).trimEnd()}…`
    : firstLine
}
