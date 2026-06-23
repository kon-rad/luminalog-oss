import Foundation

@MainActor
final class LeaderboardViewModel: ObservableObject {

    /// Which board is shown.
    enum Board: String, CaseIterable, Identifiable {
        case streak
        case words

        var id: String { rawValue }
        var title: String {
            switch self {
            case .streak: return "Streaks"
            case .words: return "Words"
            }
        }
    }

    enum LoadState: Equatable {
        case loading
        case loaded
        case failed(String)
    }

    @Published var selected: Board = .streak
    @Published private(set) var state: LoadState = .loading
    @Published private(set) var streak: [LeaderboardEntry] = []
    @Published private(set) var words: [LeaderboardEntry] = []

    let currentUserId: String?
    private let service: LeaderboardService

    init(service: LeaderboardService, currentUserId: String?) {
        self.service = service
        self.currentUserId = currentUserId
    }

    /// The rows for the currently-selected board.
    var entries: [LeaderboardEntry] {
        switch selected {
        case .streak: return streak
        case .words: return words
        }
    }

    func isCurrentUser(_ entry: LeaderboardEntry) -> Bool {
        guard let currentUserId else { return false }
        return entry.userId == currentUserId
    }

    func load() async {
        state = .loading
        do {
            let boards = try await service.fetch()
            streak = boards.streak
            words = boards.words
            state = .loaded
        } catch {
            state = .failed(error.localizedDescription)
        }
    }
}
