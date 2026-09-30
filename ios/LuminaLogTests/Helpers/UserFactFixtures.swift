import Foundation
@testable import LuminaLog

/// Shared builders for the user-facts test suites.
enum UserFactFixtures {

    static func date(_ iso: String) -> Date {
        ISO8601DateFormatter().date(from: iso)!
    }

    static func entry(
        _ id: String,
        _ iso: String,
        content: String = "Body text",
        edited: String? = nil,
        processing: ProcessingStatus? = nil,
        transcript: TranscriptStatus? = nil
    ) -> JournalEntry {
        let created = date(iso)
        return JournalEntry(
            id: id, userId: "u", type: .text, title: "Title \(id)",
            createdAt: created, updatedAt: created, content: content,
            contentEditedAt: edited.map(date),
            transcriptStatus: transcript, processingStatus: processing
        )
    }

    static func fact(
        _ id: String,
        category: UserFactCategory = .person,
        subject: String = "Maya",
        statement: String? = nil,
        status: UserFactStatus = .active,
        userAuthored: Bool = false,
        evidence: [String] = ["e0"],
        validFrom: String? = "2026-03-02T10:00:00Z",
        lastConfirmed: String = "2026-03-02T10:00:00Z",
        updatedAt: String = "2026-03-02T10:00:00Z",
        proposal: UserFactProposal? = nil
    ) -> UserFact {
        UserFact(
            id: id, category: category, subject: subject,
            statement: statement ?? "Statement \(id).",
            status: status, origin: userAuthored ? .user : .extracted, userAuthored: userAuthored,
            evidence: evidence,
            firstObservedAt: date("2026-03-02T10:00:00Z"),
            lastConfirmedAt: date(lastConfirmed),
            validFrom: validFrom.map(date), validTo: nil, supersededBy: nil, proposal: proposal,
            createdAt: date("2026-03-02T10:00:00Z"), updatedAt: date(updatedAt),
            model: "m", promptVersion: 1
        )
    }
}
