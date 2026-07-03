import Foundation

/// `AIService` backed by the proxy API (routes per spec §4.1).
@MainActor
final class ProxyAIService: AIService {

    private let api: ProxyAPIClient

    /// The proxy's `/v1/ai/chat` route writes both the user message and the
    /// streamed reply to Firestore (spec §5.4), so the client must not also
    /// persist them — see `AIService.persistsChatReplies`.
    let persistsChatReplies = true

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

    private struct DailyPromptResponse: Decodable {
        /// The five area-anchored prompts (new server). Optional so an older
        /// server that returns only `text` still decodes.
        let prompts: [DailyPromptItem]?
        /// First prompt's text — always present; the single-prompt fallback.
        let text: String?
    }

    private struct ChatBody: Encodable {
        let chatId: String
        let message: String
    }

    /// One SSE chunk of a streamed chat reply.
    private struct ChatDelta: Decodable {
        let delta: String?
    }

    private struct TranscriptResponse: Decodable {
        let text: String
    }

    private struct RelatedBody: Encodable {
        let journalId: String
        let limit: Int
    }

    private struct RelatedResponse: Decodable {
        let related: [RelatedEntry]
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

    func dailyPrompt() async throws -> [DailyPromptItem] {
        let response: DailyPromptResponse =
            try await api.post(path: "/v1/ai/daily-prompt", body: EmptyBody())
        if let prompts = response.prompts, !prompts.isEmpty {
            return prompts
        }
        // Older server: only a single `text` — wrap it so the carousel still renders.
        if let text = response.text, !text.isEmpty {
            return [DailyPromptItem(area: "Reflection", text: text)]
        }
        return []
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

    func transcribeJournal(journalId: String) async throws {
        try await api.post(path: "/v1/ai/transcribe", body: JournalIdBody(journalId: journalId))
    }

    func transcribeClip(audio: Data, contentType: String) async throws -> String {
        let response: TranscriptResponse = try await api.postRaw(
            path: "/v1/ai/transcribe-clip",
            body: audio,
            contentType: contentType
        )
        return response.text
    }

    func relatedEntries(journalId: String, limit: Int) async throws -> [RelatedEntry] {
        let response: RelatedResponse = try await api.post(
            path: "/v1/rag/related",
            body: RelatedBody(journalId: journalId, limit: limit)
        )
        return response.related
    }

    func journalGraph() async throws -> JournalGraph {
        try await api.post(path: "/v1/rag/graph", body: EmptyBody())
    }

    func deleteEntry(journalId: String) async throws {
        let encoded = journalId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? journalId
        try await api.delete(path: "/v1/rag/delete?journalId=\(encoded)")
    }

    // MARK: - Search

    private struct SearchBody: Encodable {
        let query: String
    }

    private struct SearchResponse: Decodable {
        let results: [SearchResult]
    }

    func searchKeyword(query: String) async throws -> [SearchResult] {
        let response: SearchResponse = try await api.post(
            path: "/v1/rag/search/keyword",
            body: SearchBody(query: query)
        )
        return response.results
    }

    func searchSemantic(query: String) async throws -> [SearchResult] {
        let response: SearchResponse = try await api.post(
            path: "/v1/rag/search/semantic",
            body: SearchBody(query: query)
        )
        return response.results
    }

    // MARK: - Daily Report

    private struct DailyReportBody: Encodable { let date: String?; let force: Bool }

    func generateDailyReport(date: String?, force: Bool) async throws -> DailyInsightsReport {
        try await api.post(path: "/v1/ai/daily-report", body: DailyReportBody(date: date, force: force))
    }
}
