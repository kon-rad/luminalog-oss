import Foundation

/// Canonical word count for journal content: any run of whitespace separates
/// words. MUST match the server (`server/src/routes/ai.ts` `countWords` uses
/// `content.split(/\s+/)`), so the daily-goal delta agrees across tiers.
enum WordCount {
    static func of(_ content: String) -> Int {
        content.split(whereSeparator: \.isWhitespace).count
    }
}
