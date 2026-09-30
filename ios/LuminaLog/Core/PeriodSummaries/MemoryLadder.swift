import Foundation

/// The voice call's long-term memory: period summaries from this week out to all
/// time, formatted for the system prompt (`memoryContext` on `/v1/vapi/call-config`).
/// Today is deliberately absent: today's full entries already travel as `todayContext`.
enum MemoryLadder {

    struct Rung: Equatable {
        let key: PeriodKey
        let title: String
        /// A day inside the period, for its label.
        let sampleDay: Int
        /// The period containing today, so an open summary reads "so far".
        let isCurrent: Bool
        /// The ~100-word summary (near periods) rather than the one sentence (far ones).
        let full: Bool
    }

    static func rungs(today: Int) -> [Rung] {
        let lastWeekDay = today - 7
        let lastDayOfPreviousMonth = today - PeriodSummaryIndex.dayOfMonth(today)
        func key(_ type: PeriodSummaryType, _ day: Int) -> PeriodKey { PeriodSummaryIndex.key(type, forDay: day) }
        return [
            Rung(key: key(.week, today), title: "This week", sampleDay: today, isCurrent: true, full: true),
            Rung(key: key(.week, lastWeekDay), title: "Last week", sampleDay: lastWeekDay, isCurrent: false, full: true),
            Rung(key: key(.month, today), title: "This month", sampleDay: today, isCurrent: true, full: true),
            Rung(key: key(.month, lastDayOfPreviousMonth), title: "Last month", sampleDay: lastDayOfPreviousMonth, isCurrent: false, full: false),
            Rung(key: key(.quarter, today), title: "This quarter", sampleDay: today, isCurrent: true, full: false),
            Rung(key: key(.year, today), title: "This year", sampleDay: today, isCurrent: true, full: false),
            Rung(key: key(.all, today), title: "All time", sampleDay: today, isCurrent: true, full: true),
        ]
    }

    /// One line per rung that has a stored summary, in rung order; nil when none do.
    static func format(_ summaries: [PeriodSummary], rungs: [Rung], timeZone: TimeZone) -> String? {
        let byKey = Dictionary(summaries.map { ($0.key, $0) }, uniquingKeysWith: { a, _ in a })
        let lines = rungs.compactMap { rung -> String? in
            guard let summary = byKey[rung.key] else { return nil }
            var heading = rung.title
            if rung.isCurrent && summary.isOpen && rung.key.type != .all { heading += " so far" }
            var details: [String] = []
            if rung.key.type != .all {
                details.append(PeriodSummaryIndex.label(for: rung.key, sampleDay: rung.sampleDay))
            }
            if summary.isOpen {
                let generatedDay = PeriodSummaryIndex.localDayIndex(for: summary.generatedAt, in: timeZone)
                details.append("as of \(PeriodSummaryIndex.dayLabel(generatedDay))")
            }
            if !details.isEmpty { heading += " (\(details.joined(separator: ", ")))" }
            return "\(heading): \(rung.full ? summary.summary : summary.sentence)"
        }
        return lines.isEmpty ? nil : lines.joined(separator: "\n")
    }
}
