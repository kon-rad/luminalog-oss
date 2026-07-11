import Foundation

/// The single source of truth for "how many words were journaled today".
///
/// Sums `WordCount.of(content)` over every entry whose `createdAt` falls on the
/// same calendar day as `now` in the user's `timezone`. It is a pure recompute —
/// no deltas, no accumulators — so it is idempotent and self-healing: a failed
/// transcription that is retried later, an edit, or a delete all just change the
/// underlying entries, and the total re-derives correctly.
///
/// The day boundary lives here (midnight in `timezone`, evaluated against the
/// current `now`). Because the filter re-evaluates against `now`, the total stays
/// correct across a midnight rollover even if the entry list was fetched the
/// previous day — any date-bounded query feeding this is only an optimization,
/// never the correctness boundary.
enum TodayWords {
    static func total(from entries: [JournalEntry], timezone: TimeZone, now: Date = Date()) -> Int {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timezone
        return entries
            .filter { calendar.isDate($0.createdAt, inSameDayAs: now) }
            .reduce(0) { $0 + WordCount.of($1.content) }
    }
}
