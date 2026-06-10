import Foundation

/// `AIService` backed by the proxy API (routes per spec §4.1).
final class ProxyAIService: AIService {

    private let api: ProxyAPIClient

    init(api: ProxyAPIClient) {
        self.api = api
    }

    // MARK: - DTOs

    private struct JournalIdBody: Encodable {
        let journalId: String
    }

    private struct EmptyBody: Encodable {}

    private struct GenerationResponse: Decodable {
        let text: String
        let model: String?
        let generatedAt: Date?
    }

    private struct PromptsResponse: Decodable {
        let items: [String]
        let model: String?
    }

    private struct DailyPromptResponse: Decodable {
        let text: String
    }

    private struct ChatBody: Encodable {
        let chatId: String
        let message: String
    }

    /// One SSE chunk of a streamed chat reply.
    private struct ChatDelta: Decodable {
        let delta: String?
    }

    // MARK: - AIService

    func generateSummary(journalId: String) async throws -> AIGeneration {
        let response: GenerationResponse =
            try await api.post(path: "/v1/ai/summary", body: JournalIdBody(journalId: journalId))
        return AIGeneration(
            text: response.text,
            generatedAt: response.generatedAt ?? Date(),
            model: response.model ?? ""
        )
    }

    func generateInsights(journalId: String) async throws -> AIGeneration {
        let response: GenerationResponse =
            try await api.post(path: "/v1/ai/insights", body: JournalIdBody(journalId: journalId))
        return AIGeneration(
            text: response.text,
            generatedAt: response.generatedAt ?? Date(),
            model: response.model ?? ""
        )
    }

    func generatePrompts(journalId: String) async throws -> [String] {
        let response: PromptsResponse =
            try await api.post(path: "/v1/ai/prompts", body: JournalIdBody(journalId: journalId))
        return response.items
    }

    func dailyPrompt() async throws -> String {
        let response: DailyPromptResponse =
            try await api.post(path: "/v1/ai/daily-prompt", body: EmptyBody())
        return response.text
    }

    func streamChatReply(chatId: String, message: String) -> AsyncThrowingStream<String, Error> {
        let events = api.streamEvents(
            path: "/v1/ai/chat",
            body: ChatBody(chatId: chatId, message: message)
        )
        return AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    for try await payload in events {
                        // Server sends JSON chunks `{"delta": "..."}`;
                        // fall back to raw text for plain SSE payloads.
                        if let data = payload.data(using: .utf8),
                           let chunk = try? JSONDecoder().decode(ChatDelta.self, from: data) {
                            if let delta = chunk.delta, !delta.isEmpty {
                                continuation.yield(delta)
                            }
                        } else {
                            continuation.yield(payload)
                        }
                    }
                    continuation.finish()
                } catch {
                    continuation.finish(throwing: error)
                }
            }
            continuation.onTermination = { _ in task.cancel() }
        }
    }

    func requestIndex(journalId: String) async {
        // Fire-and-forget: indexing failures are reconciled server-side.
        try? await api.post(path: "/v1/rag/index", body: JournalIdBody(journalId: journalId))
    }
}
