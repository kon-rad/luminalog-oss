import Foundation

/// Errors surfaced by `AIService` implementations.
enum AIServiceError: Error {
    /// The requested AI operation isn't available on this path (e.g. `generateEntryAI`
    /// is only implemented on the zero-knowledge `ProxyAIService` path).
    case unavailable
}

/// The three per-entry AI artifacts produced together in one call. On the legacy
/// path the server generates + stores these at index time; on the zero-knowledge
/// (Model-1) path the client generates them via `generateEntryAI` and persists them
/// itself (client-encrypted) so the server never sees the entry.
struct EntryAIBundle: Sendable {
    let summary: AIGeneration
    let insights: AIGeneration
    let prompts: AIPrompts
}

/// Plaintext context for a zero-knowledge (Model-1) voice call, built ON DEVICE at
/// call start and baked into the Vapi assistant's system prompt so the server never
/// decrypts mid-call. Mirrors the Model-1 text-chat context.
struct VoiceCallContext: Sendable {
    let name: String
    let bio: String
    let profile: [String: String]
    /// Everything the user wrote TODAY, fetched straight from the local DB (not RAG) so
    /// it is always present and current — the assistant's most-asked-about material.
    let todayContext: String
    let ragContext: String
    let focalEntry: String?
}

/// All AI features — backed by the proxy API in production
/// (routes per spec §4.1), canned responses in demo mode.
@MainActor
protocol AIService: AnyObject {

    /// Generate (and server-side persist) a summary for an entry.
    ///
    /// Insights and follow-up prompts are NOT generated on demand: the server
    /// produces them together with the summary in one call at index time and
    /// stores them on the entry (see `ensureEntryAIIndexed`). The Insights and
    /// Prompts tabs are read-only displays of those stored fields.
    func generateSummary(journalId: String) async throws -> AIGeneration

    /// Zero-knowledge (Model-1) only: generate the entry's summary + insights +
    /// prompts in ONE call from PLAINTEXT content, so the client can persist all
    /// three itself. On the non-ZK path the server produces these at index time and
    /// this is unused — the default implementation throws `.unavailable`.
    func generateEntryAI(journalId: String) async throws -> EntryAIBundle

    /// Zero-knowledge (Model-1) only: build the plaintext voice-call context on-device
    /// (name, bio, profile, on-device RAG, focal entry) so it can be injected into the
    /// Vapi system prompt. Returns nil off the ZK path (the server builds context then).
    func voiceCallContext(journalId: String?) async throws -> VoiceCallContext?

    /// Today's five personalized prompts — one per life area — generated in a
    /// single server-side LLM call. The client caches them for the day.
    func dailyPrompt() async throws -> [DailyPromptItem]

    /// Streaming assistant reply — yields token/word deltas as they arrive.
    func streamChatReply(chatId: String, message: String) -> AsyncThrowingStream<String, Error>

    /// True when `streamChatReply` ALSO persists both the user message and the
    /// assistant reply to the chat store server-side (the production proxy,
    /// spec §5.4). When true the view model must NOT persist either side
    /// itself — otherwise every message is written twice and the conversation
    /// shows each message and reply doubled. Demo mode never writes back, so it
    /// leaves this `false` (the extension default) and the view model persists.
    var persistsChatReplies: Bool { get }

    /// Fire-and-forget request to (re)index an entry into the RAG store.
    /// Failures are swallowed; a server-side reconcile retries later.
    func requestIndex(journalId: String) async

    /// Server-side transcription via Together AI Whisper for voice/video entries.
    /// Downloads audio from S3, transcribes, updates Firestore
    /// content+transcriptStatus to ready, then re-indexes to Chroma.
    /// Throws on network or server error; the entry stays with
    /// transcriptStatus = failed when the server itself catches the error.
    func transcribeJournal(journalId: String) async throws

    /// Transcribe a recorded audio clip without persisting anything.
    /// POSTs raw audio bytes to `/v1/ai/transcribe-clip`; returns the transcript
    /// text. Used by the transcript editor to turn a voice memo into text.
    func transcribeClip(audio: Data, contentType: String) async throws -> String

    /// The 20 most semantically similar other entries (summary-embedding search).
    func relatedEntries(journalId: String, limit: Int) async throws -> [RelatedEntry]

    /// The whole-corpus similarity graph (entries = nodes, summary-vector
    /// similarity = edges) for the global constellation map.
    func journalGraph() async throws -> JournalGraph

    /// Best-effort server-side purge of an entry's remote artifacts: S3 media
    /// objects, RAG chunk embeddings, and the summary embedding. Does NOT delete
    /// the Firestore record — the client owns that.
    func deleteEntry(journalId: String) async throws

    /// Full-corpus keyword search across all user journals (server-side).
    /// Returns up to 100 results newest-first, each with a decrypted snippet.
    func searchKeyword(query: String) async throws -> [SearchResult]

    /// Semantic vector search across journal chunks and summaries (server-side).
    /// Returns the top 20 results ranked by cosine similarity.
    func searchSemantic(query: String) async throws -> [SearchResult]

    /// Generates (or returns the cached) daily insights report for `date` ("yyyy-MM-dd", default today).
    func generateDailyReport(date: String?, force: Bool) async throws -> DailyInsightsReport
}

extension AIService {
    /// Default: the service does not persist chat messages, so the caller
    /// owns persistence. Only the production proxy overrides this to `true`.
    var persistsChatReplies: Bool { false }

    /// Default: only the zero-knowledge `ProxyAIService` path generates entry AI
    /// client-side. Every other conformer (mocks, test stubs) inherits this throw.
    func generateEntryAI(journalId: String) async throws -> EntryAIBundle {
        throw AIServiceError.unavailable
    }

    /// Default: no client-built voice context (non-ZK paths and mocks). Only the
    /// zero-knowledge `ProxyAIService` overrides this.
    func voiceCallContext(journalId: String?) async throws -> VoiceCallContext? { nil }
}
