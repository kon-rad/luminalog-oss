import Foundation

/// Canned-but-plausible `AIService` for demo mode. Generations take ~1s so
/// loading states are visible; chat replies stream word-by-word.
@MainActor
final class MockAIService: AIService {

    private let generationDelay: UInt64
    private let wordDelay: UInt64

    init(
        generationDelay: UInt64 = 1_000_000_000,
        wordDelay: UInt64 = 45_000_000
    ) {
        self.generationDelay = generationDelay
        self.wordDelay = wordDelay
    }

    func generateSummary(journalId: String) async throws -> AIGeneration {
        try await Task.sleep(nanoseconds: generationDelay)
        return AIGeneration(text: MockData.cannedSummary, model: MockData.model)
    }

    func generateInsights(journalId: String) async throws -> AIGeneration {
        try await Task.sleep(nanoseconds: generationDelay)
        return AIGeneration(text: MockData.cannedInsights, model: MockData.model)
    }

    func generatePrompts(journalId: String) async throws -> [String] {
        try await Task.sleep(nanoseconds: generationDelay)
        return MockData.cannedPrompts
    }

    func dailyPrompt() async throws -> String {
        try await Task.sleep(nanoseconds: generationDelay)
        return MockData.cannedDailyPrompt
    }

    func streamChatReply(chatId: String, message: String) -> AsyncThrowingStream<String, Error> {
        let reply = MockData.cannedChatReply
        let delay = wordDelay
        return AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    // A brief "thinking" pause before the first token.
                    try await Task.sleep(nanoseconds: 600_000_000)
                    var isFirst = true
                    for word in reply.split(separator: " ") {
                        try Task.checkCancellation()
                        continuation.yield(isFirst ? String(word) : " " + word)
                        isFirst = false
                        try await Task.sleep(nanoseconds: delay)
                    }
                    continuation.finish()
                } catch is CancellationError {
                    // Consumer walked away — end quietly.
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    func requestIndex(journalId: String) async {
        // No-op in demo mode.
    }

    func transcribeJournal(journalId: String) async throws {
        // No-op in demo mode.
    }

    func transcribeClip(audio: Data, contentType: String) async throws -> String {
        try await Task.sleep(nanoseconds: generationDelay)
        return MockData.cannedClipTranscript
    }

    func relatedEntries(journalId: String, limit: Int) async throws -> [RelatedEntry] {
        [
            RelatedEntry(journalId: "mock-1", title: "A quiet morning", type: .text,
                         date: "2026-05-01", snippet: "You reflected on stillness.", score: 0.91),
            RelatedEntry(journalId: "mock-2", title: "First run back", type: .voice,
                         date: "2026-04-20", snippet: "You felt a return of energy.", score: 0.84),
        ]
    }

    func journalGraph() async throws -> JournalGraph {
        try await Task.sleep(nanoseconds: 200_000_000)
        return JournalGraph(
            nodes: [
                GraphNode(id: "mock-1", title: "A quiet morning", date: "2026-06-01", type: "text", degree: 2),
                GraphNode(id: "mock-2", title: "On the trail again", date: "2026-06-03", type: "text", degree: 1),
                GraphNode(id: "mock-3", title: "Hard conversation", date: "2026-06-05", type: "text", degree: 1),
            ],
            links: [
                GraphLink(source: "mock-1", target: "mock-2", value: 0.88),
                GraphLink(source: "mock-1", target: "mock-3", value: 0.81),
            ]
        )
    }

    func deleteEntry(journalId: String) async throws {
        // No-op in demo mode.
    }

    func searchKeyword(query: String) async throws -> [SearchResult] {
        try await Task.sleep(nanoseconds: generationDelay)
        return []
    }

    func searchSemantic(query: String) async throws -> [SearchResult] {
        try await Task.sleep(nanoseconds: generationDelay)
        return []
    }
}
