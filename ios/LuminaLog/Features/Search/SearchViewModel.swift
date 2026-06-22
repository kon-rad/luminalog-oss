import Foundation
import OSLog

@MainActor
final class SearchViewModel: ObservableObject {

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "search")

    // MARK: - Types

    enum Mode: String, CaseIterable {
        case keyword = "Keyword"
        case semantic = "Semantic"
    }

    enum State {
        case idle
        case loading
        case results([SearchResult])
        case empty
        case error(String)
    }

    // MARK: - Published state

    @Published var query = ""
    @Published var mode: Mode = .keyword
    @Published private(set) var state: State = .idle

    // MARK: - Private

    private let ai: AIService

    init(ai: AIService) {
        self.ai = ai
    }

    // MARK: - Search

    func search() async {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return }

        state = .loading
        do {
            let results: [SearchResult]
            switch mode {
            case .keyword:
                results = try await ai.searchKeyword(query: q)
            case .semantic:
                results = try await ai.searchSemantic(query: q)
            }
            state = results.isEmpty ? .empty : .results(results)
        } catch {
            Self.logger.error("search failed: \(error.localizedDescription, privacy: .public)")
            state = .error("Server unreachable. Check your connection and try again.")
        }
    }
}
