import CryptoKit
import Foundation

/// The next period to generate, with everything the request and the saved doc need.
struct PeriodSummaryWorkItem: Equatable {
    let key: PeriodKey
    let label: String
    let isOpen: Bool
    let children: [PeriodSummaryChildInput]
    let fingerprint: String

    var request: PeriodSummaryRequest {
        PeriodSummaryRequest(periodType: key.type.rawValue, periodLabel: label, isOpen: isOpen, children: children)
    }
}

/// Pure decision logic for period summaries: which period to (re)generate next, and
/// from what. No IO; `PeriodSummaryReconciler` loops it.
///
/// Staleness is fingerprint-based (spec, "Staleness"): a period needs work when it
/// has no doc, its inputs' fingerprint changed, it was generated while open and has
/// since ended, or its prompt version is old. A period is READY only when every
/// child is fresh, so generation always runs bottom-up and a parent is never built
/// from children that are about to change.
enum PeriodSummaryPlanner {

    /// Bump when `PROMPTS.periodSummary` changes meaningfully: every stored summary
    /// then regenerates lazily.
    static let promptVersion = 1
    static let maxEntriesPerDay = 30
    static let entryTextMaxChars = 800
    static let childTextMaxChars = 1_000
    /// Start of an entry's content sent as `excerpt`: the only text a day may quote.
    static let excerptMaxChars = 600

    /// The non-empty period tree, built from entries.
    struct Tree {
        /// Local day index to that day's usable entries, oldest first, capped to the
        /// most recent `maxEntriesPerDay`.
        var dayEntries: [Int: [JournalEntry]] = [:]
        /// Non-day period to its child periods.
        var children: [PeriodKey: Set<PeriodKey>] = [:]
        /// Period to the latest day it covers: orders work newest first and supplies
        /// the label's sample day.
        var latestDay: [PeriodKey: Int] = [:]

        var keys: Set<PeriodKey> { Set(latestDay.keys) }
    }

    static func tree(entries: [JournalEntry], timeZone: TimeZone) -> Tree {
        var tree = Tree()
        for entry in entries where !entryText(entry).isEmpty {
            let day = PeriodSummaryIndex.localDayIndex(for: entry.createdAt, in: timeZone)
            tree.dayEntries[day, default: []].append(entry)
        }
        for (day, list) in tree.dayEntries {
            tree.dayEntries[day] = Array(list.sorted { $0.createdAt < $1.createdAt }.suffix(maxEntriesPerDay))
            let dayKey = PeriodKey(.day, day)
            let week = PeriodSummaryIndex.key(.week, forDay: day)
            let month = PeriodSummaryIndex.key(.month, forDay: day)
            let quarter = PeriodSummaryIndex.key(.quarter, forDay: day)
            let year = PeriodSummaryIndex.key(.year, forDay: day)
            let all = PeriodSummaryIndex.key(.all, forDay: day)
            tree.children[week, default: []].insert(dayKey)
            tree.children[month, default: []].insert(dayKey)
            tree.children[quarter, default: []].insert(month)
            tree.children[year, default: []].insert(quarter)
            tree.children[all, default: []].insert(year)
            for key in [dayKey, week, month, quarter, year, all] {
                tree.latestDay[key] = max(tree.latestDay[key] ?? day, day)
            }
        }
        return tree
    }

    /// Stored summaries whose period no longer has any entries (all deleted).
    static func orphans(tree: Tree, existing: [PeriodKey: PeriodSummary]) -> [PeriodKey] {
        let live = tree.keys
        return existing.keys.filter { !live.contains($0) }.sorted { $0.docId < $1.docId }
    }

    /// The next ready period, newest first then lowest tier, or nil when nothing
    /// reachable needs work. `includeOpen: false` skips periods containing today
    /// (every ancestor of an open period is open too). `excluding` skips periods
    /// that already failed this run; their ancestors are then never ready.
    /// `missingOnly` makes only periods with no doc ready: a stale doc is left as it
    /// is, and so are its ancestors, since it never becomes fresh this run.
    static func next(
        tree: Tree,
        existing: [PeriodKey: PeriodSummary],
        today: Int,
        timeZone: TimeZone,
        includeOpen: Bool,
        excluding: Set<PeriodKey> = [],
        missingOnly: Bool = false
    ) -> PeriodSummaryWorkItem? {
        var memo: [PeriodKey: Bool] = [:]

        func needsWork(_ key: PeriodKey) -> Bool {
            guard let doc = existing[key] else { return true }
            if doc.promptVersion < promptVersion { return true }
            if doc.isOpen && !PeriodSummaryIndex.isOpen(key, today: today) { return true }
            return doc.sourceFingerprint != fingerprint(for: key, tree: tree, existing: existing)
        }

        func isFresh(_ key: PeriodKey) -> Bool {
            if let known = memo[key] { return known }
            let kids = tree.children[key] ?? []
            let fresh = kids.allSatisfy { isFresh($0) } && !needsWork(key)
            memo[key] = fresh
            return fresh
        }

        let ready = tree.keys.filter { key in
            !excluding.contains(key)
                && (!missingOnly || existing[key] == nil)
                && (includeOpen || !PeriodSummaryIndex.isOpen(key, today: today))
                && !isFresh(key)
                && (tree.children[key] ?? []).allSatisfy { isFresh($0) }
        }
        let best = ready.min { a, b in
            let la = tree.latestDay[a] ?? 0, lb = tree.latestDay[b] ?? 0
            if la != lb { return la > lb }
            if a.type.rank != b.type.rank { return a.type.rank < b.type.rank }
            return a.docId < b.docId
        }
        guard let key = best else { return nil }

        return PeriodSummaryWorkItem(
            key: key,
            label: PeriodSummaryIndex.label(for: key, sampleDay: tree.latestDay[key] ?? today),
            isOpen: PeriodSummaryIndex.isOpen(key, today: today),
            children: inputs(for: key, tree: tree, existing: existing, timeZone: timeZone),
            fingerprint: fingerprint(for: key, tree: tree, existing: existing)
        )
    }

    /// SHA-256 over the sorted `"<childId>|<stampMillis>"` lines. For a day the
    /// children are its entries (stamped with `stamp(_:)`); above that they are the
    /// child docs, stamped with their `generatedAt`.
    static func fingerprint(for key: PeriodKey, tree: Tree, existing: [PeriodKey: PeriodSummary]) -> String {
        let lines: [String]
        if key.type == .day {
            lines = (tree.dayEntries[key.index] ?? []).map { "\($0.id)|\(millis(stamp($0)))" }
        } else {
            lines = (tree.children[key] ?? []).map { "\($0.docId)|\(millis(existing[$0]?.generatedAt ?? .distantPast))" }
        }
        let digest = SHA256.hash(data: Data(lines.sorted().joined(separator: "\n").utf8))
        return digest.map { String(format: "%02x", $0) }.joined()
    }

    /// When an entry last changed in a way that matters to its day summary.
    static func stamp(_ entry: JournalEntry) -> Date {
        max(entry.summary?.generatedAt ?? .distantPast, entry.contentEditedAt ?? entry.createdAt)
    }

    /// The entry's per-entry summary, else the start of its content, else "".
    static func entryText(_ entry: JournalEntry) -> String {
        let summary = entry.summary?.text.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !summary.isEmpty { return summary }
        return String(entry.content.trimmingCharacters(in: .whitespacesAndNewlines).prefix(entryTextMaxChars))
    }

    private static func inputs(
        for key: PeriodKey, tree: Tree, existing: [PeriodKey: PeriodSummary], timeZone: TimeZone
    ) -> [PeriodSummaryChildInput] {
        if key.type == .day {
            let time = DateFormatter()
            time.locale = Locale(identifier: "en_US_POSIX")
            time.timeZone = timeZone
            time.dateFormat = "HH:mm"
            return (tree.dayEntries[key.index] ?? []).map { entry in
                let content = entry.content.trimmingCharacters(in: .whitespacesAndNewlines)
                return PeriodSummaryChildInput(
                    id: entry.id,
                    label: "\(time.string(from: entry.createdAt)) · \(entry.type.rawValue)",
                    text: String(entryText(entry).prefix(childTextMaxChars)),
                    excerpt: content.isEmpty ? nil : String(content.prefix(excerptMaxChars))
                )
            }
        }
        let kids = (tree.children[key] ?? []).sorted { (tree.latestDay[$0] ?? 0) < (tree.latestDay[$1] ?? 0) }
        return kids.compactMap { kid in
            guard let doc = existing[kid] else { return nil }
            return PeriodSummaryChildInput(
                id: kid.docId,
                label: PeriodSummaryIndex.label(for: kid, sampleDay: tree.latestDay[kid] ?? 0),
                text: String(doc.summary.prefix(childTextMaxChars)),
                salience: doc.details.salience,
                anchors: doc.details.anchors,
                threads: doc.details.threads
            )
        }
    }

    private static func millis(_ date: Date) -> Int64 {
        Int64((date.timeIntervalSince1970 * 1_000).rounded())
    }
}
