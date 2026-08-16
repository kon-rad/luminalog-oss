const ELLIPSIS = '…'

/**
 * Greedy word wrap to at most `maxLines` lines of at most `maxChars` characters.
 * Overflow is truncated with an ellipsis on the last line. A single word longer than
 * `maxChars` is hard-broken rather than allowed to overflow the node box.
 *
 * Character counting is a deliberate approximation of text measurement: beat text is
 * 3 to 7 words of ordinary prose, node width is fixed, and a real measurement pass
 * would make layout impure and therefore untestable.
 */
export function wrapLabel(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []

  const lines: string[] = []
  let current = ''

  const pushCurrent = () => {
    if (current) { lines.push(current); current = '' }
  }

  for (const word of words) {
    // Hard-break any single word that cannot fit on a line by itself.
    if (word.length > maxChars) {
      pushCurrent()
      let rest = word
      while (rest.length > maxChars) {
        lines.push(rest.slice(0, maxChars))
        rest = rest.slice(maxChars)
        // Keep breaking past maxLines so the truncation below has something to trim;
        // stopping early would silently drop the ellipsis.
        if (lines.length > maxLines) break
      }
      current = rest
      continue
    }
    const candidate = current ? `${current} ${word}` : word
    if (candidate.length <= maxChars) {
      current = candidate
    } else {
      pushCurrent()
      current = word
    }
  }
  pushCurrent()

  if (lines.length <= maxLines) return lines

  const kept = lines.slice(0, maxLines)
  const last = kept[maxLines - 1] ?? ''
  kept[maxLines - 1] =
    last.length >= maxChars ? `${last.slice(0, maxChars - 1)}${ELLIPSIS}` : `${last}${ELLIPSIS}`
  return kept
}
