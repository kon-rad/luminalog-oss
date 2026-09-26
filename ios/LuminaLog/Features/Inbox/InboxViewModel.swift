import Foundation
import OSLog

// MARK: - View Model

/// Drives the Inbox tab: pending requests, AI answer drafting, ignoring, and
/// responding. The encrypted archive (`InfoArchiveRepository`) is not wired yet.
@MainActor
final class InboxViewModel: ObservableObject {

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "inbox")

    // MARK: Published state

    @Published var requests: [InfoRequest] = []
    @Published var isLoading = false
    @Published var error: String?

    // MARK: Dependencies

    private let inboxService: InboxService
    private let drafter: InfoAnswerDrafting?

    init(inboxService: InboxService, drafter: InfoAnswerDrafting? = nil) {
        self.inboxService = inboxService
        self.drafter = drafter
    }

    /// False when no drafter is wired, so the view hides "Draft with AI".
    var canDraft: Bool { drafter != nil }

    // MARK: - Intents

    /// Loads pending requests from the server.
    func load() async {
        isLoading = true
        error = nil
        do {
            let result = try await inboxService.pending()
            requests = result
        } catch {
            Self.logger.error("load failed: \(error.localizedDescription, privacy: .public)")
            self.error = error.localizedDescription
        }
        isLoading = false
    }

    /// Ignores a request and removes it from the list. Returns true on success.
    @discardableResult
    func ignore(_ id: String) async -> Bool {
        error = nil
        do {
            try await inboxService.ignore(id: id)
            requests.removeAll { $0.id == id }
            return true
        } catch {
            Self.logger.error("ignore failed: \(error.localizedDescription, privacy: .public)")
            self.error = error.localizedDescription
            return false
        }
    }

    /// Drafts one answer per question from the user's journal. Returns nil on
    /// failure (with `error` set) or when the count doesn't match the questions.
    func draft(for request: InfoRequest) async -> [String]? {
        guard let drafter else { return nil }
        error = nil
        do {
            let answers = try await drafter.draftAnswers(for: request)
            guard answers.count == request.questions.count else {
                self.error = "The draft didn't match the questions. Please try again."
                return nil
            }
            return answers
        } catch {
            Self.logger.error("draft failed: \(error.localizedDescription, privacy: .public)")
            self.error = error.localizedDescription
            return nil
        }
    }

    /// One payload per question, which the server requires: a declined or
    /// blank question is sent as a nil answer (declined), never omitted.
    static func payloads(
        questionCount: Int, answers: [Int: String], declined: Set<Int>
    ) -> [InfoAnswerPayload] {
        (0..<questionCount).map { index in
            let text = answers[index]?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let answer = declined.contains(index) || text.isEmpty ? nil : text
            return InfoAnswerPayload(index: index, answer: answer)
        }
    }

    /// Responds to a request. Returns true if the webhook was delivered.
    @discardableResult
    func respond(_ id: String, answers: [InfoAnswerPayload]) async -> Bool {
        error = nil
        do {
            let result = try await inboxService.respond(id: id, answers: answers)
            guard result.delivered else {
                self.error = "Server rejected the response."
                return false
            }
            requests.removeAll { $0.id == id }
            return true
        } catch {
            Self.logger.error("respond failed: \(error.localizedDescription, privacy: .public)")
            self.error = error.localizedDescription
            return false
        }
    }
}