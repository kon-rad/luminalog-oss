import Foundation
import OSLog

// MARK: - View Model

/// Drives the Inbox tab: pending requests, archive, drafting, and responding.
/// The drafting and archive features are stubbed here and will be connected
/// when Task 9 (InfoAnswerDrafter + InfoArchiveRepository) lands.
@MainActor
final class InboxViewModel: ObservableObject {

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "inbox")

    // MARK: Published state

    @Published var requests: [InfoRequest] = []
    @Published var isLoading = false
    @Published var error: String?
    @Published var showArchive = false

    // MARK: Dependencies

    private let inboxService: InboxService
    private let now: () -> Date

    init(
        inboxService: InboxService,
        now: @escaping () -> Date = Date.init
    ) {
        self.inboxService = inboxService
        self.now = now
    }

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

    /// Ignores a request and removes it from the list.
    func ignore(_ id: String) async {
        do {
            try await inboxService.ignore(id: id)
            requests.removeAll { $0.id == id }
        } catch {
            Self.logger.error("ignore failed: \(error.localizedDescription, privacy: .public)")
            self.error = error.localizedDescription
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