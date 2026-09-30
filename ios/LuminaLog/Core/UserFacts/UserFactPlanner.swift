import Foundation

/// Pure: decides which entries to read next and builds the request. Chronological
/// (oldest first) on purpose: invalidating a fact only makes sense in time order.
/// Spec: docs/superpowers/specs/2026-09-28-user-facts-design.md, "Planner".
enum UserFactPlanner {

    static let promptVersion = 1
    static let maxEntriesPerBatch = 8
    static let maxBatchChars = 16_000
    static let entryMaxChars = 3_000
    /// Lets a voice memo finish transcribing and quick edits land before reading.
    static let settleInterval: TimeInterval = 30 * 60
    static let maxKnownFacts = 150
    static let maxRejected = 50
    static let soloAfterFailures = 2
    static let skipAfterFailures = 4

    struct Batch: Equatable, Sendable {
        let request: UserFactsRequest
        /// Entry id to the stamp recorded once the batch is applied.
        let stamps: [String: Int64]
        /// Ref (`f1`...) to fact id.
        let refs: [String: String]
        /// Entry id to its `createdAt`. The only source of dates for facts.
        let entryDates: [String: Date]

        var entryIds: [String] { request.entries.map(\.id) }
    }

    /// `contentEditedAt ?? createdAt` in whole milliseconds. A new stamp re-queues an entry.
    static func stamp(_ entry: JournalEntry) -> Int64 {
        Int64(((entry.contentEditedAt ?? entry.createdAt).timeIntervalSince1970 * 1_000).rounded(.down))
    }

    static func isEligible(_ entry: JournalEntry, now: Date) -> Bool {
        guard !entry.content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return false }
        if let status = entry.processingStatus, status != .ready { return false }
        if entry.transcriptStatus == .processing { return false }
        return now.timeIntervalSince(entry.contentEditedAt ?? entry.createdAt) >= settleInterval
    }

    /// Eligible entries not yet read (or skipped) at their current stamp, oldest first.
    static func pending(entries: [JournalEntry], state: UserFactExtractionState, now: Date) -> [JournalEntry] {
        entries
            .filter { isEligible($0, now: now) }
            .filter { entry in
                let s = stamp(entry)
                return state.processed[entry.id] != s && state.skipped[entry.id] != s
            }
            .sorted { ($0.createdAt, $0.id) < ($1.createdAt, $1.id) }
    }

    static func nextBatch(
        entries: [JournalEntry],
        facts: [UserFact],
        state: UserFactExtractionState,
        now: Date,
        timeZone: TimeZone
    ) -> Batch? {
        let queue = pending(entries: entries, state: state, now: now)
        guard let first = queue.first else { return nil }

        func needsSolo(_ entry: JournalEntry) -> Bool {
            (state.failures[entry.id] ?? 0) >= soloAfterFailures
        }

        var chosen = [first]
        if !needsSolo(first) {
            var chars = min(first.content.count, entryMaxChars)
            for entry in queue.dropFirst() {
                guard chosen.count < maxEntriesPerBatch, !needsSolo(entry) else { break }
                let size = min(entry.content.count, entryMaxChars)
                guard chars + size <= maxBatchChars else { break }
                chars += size
                chosen.append(entry)
            }
        }

        let day = DateFormatter()
        day.calendar = Calendar(identifier: .gregorian)
        day.locale = Locale(identifier: "en_US_POSIX")
        day.timeZone = timeZone
        day.dateFormat = "yyyy-MM-dd"

        let entryInputs = chosen.map {
            UserFactsEntryInput(id: $0.id, date: day.string(from: $0.createdAt), title: $0.title,
                                text: String($0.content.prefix(entryMaxChars)))
        }

        let known = facts
            .filter { $0.status == .active }
            .sorted { a, b in
                if a.userAuthored != b.userAuthored { return a.userAuthored }
                return a.lastConfirmedAt > b.lastConfirmedAt
            }
            .prefix(maxKnownFacts)
        var refs: [String: String] = [:]
        var knownInputs: [KnownFactInput] = []
        for (index, fact) in known.enumerated() {
            let ref = "f\(index + 1)"
            refs[ref] = fact.id
            knownInputs.append(KnownFactInput(
                ref: ref, category: fact.category.rawValue, subject: fact.subject, statement: fact.statement,
                since: fact.validFrom.map { day.string(from: $0) }, userAuthored: fact.userAuthored
            ))
        }

        let rejected = facts
            .filter { $0.status == .rejected }
            .sorted { $0.updatedAt > $1.updatedAt }
            .prefix(maxRejected)
            .map { RejectedFactInput(category: $0.category.rawValue, statement: $0.statement) }

        return Batch(
            request: UserFactsRequest(entries: entryInputs, facts: knownInputs, rejected: Array(rejected)),
            stamps: Dictionary(uniqueKeysWithValues: chosen.map { ($0.id, stamp($0)) }),
            refs: refs,
            entryDates: Dictionary(uniqueKeysWithValues: chosen.map { ($0.id, $0.createdAt) })
        )
    }
}
