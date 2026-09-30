import Foundation

/// Pure: applies the server's ops to the facts. This is where the feature's promises
/// live: dates come from entries, not the model; a user-authored fact is never
/// rewritten (update and invalidate become a proposal); a deleted fact never comes
/// back; nothing is deleted on contradiction, it is invalidated with an end date.
/// Spec: docs/superpowers/specs/2026-09-28-user-facts-design.md, "Merger".
enum UserFactMerger {

    struct Outcome: Equatable {
        /// Facts created or changed, to save.
        var upserts: [UserFact] = []
        var added = 0
        var confirmed = 0
        var updated = 0
        var invalidated = 0
        var proposed = 0
        var dropped = 0
    }

    static let maxEvidence = 20

    static func apply(
        _ ops: [UserFactOperation],
        to facts: [UserFact],
        batch: UserFactPlanner.Batch,
        model: String,
        now: Date,
        makeId: () -> String = { UUID().uuidString }
    ) -> Outcome {
        var byId = Dictionary(facts.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        var order: [String] = []
        var outcome = Outcome()
        var invalidatedNow: [String] = []
        var addedNow: [String] = []

        func touch(_ fact: UserFact) {
            byId[fact.id] = fact
            if !order.contains(fact.id) { order.append(fact.id) }
        }

        for op in ops {
            let evidence = op.evidence.filter { batch.entryDates[$0] != nil }
            let dates = evidence.compactMap { batch.entryDates[$0] }
            guard let earliest = dates.min(), let latest = dates.max() else { outcome.dropped += 1; continue }

            switch op.op {
            case "add":
                guard let category = op.category.flatMap(UserFactCategory.init(rawValue:)),
                      let statement = clean(op.statement) else { outcome.dropped += 1; continue }
                let key = normalized(statement)
                let same: (UserFact) -> Bool = { $0.category == category && normalized($0.statement) == key }
                if byId.values.contains(where: { $0.status == .rejected && same($0) }) {
                    outcome.dropped += 1; continue
                }
                if var twin = byId.values.first(where: { $0.status == .active && same($0) }) {
                    confirm(&twin, evidence: evidence, latest: latest, now: now)
                    touch(twin)
                    outcome.confirmed += 1
                    continue
                }
                let fact = UserFact(
                    id: makeId(), category: category, subject: clean(op.subject) ?? "", statement: statement,
                    status: .active, origin: .extracted, userAuthored: false,
                    evidence: appendingEvidence([], evidence),
                    firstObservedAt: earliest, lastConfirmedAt: latest,
                    validFrom: earliest, validTo: nil, supersededBy: nil, proposal: nil,
                    createdAt: now, updatedAt: now, model: model, promptVersion: UserFactPlanner.promptVersion
                )
                touch(fact)
                addedNow.append(fact.id)
                outcome.added += 1

            case "confirm", "update", "invalidate":
                guard let ref = op.ref, let id = batch.refs[ref], var fact = byId[id], fact.status == .active else {
                    outcome.dropped += 1; continue
                }
                if op.op == "confirm" {
                    confirm(&fact, evidence: evidence, latest: latest, now: now)
                    outcome.confirmed += 1
                } else if op.op == "update" {
                    guard let statement = clean(op.statement) else { outcome.dropped += 1; continue }
                    if fact.userAuthored {
                        fact.proposal = UserFactProposal(kind: .update, statement: statement, validTo: nil,
                                                         reason: nil, evidence: evidence)
                        fact.updatedAt = now
                        outcome.proposed += 1
                    } else {
                        fact.statement = statement
                        fact.model = model
                        confirm(&fact, evidence: evidence, latest: latest, now: now)
                        outcome.updated += 1
                    }
                } else {
                    // Stale evidence (an old entry re-read after an edit) cannot end a
                    // fact that started later, and validTo can never precede validFrom.
                    guard earliest >= (fact.validFrom ?? fact.firstObservedAt) else { outcome.dropped += 1; continue }
                    if fact.userAuthored {
                        fact.proposal = UserFactProposal(kind: .invalidate, statement: nil, validTo: earliest,
                                                         reason: clean(op.reason), evidence: evidence)
                        outcome.proposed += 1
                    } else {
                        fact.status = .invalidated
                        fact.validTo = earliest
                        fact.evidence = appendingEvidence(fact.evidence, evidence)
                        invalidatedNow.append(fact.id)
                        outcome.invalidated += 1
                    }
                    fact.updatedAt = now
                }
                touch(fact)

            default:
                outcome.dropped += 1
            }
        }

        // Link each ended fact to its replacement: an add in this batch with the same
        // category and subject, or else the only add in that category.
        for oldId in invalidatedNow {
            guard var old = byId[oldId] else { continue }
            let candidates = addedNow.compactMap { byId[$0] }.filter { $0.category == old.category }
            let match = candidates.first { normalized($0.subject) == normalized(old.subject) }
                ?? (candidates.count == 1 ? candidates[0] : nil)
            if let match {
                old.supersededBy = match.id
                touch(old)
            }
        }

        outcome.upserts = order.compactMap { byId[$0] }
        return outcome
    }

    /// Removes evidence ids whose entry was deleted. An extracted, not user-authored,
    /// not rejected fact left with none is deleted: it no longer rests on anything
    /// the user wrote. The caller must never pass an empty `liveEntryIds` produced by
    /// a missing key (see `UserFactReconciler`).
    static func pruneDeletedEntries(
        _ facts: [UserFact], liveEntryIds: Set<String>, now: Date
    ) -> (updated: [UserFact], deletedIds: [String]) {
        var updated: [UserFact] = []
        var deleted: [String] = []
        for var fact in facts {
            let kept = fact.evidence.filter(liveEntryIds.contains)
            guard kept.count != fact.evidence.count else { continue }
            if kept.isEmpty, !fact.userAuthored, fact.status != .rejected {
                deleted.append(fact.id)
                continue
            }
            fact.evidence = kept
            fact.updatedAt = now
            updated.append(fact)
        }
        return (updated, deleted)
    }

    /// Appends new ids (deduplicated, order kept) and keeps the newest `maxEvidence`.
    static func appendingEvidence(_ existing: [String], _ new: [String]) -> [String] {
        var result = existing
        for id in new where !result.contains(id) { result.append(id) }
        return Array(result.suffix(maxEvidence))
    }

    /// Case- and diacritic-folded, punctuation to spaces, whitespace collapsed.
    static func normalized(_ text: String) -> String {
        let folded = text.folding(options: [.caseInsensitive, .diacriticInsensitive], locale: nil)
        let spaced = String(folded.unicodeScalars.map { CharacterSet.alphanumerics.contains($0) ? Character($0) : " " })
        return spaced.split(separator: " ").joined(separator: " ")
    }

    private static func confirm(_ fact: inout UserFact, evidence: [String], latest: Date, now: Date) {
        fact.evidence = appendingEvidence(fact.evidence, evidence)
        fact.lastConfirmedAt = max(fact.lastConfirmedAt, latest)
        fact.updatedAt = now
    }

    private static func clean(_ text: String?) -> String? {
        let trimmed = text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        return trimmed.isEmpty ? nil : trimmed
    }
}
