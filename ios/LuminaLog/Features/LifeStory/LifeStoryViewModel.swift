import Foundation
import OSLog

/// Backs the Life Story screens: loads the interview script from the server and
/// groups the user's interview sittings (voice chats) into interviews.
@MainActor
final class LifeStoryViewModel: ObservableObject {

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "life-story")

    /// Where the script comes from. The app passes the API call; tests pass a stub.
    typealias ScriptLoader = () async throws -> LifeInterviewScript

    @Published private(set) var script: LifeInterviewScript?
    /// Shown with a retry button when the script cannot be loaded.
    @Published private(set) var loadError: String?
    @Published private(set) var isLoadingScript = false
    @Published private(set) var deleteError: String?
    /// Newest interview first.
    @Published private(set) var interviews: [LifeInterview] = []

    private let chats: ChatRepository
    private let loadScript: ScriptLoader
    private var chatsTask: Task<Void, Never>?

    init(chats: ChatRepository, loadScript: @escaping ScriptLoader) {
        self.chats = chats
        self.loadScript = loadScript
    }

    convenience init(services: AppServices) {
        let api = services.api
        self.init(chats: services.chats) {
            guard let api else { throw LifeStoryError.unavailable }
            return try await api.get(path: "/v1/ai/voice-turn/interview-script")
        }
    }

    deinit {
        chatsTask?.cancel()
    }

    /// Loads the script and starts following the user's chats. Idempotent.
    func start() async {
        if chatsTask == nil {
            let stream = chats.chats()
            chatsTask = Task { [weak self] in
                for await all in stream {
                    guard let self, !Task.isCancelled else { return }
                    self.interviews = LifeInterviewGrouping.interviews(from: all)
                }
            }
        }
        if script == nil { await reloadScript() }
    }

    func reloadScript() async {
        guard !isLoadingScript else { return }
        isLoadingScript = true
        loadError = nil
        defer { isLoadingScript = false }
        do {
            script = try await loadScript()
        } catch {
            Self.logger.error("interview script failed to load: \(error.localizedDescription, privacy: .public)")
            loadError = "The interview couldn't be loaded. Check your connection and try again."
        }
    }

    /// The interview with this id, or an empty one that has not been started yet.
    func interview(id: String) -> LifeInterview {
        interviews.first { $0.id == id }
            ?? LifeInterview(id: id, number: interviews.count + 1, sittings: [])
    }

    /// A fresh id for "Start a new interview". Nothing is stored until the first
    /// sitting begins.
    func newInterviewId() -> String {
        UUID().uuidString
    }

    /// Deletes every sitting of an interview, transcripts included.
    func delete(_ interview: LifeInterview) async -> Bool {
        deleteError = nil
        var succeeded = true
        for sitting in interview.sittings {
            do {
                try await chats.deleteChat(id: sitting.id)
            } catch {
                succeeded = false
                deleteError = "Some parts could not be deleted. Check your connection and try again."
                Self.logger.error("delete sitting failed: \(error.localizedDescription, privacy: .public)")
            }
        }
        return succeeded
    }
}

enum LifeStoryError: LocalizedError {
    case unavailable

    var errorDescription: String? {
        "The Life Story Interview isn't available in this build."
    }
}
