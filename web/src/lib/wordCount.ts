// Canonical word count for journal content: any run of whitespace separates
// words. This MUST agree with both other tiers so the daily-goal delta is
// consistent across clients:
//   - iOS  (`Core/Models/WordCount.swift`):  content.split(whereSeparator: \.isWhitespace).count
//   - server (`server/src/routes/ai.ts` countWords): content.split(/\s+/)
// Trimming + an empty-guard reproduces both for normal text. (Exotic Unicode
// whitespace can differ between JS `\s` and Swift `isWhitespace`; that is
// acceptable — the server is the arbiter and re-derives on index.)
export const wordCount = (s: string): number => {
  const t = s.trim()
  return t ? t.split(/\s+/).length : 0
}
