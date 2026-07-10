import Foundation

/// `AIService` backed by the proxy API (routes per spec §4.1).
@MainActor
final class ProxyAIService: AIService {

    private let api: ProxyAPIClient

    // ── Model 1 (zero-knowledge) collaborators ────────────────────────────────
    // Optional and injected only by `AppServices.live()`. They are used ONLY on
    // the Model-1 path (`DevFlags.aiModel1` ON) to gather PLAINTEXT context on
    // device (decrypted entries, bio/profile, chat history) before sending it to
    // the server. When any required collaborator is missing we fall back to the
    // legacy ID-based path, so behavior is unchanged. Nil in mock wiring.
    private let journals: JournalRepository?
    private let profiles: ProfileRepository?
    private let chats: ChatRepository?
    /// Client-side semantic-search index (increment 1c-D / 19b). Optional and
    /// injected only by `AppServices.live()`. Used ONLY on the Model-1 path
    /// (`DevFlags.aiModel1` ON) to rank RAG context by on-device embedding
    /// similarity, with a keyword fallback. Nil in mock wiring and unused with the
    /// flag OFF, so retrieval is unchanged.
    private let coordinator: SemanticIndexCoordinating?
    /// One-shot guard so the index is primed (loaded + backfilled) at most once per
    /// session, and only when the Model-1 path first needs it.
    private var semanticIndexPrimed = false
    /// Injected clock so Model-1 recency scoring / day bounds are testable.
    private let now: () -> Date

    /// On the LEGACY path the proxy's `/v1/ai/chat` route writes both the user
    /// message and the streamed reply to Firestore (spec §5.4), so the client must
    /// not also persist them. On the MODEL-1 path (`DevFlags.aiModel1` ON) the
    /// server does NOT persist (it has no DEK), so the client owns persistence and
    /// re-encryption via the existing chat repository — hence this flips to
    /// `false`, which makes `ChatViewModel` write both messages itself.
    /// See `AIService.persistsChatReplies`.
    var persistsChatReplies: Bool { !DevFlags.aiModel1 }

    init(
        api: ProxyAPIClient,
        journals: JournalRepository? = nil,
        profiles: ProfileRepository? = nil,
        chats: ChatRepository? = nil,
        coordinator: SemanticIndexCoordinating? = nil,
        now: @escaping () -> Date = Date.init
    ) {
        self.api = api
        self.journals = journals
        self.profiles = profiles
        self.chats = chats
        self.coordinator = coordinator
        self.now = now
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

    private struct EntryAIResponse: Decodable {
        let summary: String
        let insights: String
        let prompts: [String]
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
        // ── Model 1 (zero-knowledge) branch — flag flips ON at the 1d cutover ──
        // Send the entry's PLAINTEXT content + type; the server uses it verbatim
        // and never decrypts. Falls back to the legacy ID body when the flag is
        // off or the entry can't be read locally.
        var body: any Encodable = JournalIdBody(journalId: journalId)
        if DevFlags.aiModel1, let journals,
           let entry = await firstEmission(journals.entry(id: journalId)).flatMap({ $0 }) {
            body = Model1Requests.SummaryBody(
                journalId: journalId,
                content: entry.content,
                type: entry.type.rawValue
            )
        }
        let response: GenerationResponse =
            try await api.post(path: "/v1/ai/summary", body: body)
        return AIGeneration(
            text: response.text,
            generatedAt: response.generatedAt ?? Date(),
            model: response.model ?? ""
        )
    }

    func generateEntryAI(journalId: String) async throws -> EntryAIBundle {
        // Zero-knowledge only: send the entry's PLAINTEXT content; the stateless
        // /entry-ai endpoint returns summary + insights + prompts in one call and the
        // caller persists all three client-encrypted. Reached only when the ZK flag is
        // on and the entry is readable locally (the Insights/Prompts tabs guard on it).
        guard DevFlags.aiModel1, let journals,
              let entry = await firstEmission(journals.entry(id: journalId)).flatMap({ $0 }) else {
            throw AIServiceError.unavailable
        }
        let response: EntryAIResponse = try await api.post(
            path: "/v1/ai/entry-ai",
            body: Model1Requests.EntryAIBody(content: entry.content, type: entry.type.rawValue)
        )
        let at = response.generatedAt ?? Date()
        let model = response.model ?? ""
        return EntryAIBundle(
            summary: AIGeneration(text: response.summary, generatedAt: at, model: model),
            insights: AIGeneration(text: response.insights, generatedAt: at, model: model),
            prompts: AIPrompts(items: response.prompts, generatedAt: at, model: model)
        )
    }

    func dailyPrompt() async throws -> [DailyPromptItem] {
        // ── Model 1 (zero-knowledge) branch ──────────────────────────────────
        // Send the user's most-recent entries as PLAINTEXT plus the decrypted
        // name/profile. Falls back to the legacy empty body when off / unavailable.
        var body: any Encodable = EmptyBody()
        if DevFlags.aiModel1, let journals {
            let entries = await firstEmission(journals.recentEntries(limit: 5)) ?? []
            let profile = await loadProfile()
            body = Model1Requests.DailyPromptBody(
                name: profile?.displayName ?? "",
                profile: profile.map { Model1Requests.profileFields(from: $0.details) } ?? [:],
                entries: Model1Requests.promptEntries(from: entries)
            )
        }
        let response: DailyPromptResponse =
            try await api.post(path: "/v1/ai/daily-prompt", body: body)
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
        return AsyncThrowingStream { continuation in
            let task = Task {
                do {
                    // ── Model 1 (zero-knowledge) branch ─────────────────────────
                    // Build every piece of context as PLAINTEXT on device (bio,
                    // profile, decrypted chat history, client-side RAG
                    // `journalContext`, focal entry) and POST it. The server never
                    // decrypts and — critically — does NOT persist the messages on
                    // this path; `ChatViewModel` persists + re-encrypts both sides
                    // client-side because `persistsChatReplies` is false when the
                    // flag is on. Flag flips ON at the 1d cutover.
                    let body: any Encodable
                    if DevFlags.aiModel1, let journals, let profiles, let chats {
                        body = await self.buildModel1ChatBody(
                            chatId: chatId, message: message,
                            journals: journals, profiles: profiles, chats: chats
                        )
                    } else {
                        // ── Legacy path (UNCHANGED — server decrypts + persists) ──
                        body = ChatBody(chatId: chatId, message: message)
                    }

                    let events = self.api.streamEvents(path: "/v1/ai/chat", body: body)
                    for try await payload in events {
                        try Task.checkCancellation()
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
        // Model 1 (zero-knowledge): entries are indexed ON DEVICE by
        // `IndexingJournalRepository` → `SemanticIndexCoordinator`, so the server index
        // call is redundant and would 500 (no server DEK). Skip it.
        if DevFlags.aiModel1 { return }
        // Fire-and-forget: indexing failures are reconciled server-side.
        try? await api.post(path: "/v1/rag/index", body: JournalIdBody(journalId: journalId))
    }

    func transcribeJournal(journalId: String) async throws {
        // Model 1 (zero-knowledge): the server can't decrypt the audio, so there is no
        // server-side re-transcription. Voice/video entries already carry their
        // on-device live-dictation transcript as their content, so this is a no-op
        // (avoids a 500). A future on-device Whisper/Speech re-pass can replace this.
        if DevFlags.aiModel1 { return }
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
        // ── Model 1 (zero-knowledge) branch ──────────────────────────────────
        // On-device: semantic-search the focal entry's OWN text against the local
        // index, drop the entry itself, map the neighbours. Server can't decrypt.
        if DevFlags.aiModel1, let journals, let coordinator {
            let entries = try await journals.fetchAllEntries()
            guard let focal = entries.first(where: { $0.id == journalId }) else { return [] }
            let ids = try await coordinator.search(query: focal.title + "\n" + focal.content, k: limit + 1)
            let byId = Dictionary(entries.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
            let neighbours = ids.filter { $0 != journalId }.prefix(limit)
            let n = max(neighbours.count, 1)
            return neighbours.enumerated().compactMap { index, id in
                guard let entry = byId[id] else { return nil }
                return RelatedEntry(
                    journalId: entry.id,
                    title: entry.title,
                    type: entry.type,
                    date: Self.dateFormatter.string(from: entry.updatedAt),
                    snippet: Self.snippet(from: entry.content, query: ""),
                    score: Double(n - index) / Double(n)
                )
            }
        }
        let response: RelatedResponse = try await api.post(
            path: "/v1/rag/related",
            body: RelatedBody(journalId: journalId, limit: limit)
        )
        return response.related
    }

    func journalGraph() async throws -> JournalGraph {
        // ── Model 1 (zero-knowledge) branch ──────────────────────────────────
        // Build the similarity graph ON DEVICE from the local encrypted vectors
        // (pairwise cosine, no re-embed, no server decrypt).
        if DevFlags.aiModel1, let journals, let coordinator {
            let entries = try await journals.fetchAllEntries()
            let byId = Dictionary(entries.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
            let edges = try await coordinator.similarityGraph(neighborsPerNode: 3)
            var degree: [String: Int] = [:]
            var links: [GraphLink] = []
            for edge in edges where byId[edge.source] != nil && byId[edge.target] != nil {
                links.append(GraphLink(source: edge.source, target: edge.target, value: edge.score))
                degree[edge.source, default: 0] += 1
                degree[edge.target, default: 0] += 1
            }
            let nodes = entries.map { entry in
                GraphNode(
                    id: entry.id,
                    title: entry.title,
                    date: Self.dateFormatter.string(from: entry.updatedAt),
                    type: entry.type.rawValue,
                    degree: degree[entry.id] ?? 0
                )
            }
            return JournalGraph(nodes: nodes, links: links)
        }
        return try await api.post(path: "/v1/rag/graph", body: EmptyBody())
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
        // ── Model 1 (zero-knowledge) branch ──────────────────────────────────
        // The server can't decrypt a migrated user's entries, so keyword search runs
        // ON DEVICE over the client's own decrypted entries. Falls back to the legacy
        // server search when the flag is off / deps are unavailable.
        if DevFlags.aiModel1, let journals {
            return Self.onDeviceKeywordResults(query: query, entries: try await journals.fetchAllEntries())
        }
        let response: SearchResponse = try await api.post(
            path: "/v1/rag/search/keyword",
            body: SearchBody(query: query)
        )
        return response.results
    }

    func searchSemantic(query: String) async throws -> [SearchResult] {
        // ── Model 1 (zero-knowledge) branch ──────────────────────────────────
        // On-device semantic search via the local vector index; if the index isn't
        // ready yet (model still downloading / not embedded), fall back to on-device
        // keyword search so results never depend on the server decrypting.
        if DevFlags.aiModel1, let journals {
            if let coordinator {
                let ids = try await coordinator.search(query: query, k: 50)
                if !ids.isEmpty {
                    let entries = try await journals.fetchAllEntries()
                    let byId = Dictionary(entries.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
                    let ordered = ids.compactMap { byId[$0] }
                    if !ordered.isEmpty {
                        let n = ordered.count
                        return ordered.enumerated().map { index, entry in
                            Self.searchResult(from: entry, query: query, score: Double(n - index) / Double(n))
                        }
                    }
                }
            }
            // Index not ready → on-device keyword fallback (matches only).
            return Self.onDeviceKeywordResults(query: query, entries: try await journals.fetchAllEntries())
        }
        let response: SearchResponse = try await api.post(
            path: "/v1/rag/search/semantic",
            body: SearchBody(query: query)
        )
        return response.results
    }

    /// On-device keyword search: keep ONLY entries that actually contain a query token
    /// (unlike `EntryRetriever.topK`, whose recency boost would return recent entries for
    /// a zero-match query — right for RAG context, wrong for user search), then rank +
    /// map. Empty query → no results.
    private static func onDeviceKeywordResults(query: String, entries: [JournalEntry]) -> [SearchResult] {
        let queryTerms = Set(EntryRetriever.tokenize(query))
        guard !queryTerms.isEmpty else { return [] }
        let matching = entries.filter { entry in
            let entryTerms = Set(EntryRetriever.tokenize(entry.title))
                .union(EntryRetriever.tokenize(entry.content))
            return !queryTerms.isDisjoint(with: entryTerms)
        }
        let ranked = EntryRetriever().topK(50, matching: query, in: matching, now: Date())
        return ranked.map { searchResult(from: $0, query: query, score: 0.0) }
    }

    /// Build a `SearchResult` from a decrypted on-device entry (Model-1 search).
    private static func searchResult(from entry: JournalEntry, query: String, score: Double) -> SearchResult {
        SearchResult(
            journalId: entry.id,
            title: entry.title,
            type: entry.type,
            date: dateFormatter.string(from: entry.updatedAt),
            snippet: snippet(from: entry.content, query: query),
            score: score
        )
    }

    private static let dateFormatter: DateFormatter = {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        f.locale = Locale(identifier: "en_US_POSIX")
        return f
    }()

    /// ~200-char snippet centered on the first query-term match (or the start).
    private static func snippet(from content: String, query: String) -> String {
        let terms = query.split(whereSeparator: { $0.isWhitespace }).map(String.init)
        var matchIndex: String.Index?
        for term in terms where !term.isEmpty {
            if let r = content.range(of: term, options: .caseInsensitive) { matchIndex = r.lowerBound; break }
        }
        let start = matchIndex
            .flatMap { content.index($0, offsetBy: -60, limitedBy: content.startIndex) } ?? content.startIndex
        let end = content.index(start, offsetBy: 200, limitedBy: content.endIndex) ?? content.endIndex
        var s = String(content[start..<end]).trimmingCharacters(in: .whitespacesAndNewlines)
        if start != content.startIndex { s = "…" + s }
        if end != content.endIndex { s += "…" }
        return s
    }

    // MARK: - Daily Report

    private struct DailyReportBody: Encodable { let date: String?; let force: Bool }

    func generateDailyReport(date: String?, force: Bool) async throws -> DailyInsightsReport {
        // ── Model 1 (zero-knowledge) branch ──────────────────────────────────
        // Send the day's writing as PLAINTEXT (`todayText`) plus the client-side
        // RAG `relatedContext` and source ids. The server never decrypts and does
        // NOT persist the report (no DEK) — the client stores/ re-encrypts the
        // returned card via the existing mapping. Falls back to the legacy body
        // when off/unavailable.
        //
        // NOTE(manual verification): the day-bounds filter here approximates the
        // server's `dayBounds` (dailyReport.ts) using the profile timezone, and
        // `relatedContext` uses keyword `EntryRetriever` rather than the server's
        // Chroma semantic search. Exact parity of the generated card requires
        // live end-to-end verification against the real API — do not assume it.
        // TODO(1c-D): swap the keyword retriever for on-device embedding search.
        var body: any Encodable = DailyReportBody(date: date, force: force)
        if DevFlags.aiModel1, let journals {
            let profile = await loadProfile()
            let allEntries = (try? await journals.fetchAllEntries()) ?? []
            let timeZone = TimeZone(identifier: profile?.timezone ?? "")
                ?? TimeZone.current
            let reference = Self.referenceDate(for: date, timeZone: timeZone) ?? now()

            let todaysEntries = allEntries.filter {
                Calendar.dayMatches($0.createdAt, reference, in: timeZone) && !$0.excludeFromShare
            }
            let todayIds = Set(todaysEntries.map(\.id))
            let todayText = todaysEntries.map(\.content).filter { !$0.isEmpty }.joined(separator: "\n\n")
            // RAG over PAST entries (exclude today's), matched on the day's text.
            // Semantic-first (1c-D) with keyword fallback; `coordinator` is nil
            // unless the flag is on and it was injected in `live()`.
            await primeSemanticIndexIfNeeded(entries: allEntries)
            let pastEntries = allEntries.filter { !todayIds.contains($0.id) }
            let relatedContext = await Model1Requests.journalContext(
                from: pastEntries, query: todayText, now: now(), searcher: coordinator
            )
            body = Model1Requests.DailyReportBody(
                date: date, force: force,
                name: profile?.displayName ?? "",
                todayText: todayText,
                relatedContext: relatedContext,
                sourceEntryIds: todaysEntries.map(\.id)
            )
        }
        return try await api.post(path: "/v1/ai/daily-report", body: body)
    }

    // MARK: - Model 1 helpers

    /// Builds the Model-1 chat request body by gathering PLAINTEXT context from
    /// the injected repositories. Best-effort: missing pieces default to empty so
    /// a valid body is always produced (the flag is set deliberately).
    private func buildModel1ChatBody(
        chatId: String,
        message: String,
        journals: JournalRepository,
        profiles: ProfileRepository,
        chats: ChatRepository
    ) async -> Model1Requests.ChatBody {
        let profile = await firstEmission(profiles.profile()).flatMap { $0 }
        let recentMessages = await firstEmission(chats.messages(chatId: chatId)) ?? []
        let history = Model1Requests.historyTurns(from: recentMessages, excludingLatest: message)

        // Match the legacy RAG query: current message + last two assistant turns.
        let assistantContext = history
            .filter { $0.role == MessageRole.assistant.rawValue }
            .suffix(2)
            .map(\.content)
            .joined(separator: " ")
        let ragQuery = String("\(message) \(assistantContext)".suffix(2000))

        let entries = (try? await journals.fetchAllEntries()) ?? []
        // Semantic-first (1c-D) with keyword fallback; `coordinator` is nil unless
        // the flag is on and it was injected in `live()`.
        await primeSemanticIndexIfNeeded(entries: entries)
        let journalContext = await Model1Requests.journalContext(
            from: entries, query: ragQuery, now: now(), searcher: coordinator
        )

        // Focal entry: the entry this chat was launched from (chat.journalId).
        var focalEntry: String?
        if let journalId = await firstEmission(chats.chats())?
            .first(where: { $0.id == chatId })?.journalId {
            focalEntry = entries.first(where: { $0.id == journalId })?.content
        }

        return Model1Requests.ChatBody(
            chatId: chatId,
            message: message,
            name: profile?.displayName ?? "",
            bio: profile?.biography ?? "",
            profile: profile.map { Model1Requests.profileFields(from: $0.details) } ?? [:],
            history: history,
            journalContext: journalContext,
            focalEntry: focalEntry
        )
    }

    /// Prime the semantic index at most once per session: load any server-synced
    /// vectors, then backfill entries that aren't indexed yet. Best-effort — every
    /// step swallows its error because retrieval falls back to keyword when the
    /// index is empty, so priming can never make the result worse than today. A
    /// no-op unless the Model-1 flag is on and a coordinator was injected (nil in
    /// mocks / flag-off), and only runs when there is something to index.
    private func primeSemanticIndexIfNeeded(entries: [JournalEntry]) async {
        guard DevFlags.aiModel1, let coordinator, !semanticIndexPrimed else { return }
        semanticIndexPrimed = true
        try? await coordinator.loadIndex()
        guard !entries.isEmpty else { return }
        try? await coordinator.backfill(entries.map { (id: $0.id, text: $0.content) })
    }

    /// First emission of the injected profile stream, or nil when there is no
    /// profiles repository / no profile yet.
    private func loadProfile() async -> UserProfile? {
        guard let profiles else { return nil }
        return await firstEmission(profiles.profile()).flatMap { $0 }
    }

    /// Returns the first value emitted by an `AsyncStream`, then lets it terminate.
    private func firstEmission<T>(_ stream: AsyncStream<T>) async -> T? {
        for await value in stream { return value }
        return nil
    }

    /// Local noon on `dateArg` ("yyyy-MM-dd") in `timeZone`, mirroring the
    /// server's `new Date(`${dateArg}T12:00:00`)`. Nil for a nil/malformed arg.
    private static func referenceDate(for dateArg: String?, timeZone: TimeZone) -> Date? {
        guard let dateArg else { return nil }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timeZone
        formatter.dateFormat = "yyyy-MM-dd'T'HH:mm:ss"
        return formatter.date(from: "\(dateArg)T12:00:00")
    }
}

private extension Calendar {
    /// True when `a` and `b` fall on the same calendar day in `timeZone`.
    static func dayMatches(_ a: Date, _ b: Date, in timeZone: TimeZone) -> Bool {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timeZone
        return calendar.isDate(a, inSameDayAs: b)
    }
}
