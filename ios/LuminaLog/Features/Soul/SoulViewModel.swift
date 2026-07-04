import Foundation

@MainActor
final class SoulViewModel: ObservableObject {

    enum LoadState: Equatable {
        case loading
        case loaded
        case failed(String)
    }

    @Published private(set) var state: LoadState = .loading
    @Published private(set) var payload: SoulPayload?

    private let service: SoulService
    init(service: SoulService) { self.service = service }

    /// Number of stars (750-word days) — drives the "Stars" stat.
    var stars: Int { payload?.constellation.points.count ?? 0 }

    func load() async {
        state = .loading
        do {
            payload = try await service.fetchSoul()
            state = .loaded
        } catch {
            payload = nil
            state = .failed(error.localizedDescription)
        }
    }
}
