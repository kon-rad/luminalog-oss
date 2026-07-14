import Foundation

/// Plaintext request bodies + context assembly for the server "Model 1"
/// (zero-knowledge) AI path — increment 1c-C of the encryption migration.
///
/// On this path the client decrypts its own context locally (entries, bio,
/// profile, chat history via the existing repositories/`UserKeyStore`) and sends
/// it as PLAINTEXT; the server never touches the DEK. Everything here is used
/// only when `DevFlags.aiModel1` is ON — OFF in production until the 1d cutover,
/// so the legacy ID-based request shape is unchanged today.
///
/// The field names below mirror the server contract EXACTLY:
/// - chat:         server/src/routes/chat.ts       (name, bio, profile, history[], journalContext, focalEntry)
/// - summary:      server/src/routes/ai.ts          (content, type)
/// - daily-prompt: server/src/routes/ai.ts          (entries[], profile, name)
/// - daily-report: server/src/routes/dailyReport.ts (todayText, relatedContext, sourceEntryIds, name)
/// Do NOT rename a field here without changing the matching server branch.
///
/// This type is a **pure** value: no networking, no Firestore, no crypto, no
/// global state, and it never reads `Date()` internally (callers inject `now`),
/// so it is deterministically unit-testable.
enum Model1Requests {

    // MARK: - Profile fields (server `ProfileFields`)

    /// The onboarding profile as the server's `ProfileFields` object
    /// (services/profileContext.ts). Only non-empty fields are included — the
    /// server treats a missing key the same as an empty value.
    static func profileFields(from details: UserProfile.ProfileDetails) -> [String: String] {
        var out: [String: String] = [:]
        func add(_ key: String, _ value: String?) {
            guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !trimmed.isEmpty else { return }
            out[key] = trimmed
        }
        add("goals", details.goals)
        add("hobbies", details.hobbies)
        add("age", details.age)
        add("gender", details.gender)
        add("challenges", details.challenges)
        add("dailyHabits", details.dailyHabits)
        add("starSign", details.starSign)
        add("maritalStatus", details.maritalStatus)
        add("location", details.location)
        add("education", details.education)
        add("work", details.work)
        add("favoriteMovies", details.favoriteMovies)
        add("favoriteArtists", details.favoriteArtists)
        add("favoriteBooks", details.favoriteBooks)
        add("languages", details.languages)
        add("friendsDescribe", details.friendsDescribe)
        return out
    }

    // MARK: - Request bodies

    /// Model-1 chat body. Presence of the `history` array is what triggers the
    /// server's Model-1 branch (legacy clients never send one).
    struct ChatBody: Encodable {
        let chatId: String
        let message: String
        let name: String
        let bio: String
        let profile: [String: String]
        let history: [Turn]
        let journalContext: String
        let focalEntry: String?

        struct Turn: Encodable {
            let role: String
            let content: String
        }
    }

    /// Model-1 summary body. Presence of `content` triggers the server branch.
    struct SummaryBody: Encodable {
        /// Still sent so the legacy server (flag off) can fall back to it.
        let journalId: String
        let content: String
        let type: String
    }

    /// Model-1 full-entry-AI body: PLAINTEXT content + type → summary/insights/prompts.
    struct EntryAIBody: Encodable {
        let content: String
        let type: String
    }

    /// Model-1 daily-prompt body. Presence of `entries` triggers the server branch.
    struct DailyPromptBody: Encodable {
        let name: String
        let profile: [String: String]
        let entries: [Entry]

        struct Entry: Encodable {
            let id: String
            let type: String
            let title: String
            let content: String
        }
    }

    /// Model-1 daily-report body. Presence of `todayText` triggers the server branch.
    struct DailyReportBody: Encodable {
        let date: String?
        let force: Bool
        let name: String
        let todayText: String
        let relatedContext: String
        let sourceEntryIds: [String]
    }

    // MARK: - Assembly helpers

    /// Recent chat turns mapped to `{role, content}`, capped at `limit`.
    ///
    /// On the Model-1 chat path the client persists the just-sent user message
    /// BEFORE calling the AI, so it is already in `messages`. The server appends
    /// the current `message` itself, so we drop a trailing user turn equal to
    /// `excludingLatest` to avoid duplicating it in the prompt.
    static func historyTurns(
        from messages: [ChatMessage],
        excludingLatest latest: String?,
        limit: Int = 10
    ) -> [ChatBody.Turn] {
        var msgs = messages
        if let latest, let last = msgs.last, last.role == .user, last.text == latest {
            msgs.removeLast()
        }
        return msgs.suffix(limit).map { ChatBody.Turn(role: $0.role.rawValue, content: $0.text) }
    }

    /// Daily-prompt entry projections from the user's most-recent decrypted entries.
    static func promptEntries(
        from entries: [JournalEntry],
        limit: Int = 5,
        snippetChars: Int = 500
    ) -> [DailyPromptBody.Entry] {
        entries.prefix(limit).map { entry in
            DailyPromptBody.Entry(
                id: entry.id,
                type: entry.type.rawValue,
                title: entry.title.isEmpty ? "Untitled" : entry.title,
                content: String(entry.content.prefix(snippetChars))
            )
        }
    }

    /// Client-side RAG context string, mirroring the server retriever's format
    /// (journalRetriever.ts): `[#i — type · title · date]\n<snippet>` blocks
    /// joined by a blank line. Ranks with `EntryRetriever` (keyword + recency).
    ///
    /// This is the pure keyword path — kept as the fallback for the semantic
    /// overload below (and covered by its own tests). It is byte-identical to the
    /// pre-1c-D behavior.
    static func journalContext(
        from entries: [JournalEntry],
        query: String,
        now: Date,
        topK: Int = 5,
        snippetChars: Int = 500,
        retriever: EntryRetriever = EntryRetriever()
    ) -> String {
        let top = retriever.topK(topK, matching: query, in: entries, now: now)
        return format(top, snippetChars: snippetChars)
    }

    /// Semantic-first RAG context string (increment 1c-D / 19b). When `searcher`
    /// is non-nil it embeds `query`, takes the top-`topK` entry ids by cosine
    /// similarity, and formats the matching entries in that ranked order. Falls
    /// back to the pure keyword `journalContext` above whenever the semantic path
    /// yields nothing usable — an empty index, a thrown error, or ids that don't
    /// resolve to any of the supplied `entries` — so it is a HYBRID that is never
    /// worse than today. Passing `searcher: nil` is exactly the keyword path.
    ///
    /// Callers only reach this with a non-nil `searcher` when `DevFlags.aiModel1`
    /// is ON; with the flag OFF the legacy sync keyword path runs unchanged.
    static func journalContext(
        from entries: [JournalEntry],
        query: String,
        now: Date,
        topK: Int = 5,
        snippetChars: Int = 500,
        retriever: EntryRetriever = EntryRetriever(),
        searcher: SemanticIndexCoordinating?
    ) async -> String {
        // Server-RAG (Architecture A): chunk-only context. When `serverRag` is ON,
        // the searcher returns chunk references; format ONLY those matched chunks
        // (re-extracted on-device via the deterministic `JournalChunker`), not whole
        // entries. Falls through to the entry-level path on any miss, so it is never
        // worse. The on-device path (`serverRag` OFF) is byte-identical to before.
        if DevFlags.serverRag, let searcher,
           let refs = try? await searcher.searchChunks(query: query, k: topK), !refs.isEmpty {
            let ctx = chunkContext(from: entries, refs: refs, snippetChars: snippetChars)
            if !ctx.isEmpty { return ctx }
        }
        let ranked = await rankedEntries(
            from: entries, query: query, now: now, topK: topK, retriever: retriever, searcher: searcher
        )
        return format(ranked, snippetChars: snippetChars)
    }

    /// Chunk-only RAG context (Architecture A): for each chunk ref, re-run the
    /// deterministic `JournalChunker` on the resolved entry and format
    /// `chunk[chunkIndex]` with the same header shape as `format(_:snippetChars:)`.
    /// Refs that don't resolve (unknown entry id / out-of-range chunk) are skipped.
    /// Pure + testable; only the server-RAG path uses it.
    static func chunkContext(
        from entries: [JournalEntry],
        refs: [ChunkRef],
        snippetChars: Int = 600
    ) -> String {
        let byId = Dictionary(entries.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
        let blocks = refs.compactMap { ref -> (entry: JournalEntry, text: String)? in
            guard let entry = byId[ref.entryId] else { return nil }
            let chunks = JournalChunker.chunks(of: entry.content)
            guard ref.chunkIndex >= 0, ref.chunkIndex < chunks.count else { return nil }
            return (entry, String(chunks[ref.chunkIndex].prefix(snippetChars)))
        }
        return blocks.enumerated().map { index, block in
            let title = block.entry.title.isEmpty ? "Untitled" : block.entry.title
            let date = dayFormatter.string(from: block.entry.createdAt)
            return "[#\(index + 1) — \(block.entry.type.rawValue) · \(title) · \(date)]\n\(block.text)"
        }.joined(separator: "\n\n")
    }

    /// The semantic-first ranked entries (with the keyword+recency hybrid fallback)
    /// that back `journalContext`. Exposed so callers can post-process the ranked set
    /// before formatting — e.g. the voice path unions today's entries in so the
    /// assistant never misses an entry the user just wrote.
    static func rankedEntries(
        from entries: [JournalEntry],
        query: String,
        now: Date,
        topK: Int = 5,
        retriever: EntryRetriever = EntryRetriever(),
        searcher: SemanticIndexCoordinating?
    ) async -> [JournalEntry] {
        if let searcher,
           let ids = try? await searcher.search(query: query, k: topK), !ids.isEmpty {
            let byId = Dictionary(entries.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
            let ranked = ids.compactMap { byId[$0] }
            if !ranked.isEmpty { return ranked }
        }
        // Hybrid fallback: identical to the legacy keyword path.
        return retriever.topK(topK, matching: query, in: entries, now: now)
    }

    /// How per-entry timestamps and types are rendered in the RAG context.
    enum ContextDateStyle {
        /// `yyyy-MM-dd` in UTC with the raw type value — the server-mirrored shape
        /// used by the text-chat path (byte-identical to the pre-1c-D behavior).
        case dayUTC
        /// `yyyy-MM-dd HH:mm` in `timeZone` (device-local) with a human type label —
        /// used by the voice path so the assistant can reason about *when* and *how*
        /// each entry was made ("today's voice note", "yesterday's handwritten page").
        case dateTimeLocal
    }

    /// Format ranked entries into the RAG block string. Shared by the keyword and
    /// semantic paths; `dateStyle` selects the legacy server shape (text) or the
    /// timestamped local shape (voice).
    static func format(
        _ entries: [JournalEntry],
        snippetChars: Int,
        dateStyle: ContextDateStyle = .dayUTC,
        timeZone: TimeZone = .current
    ) -> String {
        let localFormatter = dateStyle == .dateTimeLocal ? dateTimeFormatter(timeZone) : nil
        return entries.enumerated().map { index, entry in
            let title = entry.title.isEmpty ? "Untitled" : entry.title
            let snippet = String(entry.content.prefix(snippetChars))
            switch dateStyle {
            case .dayUTC:
                let date = dayFormatter.string(from: entry.createdAt)
                return "[#\(index + 1) — \(entry.type.rawValue) · \(title) · \(date)]\n\(snippet)"
            case .dateTimeLocal:
                let stamp = localFormatter!.string(from: entry.createdAt)
                return "[#\(index + 1) — \(typeLabel(entry.type)) · \(title) · \(stamp)]\n\(snippet)"
            }
        }.joined(separator: "\n\n")
    }

    /// Human, voice-friendly label for an entry type. `image` entries are the user's
    /// handwritten journal pages, so we name them as such for the assistant.
    static func typeLabel(_ type: JournalType) -> String {
        switch type {
        case .text:  return "text"
        case .voice: return "voice"
        case .video: return "video"
        case .image: return "handwritten image"
        }
    }

    /// `yyyy-MM-dd HH:mm` in `timeZone` — the device-local stamp for the voice path.
    static func dateTimeFormatter(_ timeZone: TimeZone) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timeZone
        formatter.dateFormat = "yyyy-MM-dd HH:mm"
        return formatter
    }

    /// `yyyy-MM-dd` in UTC — matches the server's `indexedAt.slice(0, 10)` shape.
    static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}
