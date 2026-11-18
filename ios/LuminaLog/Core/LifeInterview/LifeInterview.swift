import Foundation

// The Life Story Interview: a guided voice interview about the user's whole
// life, taken one section per sitting. The questions come from the server
// (`GET /v1/ai/voice-turn/interview-script`); the structure follows Dan P.
// McAdams' Life Story Interview II.
//
// There is no interview document in storage. An interview is the set of voice
// chats that share an `interviewId`; each chat is one sitting of one section and
// carries how far it got. That keeps the feature inside the existing encrypted
// chat storage and its security rules.

/// One question of the interview.
struct LifeInterviewItem: Codable, Equatable, Identifiable, Sendable {
    /// Section letter plus number, for example "B3".
    let key: String
    let title: String
    let question: String

    var id: String { key }
}

/// One section, taken in one sitting.
struct LifeInterviewSection: Codable, Equatable, Identifiable, Sendable {
    /// "A" to "G".
    let key: String
    let title: String
    /// Rough length of the sitting. An estimate, not a limit.
    let minutes: Int
    /// The section asks about painful events; warn before starting.
    let sensitive: Bool
    /// Spoken on the phone the moment the sitting connects.
    let opening: String
    let items: [LifeInterviewItem]

    var id: String { key }

    func item(_ key: String?) -> LifeInterviewItem? {
        guard let key else { return nil }
        return items.first { $0.key == key }
    }
}

struct LifeInterviewScript: Codable, Equatable, Sendable {
    let version: String
    let sections: [LifeInterviewSection]

    func section(_ key: String?) -> LifeInterviewSection? {
        guard let key else { return nil }
        return sections.first { $0.key == key }
    }

    var totalMinutes: Int { sections.reduce(0) { $0 + $1.minutes } }
}

/// What a voice call needs to run as one sitting of the interview.
struct LifeInterviewSitting: Equatable, Sendable {
    let interviewId: String
    let section: LifeInterviewSection
    /// The question to start on: the first one, or where the user left off.
    let startItem: String
    /// True when the user is coming back to a section they started earlier.
    let resumed: Bool

    init(interviewId: String, section: LifeInterviewSection, resumeAt item: String? = nil) {
        self.interviewId = interviewId
        self.section = section
        let first = section.items.first?.key ?? ""
        // Resuming on the first question is the same as starting.
        if let item, item != first, section.item(item) != nil {
            startItem = item
            resumed = true
        } else {
            startItem = first
            resumed = false
        }
    }

    var chatTitle: String { "Life story: \(section.title)" }

    /// Spoken locally when the sitting connects, with no network round trip.
    var openingLine: String {
        guard resumed, let question = section.item(startItem)?.question else { return section.opening }
        return "Welcome back. Let's pick up where we left off. \(question)"
    }
}

/// How far one section of one interview has got.
enum LifeInterviewSectionProgress: Equatable {
    case notStarted
    /// Started; `item` is the last question reached.
    case inProgress(item: String?)
    case done
}

/// One interview: every sitting that shares an `interviewId`.
struct LifeInterview: Identifiable, Equatable {
    let id: String
    /// 1 for the user's first interview, counting up by start date.
    let number: Int
    /// Sittings, oldest first.
    let sittings: [Chat]

    var startedAt: Date { sittings.first?.createdAt ?? Date() }
    var lastActivityAt: Date { sittings.map(\.lastMessageAt).max() ?? startedAt }

    func sittings(for sectionKey: String) -> [Chat] {
        sittings.filter { $0.interviewSection == sectionKey }
    }

    func progress(for sectionKey: String) -> LifeInterviewSectionProgress {
        let own = sittings(for: sectionKey)
        guard let latest = own.last else { return .notStarted }
        if own.contains(where: { $0.interviewSectionDone == true }) { return .done }
        return .inProgress(item: latest.interviewItem)
    }

    func completedSections(in script: LifeInterviewScript) -> Int {
        script.sections.filter { progress(for: $0.key) == .done }.count
    }

    func isComplete(in script: LifeInterviewScript) -> Bool {
        !script.sections.isEmpty && completedSections(in: script) == script.sections.count
    }

    /// The first section that is not done, in script order.
    func nextSection(in script: LifeInterviewScript) -> LifeInterviewSection? {
        script.sections.first { progress(for: $0.key) != .done }
    }

    /// The sitting to start for a section: fresh, or resuming where it stopped.
    func sitting(for section: LifeInterviewSection) -> LifeInterviewSitting {
        if case .inProgress(let item) = progress(for: section.key) {
            return LifeInterviewSitting(interviewId: id, section: section, resumeAt: item)
        }
        return LifeInterviewSitting(interviewId: id, section: section)
    }
}

enum LifeInterviewGrouping {

    /// Groups the user's chats into interviews, newest interview first.
    static func interviews(from chats: [Chat]) -> [LifeInterview] {
        var byId: [String: [Chat]] = [:]
        for chat in chats {
            guard let id = chat.interviewId, !id.isEmpty else { continue }
            byId[id, default: []].append(chat)
        }
        let oldestFirst = byId
            .map { (id: $0.key, sittings: $0.value.sorted { $0.createdAt < $1.createdAt }) }
            .sorted { ($0.sittings.first?.createdAt ?? .distantPast) < ($1.sittings.first?.createdAt ?? .distantPast) }
        return oldestFirst.enumerated()
            .map { index, group in LifeInterview(id: group.id, number: index + 1, sittings: group.sittings) }
            .reversed()
    }
}
