import Foundation

@MainActor
final class JournalConstellationViewModel: ObservableObject {

    enum State: Equatable {
        case idle
        case loading
        case loaded(JournalGraph)
        case empty
        case failed
    }

    @Published private(set) var state: State = .idle

    private let ai: AIService

    init(ai: AIService) {
        self.ai = ai
    }

    func load() async {
        state = .loading
        do {
            let graph = try await ai.journalGraph()
            // Need at least 2 nodes to form any connection worth showing.
            state = graph.nodes.count < 2 ? .empty : .loaded(graph)
        } catch {
            state = .failed
        }
    }

    func retry() async {
        await load()
    }
}
