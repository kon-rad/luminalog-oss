import Foundation
import OSLog

/// Lazily fetches the entry's most-similar neighbors for the Related tab.
@MainActor
final class RelatedViewModel: ObservableObject {

    enum State: Equatable {
        case idle
        case loading
        case loaded([RelatedEntry])
        case failed
    }

    @Published private(set) var state: State = .idle

    private let entryId: String
    private let ai: AIService
    private let limit: Int
    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "RelatedViewModel")

    init(entryId: String, ai: AIService, limit: Int = 20) {
        self.entryId = entryId
        self.ai = ai
        self.limit = limit
    }

    /// Idempotent: only fetches from `.idle` or `.failed`.
    func load() async {
        switch state {
        case .loading, .loaded: return
        case .idle, .failed: break
        }
        state = .loading
        do {
            let items = try await ai.relatedEntries(journalId: entryId, limit: limit)
            state = .loaded(items)
        } catch {
            Self.logger.error("relatedEntries failed: \(error.localizedDescription, privacy: .public)")
            state = .failed
        }
    }

    func retry() async {
        state = .idle
        await load()
    }
}
