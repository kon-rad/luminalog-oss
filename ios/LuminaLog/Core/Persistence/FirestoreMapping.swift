import Foundation
import FirebaseFirestore

// Explicit Firestore document ↔ pure-model mapping (spec §3) with field-level
// encryption (spec §4–5). Firebase + crypto stay inside Core/Persistence; the
// domain models remain pure. In-scope text fields are stored as EncryptedField
// envelopes; query keys, flags, and PII stay plaintext.

// MARK: - Helpers

private func timestamp(_ value: Any?) -> Date? {
    (value as? Timestamp)?.dateValue()
}

/// Errors thrown when a document cannot be decrypted (fail closed — never show
/// ciphertext as if it were text).
enum MappingDecryptionError: Error { case missingField(String) }

extension FieldCipher {
    /// Encrypt to the Firestore envelope dict.
    func sealed(_ plaintext: String, _ context: String) throws -> [String: Any] {
        try encrypt(plaintext, context: context).firestoreData
    }
    /// Decrypt a required field from its Firestore value (throws if absent/garbled).
    func opened(_ value: Any?, _ context: String) throws -> String {
        guard let field = EncryptedField(data: value) else {
            throw MappingDecryptionError.missingField(context)
        }
        return try decrypt(field, context: context)
    }
    /// Decrypt an optional field: nil stays nil; present-but-garbled throws.
    func openedIfPresent(_ value: Any?, _ context: String) throws -> String? {
        guard value != nil else { return nil }
        return try opened(value, context)
    }
}

// MARK: - JournalEntry

extension JournalEntry {

    init?(documentId: String, data: [String: Any], cipher: FieldCipher) {
        guard
            let userId = data["userId"] as? String,
            let typeRaw = data["type"] as? String,
            let type = JournalType(rawValue: typeRaw)
        else { return nil }

        let media = (data["media"] as? [[String: Any]] ?? []).compactMap(MediaItem.init(data:))
        let editHistory = (data["editHistory"] as? [[String: Any]] ?? []).compactMap(EditRecord.init(data:))

        do {
            self.init(
                id: documentId,
                userId: userId,
                type: type,
                title: try cipher.opened(data["title"], "journals.title"),
                createdAt: timestamp(data["createdAt"]) ?? Date(),
                updatedAt: timestamp(data["updatedAt"]) ?? Date(),
                content: try cipher.opened(data["content"], "journals.content"),
                contentEditedAt: timestamp(data["contentEditedAt"]),
                editHistory: editHistory,
                media: media,
                transcriptStatus: (data["transcriptStatus"] as? String).flatMap(TranscriptStatus.init(rawValue:)),
                processingStatus: (data["processingStatus"] as? String).flatMap(ProcessingStatus.init(rawValue:)),
                summary: try AIGeneration(data: data["summary"] as? [String: Any], cipher: cipher, context: "journals.summary"),
                insights: try AIGeneration(data: data["insights"] as? [String: Any], cipher: cipher, context: "journals.insights"),
                prompts: try AIPrompts(data: data["prompts"] as? [String: Any], cipher: cipher),
                vector: VectorState(data: data["vector"] as? [String: Any]) ?? VectorState(),
                wordCount: data["wordCount"] as? Int ?? 0,
                emotion: EmotionScore(firestore: data["emotion"] as? [String: Any]),
                excludeFromShare: data["excludeFromShare"] as? Bool ?? false,
                promptText: data["promptText"] as? String
            )
        } catch {
            return nil
        }
    }

    func firestoreData(cipher: FieldCipher) throws -> [String: Any] {
        var data: [String: Any] = [
            "userId": userId,
            "type": type.rawValue,
            "title": try cipher.sealed(title, "journals.title"),
            "createdAt": Timestamp(date: createdAt),
            "updatedAt": Timestamp(date: updatedAt),
            "content": try cipher.sealed(content, "journals.content"),
            "media": media.map(\.firestoreData),
            "vector": vector.firestoreData,
            "wordCount": wordCount,
        ]
        if let contentEditedAt { data["contentEditedAt"] = Timestamp(date: contentEditedAt) }
        if !editHistory.isEmpty {
            // Metadata only (timestamps + field names) — not field-encrypted.
            data["editHistory"] = editHistory.map(\.firestoreData)
        }
        if let transcriptStatus { data["transcriptStatus"] = transcriptStatus.rawValue }
        if let processingStatus { data["processingStatus"] = processingStatus.rawValue }
        if let summary { data["summary"] = try summary.firestoreData(cipher: cipher, context: "journals.summary") }
        if let insights { data["insights"] = try insights.firestoreData(cipher: cipher, context: "journals.insights") }
        if let prompts { data["prompts"] = try prompts.firestoreData(cipher: cipher) }
        data["excludeFromShare"] = excludeFromShare
        if let emotion { data["emotion"] = emotion.firestoreData() }
        if let promptText { data["promptText"] = promptText }
        return data
    }
}

extension EditRecord {

    init?(data: [String: Any]) {
        guard let editedAt = timestamp(data["editedAt"]) else { return nil }
        self.init(
            editedAt: editedAt,
            fields: data["fields"] as? [String] ?? []
        )
    }

    var firestoreData: [String: Any] {
        ["editedAt": Timestamp(date: editedAt), "fields": fields]
    }
}

extension MediaItem {

    init?(data: [String: Any]) {
        guard
            let s3Key = data["s3Key"] as? String,
            let kindRaw = data["kind"] as? String,
            let kind = MediaKind(rawValue: kindRaw)
        else { return nil }
        self.init(
            s3Key: s3Key,
            kind: kind,
            durationSec: data["durationSec"] as? Double,
            width: data["width"] as? Int,
            height: data["height"] as? Int,
            thumbnailS3Key: data["thumbnailS3Key"] as? String
        )
    }

    var firestoreData: [String: Any] {
        var data: [String: Any] = ["s3Key": s3Key, "kind": kind.rawValue]
        if let durationSec { data["durationSec"] = durationSec }
        if let width { data["width"] = width }
        if let height { data["height"] = height }
        if let thumbnailS3Key { data["thumbnailS3Key"] = thumbnailS3Key }
        return data
    }
}

extension AIGeneration {

    init?(data: [String: Any]?, cipher: FieldCipher, context: String) throws {
        guard let data else { return nil }
        guard let text = try cipher.openedIfPresent(data["text"], "\(context).text") else { return nil }
        self.init(
            text: text,
            generatedAt: timestamp(data["generatedAt"]) ?? Date(),
            model: data["model"] as? String ?? ""
        )
    }

    func firestoreData(cipher: FieldCipher, context: String) throws -> [String: Any] {
        [
            "text": try cipher.sealed(text, "\(context).text"),
            "generatedAt": Timestamp(date: generatedAt),
            "model": model,
        ]
    }
}

extension AIPrompts {

    init?(data: [String: Any]?, cipher: FieldCipher) throws {
        guard let data, let raw = data["items"] as? [[String: Any]] else { return nil }
        let items = try raw.enumerated().map { index, value in
            try cipher.opened(value, "journals.prompts.items.\(index)")
        }
        self.init(
            items: items,
            generatedAt: timestamp(data["generatedAt"]) ?? Date(),
            model: data["model"] as? String ?? ""
        )
    }

    func firestoreData(cipher: FieldCipher) throws -> [String: Any] {
        let sealedItems = try items.enumerated().map { index, value in
            try cipher.sealed(value, "journals.prompts.items.\(index)")
        }
        return ["items": sealedItems, "generatedAt": Timestamp(date: generatedAt), "model": model]
    }
}

extension VectorState {

    init?(data: [String: Any]?) {
        guard
            let data,
            let statusRaw = data["status"] as? String,
            let status = Status(rawValue: statusRaw)
        else { return nil }
        self.init(
            status: status,
            chunkCount: data["chunkCount"] as? Int ?? 0,
            indexedAt: timestamp(data["indexedAt"])
        )
    }

    var firestoreData: [String: Any] {
        var data: [String: Any] = ["status": status.rawValue, "chunkCount": chunkCount]
        if let indexedAt { data["indexedAt"] = Timestamp(date: indexedAt) }
        return data
    }
}

// MARK: - UserProfile

extension UserProfile {

    init(documentId: String, data: [String: Any], cipher: FieldCipher) {
        self.init(
            id: documentId,
            displayName: data["displayName"] as? String ?? "",
            email: data["email"] as? String ?? "",
            photoURL: (data["photoURL"] as? String).flatMap(URL.init(string:)),
            biography: (try? cipher.openedIfPresent(data["biography"], "users.biography")) ?? "",
            createdAt: timestamp(data["createdAt"]) ?? Date(),
            timezone: data["timezone"] as? String ?? TimeZone.current.identifier,
            stats: Stats(data: data["stats"] as? [String: Any] ?? [:]),
            storageStats: StorageStats(data: data["storage"] as? [String: Any] ?? [:]),
            totalMinutesInApp: data["totalMinutesInApp"] as? Int ?? 0,
            dailyPrompt: UserProfile.DailyPrompt(data: data["dailyPrompt"] as? [String: Any], cipher: cipher),
            summaryConfig: {
                guard let c = data["summaryConfig"] as? [String: Any],
                      let wordLength = c["wordLength"] as? Int,
                      let systemPrompt = c["systemPrompt"] as? String else { return nil }
                return UserProfile.SummaryConfig(wordLength: wordLength, systemPrompt: systemPrompt)
            }(),
            details: UserProfile.ProfileDetails(data: data["profileDetails"] as? [String: Any] ?? [:], cipher: cipher)
        )
    }

    func firestoreData(cipher: FieldCipher) throws -> [String: Any] {
        var data: [String: Any] = [
            "displayName": displayName,
            "email": email,
            "biography": try cipher.sealed(biography, "users.biography"),
            "createdAt": Timestamp(date: createdAt),
            "timezone": timezone,
            "stats": stats.firestoreData,
            "storage": storageStats.firestoreData,
            "totalMinutesInApp": totalMinutesInApp,
        ]
        if let photoURL { data["photoURL"] = photoURL.absoluteString }
        if let dailyPrompt { data["dailyPrompt"] = try dailyPrompt.firestoreData(cipher: cipher) }
        if let summaryConfig {
            data["summaryConfig"] = [
                "wordLength": summaryConfig.wordLength,
                "systemPrompt": summaryConfig.systemPrompt,
            ]
        }
        let detailsData = try details.firestoreData(cipher: cipher)
        if !detailsData.isEmpty { data["profileDetails"] = detailsData }
        return data
    }
}

extension UserProfile.ProfileDetails {

    /// (Firestore key, keypath) for every encrypted detail field — the single
    /// place the wire format is enumerated, so a field is added in one spot.
    private static let fields: [(String, WritableKeyPath<UserProfile.ProfileDetails, String?>)] = [
        ("goals", \.goals), ("hobbies", \.hobbies), ("age", \.age),
        ("gender", \.gender), ("challenges", \.challenges), ("dailyHabits", \.dailyHabits),
        ("starSign", \.starSign), ("maritalStatus", \.maritalStatus), ("location", \.location),
        ("education", \.education), ("work", \.work), ("favoriteMovies", \.favoriteMovies),
        ("favoriteArtists", \.favoriteArtists), ("favoriteBooks", \.favoriteBooks),
        ("languages", \.languages), ("friendsDescribe", \.friendsDescribe),
    ]

    init(data: [String: Any], cipher: FieldCipher) {
        var details = UserProfile.ProfileDetails()
        for (key, keyPath) in Self.fields {
            details[keyPath: keyPath] =
                try? cipher.openedIfPresent(data[key], "users.profileDetails.\(key)")
        }
        self = details
    }

    /// Wire format per field, written with `setData(merge: true)`:
    /// - `nil` (never set) → omitted, leaving any existing value untouched;
    /// - empty/whitespace (explicitly cleared on the edit screen) →
    ///   `FieldValue.delete()` so the stored value is removed;
    /// - non-empty → AES-256-GCM envelope.
    func firestoreData(cipher: FieldCipher) throws -> [String: Any] {
        var data: [String: Any] = [:]
        for (key, keyPath) in Self.fields {
            guard let value = self[keyPath: keyPath] else { continue }
            if value.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                data[key] = FieldValue.delete()
            } else {
                data[key] = try cipher.sealed(value, "users.profileDetails.\(key)")
            }
        }
        return data
    }
}

extension UserProfile.Stats {

    init(data: [String: Any]) {
        self.init(
            streakCount: data["streakCount"] as? Int ?? 0,
            maxStreakCount: data["maxStreakCount"] as? Int ?? 0,
            lastEntryDate: timestamp(data["lastEntryDate"]),
            totalWords: data["totalWords"] as? Int ?? 0,
            goalDayDate: timestamp(data["goalDayDate"]),
            goalDayWords: data["goalDayWords"] as? Int ?? 0,
            promptsAnswered: data["promptsAnswered"] as? Int ?? 0
        )
    }

    var firestoreData: [String: Any] {
        var data: [String: Any] = [
            "streakCount": streakCount,
            "maxStreakCount": maxStreakCount,
            "totalWords": totalWords,
            "goalDayWords": goalDayWords,
            "promptsAnswered": promptsAnswered,
        ]
        if let lastEntryDate { data["lastEntryDate"] = Timestamp(date: lastEntryDate) }
        if let goalDayDate { data["goalDayDate"] = Timestamp(date: goalDayDate) }
        return data
    }
}

extension UserProfile.StorageStats {

    init(data: [String: Any]) {
        self.init(
            audioBytes: data["audioBytes"] as? Int ?? 0,
            audioCount: data["audioCount"] as? Int ?? 0,
            imageBytes: data["imageBytes"] as? Int ?? 0,
            imageCount: data["imageCount"] as? Int ?? 0,
            videoBytes: data["videoBytes"] as? Int ?? 0,
            videoCount: data["videoCount"] as? Int ?? 0
        )
    }

    var firestoreData: [String: Any] {
        [
            "audioBytes": audioBytes,
            "audioCount": audioCount,
            "imageBytes": imageBytes,
            "imageCount": imageCount,
            "videoBytes": videoBytes,
            "videoCount": videoCount,
        ]
    }
}

extension UserProfile.DailyPrompt {

    init?(data: [String: Any]?, cipher: FieldCipher) {
        guard let data,
              let text = try? cipher.openedIfPresent(data["text"], "users.dailyPrompt.text")
        else { return nil }
        // Each prompt's question is field-encrypted; the area label is plaintext.
        let prompts: [DailyPromptItem]? = (data["prompts"] as? [[String: Any]])?.compactMap { item in
            guard let area = item["area"] as? String,
                  let text = try? cipher.openedIfPresent(item["text"], "users.dailyPrompt.prompts.text")
            else { return nil }
            return DailyPromptItem(area: area, text: text)
        }
        self.init(
            text: text,
            date: timestamp(data["date"]) ?? Date(),
            sourceEntryIds: data["sourceEntryIds"] as? [String],
            prompts: (prompts?.isEmpty ?? true) ? nil : prompts
        )
    }

    func firestoreData(cipher: FieldCipher) throws -> [String: Any] {
        var data: [String: Any] = [
            "text": try cipher.sealed(text, "users.dailyPrompt.text"),
            "date": Timestamp(date: date),
        ]
        if let sourceEntryIds { data["sourceEntryIds"] = sourceEntryIds }
        if let prompts, !prompts.isEmpty {
            data["prompts"] = try prompts.map { item in
                [
                    "area": item.area,
                    "text": try cipher.sealed(item.text, "users.dailyPrompt.prompts.text"),
                ]
            }
        }
        return data
    }
}

// MARK: - Chat

extension Chat {

    init?(documentId: String, data: [String: Any], cipher: FieldCipher) {
        guard
            let userId = data["userId"] as? String,
            let kindRaw = data["kind"] as? String,
            let kind = ChatKind(rawValue: kindRaw)
        else { return nil }
        let title = (try? cipher.openedIfPresent(data["title"], "chats.title")) ?? ""
        self.init(
            id: documentId,
            userId: userId,
            kind: kind,
            title: title,
            createdAt: timestamp(data["createdAt"]) ?? Date(),
            lastMessageAt: timestamp(data["lastMessageAt"]) ?? Date(),
            vapiCallId: data["vapiCallId"] as? String,
            voiceStatus: data["voiceStatus"] as? String,
            endedReason: data["endedReason"] as? String,
            recordingPath: data["recordingPath"] as? String,
            recordingDurationSeconds: (data["recordingDurationSeconds"] as? NSNumber)?.doubleValue,
            rawTranscript: (try? cipher.openedIfPresent(data["rawTranscript"], "chats.rawTranscript")) ?? nil,
            journalId: data["journalId"] as? String,
            journalTitle: data["journalTitle"] as? String
        )
    }

    func firestoreData(cipher: FieldCipher) throws -> [String: Any] {
        var data: [String: Any] = [
            "userId": userId,
            "kind": kind.rawValue,
            "title": try cipher.sealed(title, "chats.title"),
            "createdAt": Timestamp(date: createdAt),
            "lastMessageAt": Timestamp(date: lastMessageAt),
        ]
        if let vapiCallId { data["vapiCallId"] = vapiCallId }
        if let journalId { data["journalId"] = journalId }
        if let journalTitle { data["journalTitle"] = journalTitle }
        return data
    }
}

extension ChatMessage {

    init?(documentId: String, data: [String: Any], cipher: FieldCipher) {
        guard
            let roleRaw = data["role"] as? String,
            let role = MessageRole(rawValue: roleRaw)
        else { return nil }
        do {
            let text = try cipher.opened(data["text"], "messages.text")
            let sources = try (data["sources"] as? [[String: Any]])?
                .enumerated()
                .compactMap { index, value in try MessageSource(data: value, cipher: cipher, index: index) }
            self.init(
                id: documentId,
                role: role,
                text: text,
                createdAt: timestamp(data["createdAt"]) ?? Date(),
                sources: sources
            )
        } catch {
            return nil
        }
    }

    func firestoreData(cipher: FieldCipher) throws -> [String: Any] {
        var data: [String: Any] = [
            "role": role.rawValue,
            "text": try cipher.sealed(text, "messages.text"),
            "createdAt": Timestamp(date: createdAt),
        ]
        if let sources {
            data["sources"] = try sources.enumerated().map { index, source in
                try source.firestoreData(cipher: cipher, index: index)
            }
        }
        return data
    }
}

extension MessageSource {

    init?(data: [String: Any], cipher: FieldCipher, index: Int) throws {
        guard let journalId = data["journalId"] as? String else { return nil }
        let snippet = try cipher.opened(data["snippet"], "messages.sources.\(index).snippet")
        let title = (try? cipher.openedIfPresent(data["title"], "messages.sources.\(index).title")) ?? ""
        self.init(
            journalId: journalId,
            snippet: snippet,
            title: title,
            type: data["type"] as? String ?? "",
            date: data["date"] as? String ?? "",
            score: (data["score"] as? NSNumber)?.doubleValue ?? (data["score"] as? Double ?? 0)
        )
    }

    func firestoreData(cipher: FieldCipher, index: Int) throws -> [String: Any] {
        [
            "journalId": journalId,
            "snippet": try cipher.sealed(snippet, "messages.sources.\(index).snippet"),
            "title": try cipher.sealed(title, "messages.sources.\(index).title"),
            "type": type,
            "date": date,
            "score": score,
        ]
    }
}

// MARK: - EmotionScore

extension EmotionScore {

    /// Plaintext map (derived numeric — not field-encrypted).
    init?(firestore data: [String: Any]?) {
        guard let data, let source = data["source"] as? String else { return nil }
        let scores = (data["scores"] as? [String: Any] ?? [:]).compactMapValues {
            ($0 as? NSNumber)?.doubleValue
        }
        let top = (data["top"] as? [[String: Any]] ?? []).compactMap { d -> EmotionScore.Pick? in
            guard let n = d["name"] as? String,
                  let s = (d["score"] as? NSNumber)?.doubleValue else { return nil }
            return .init(name: n, score: s)
        }
        self.init(
            source: source,
            scores: scores,
            top: top,
            model: data["model"] as? String ?? "",
            scoredAt: timestamp(data["scoredAt"])
        )
    }

    func firestoreData() -> [String: Any] {
        var data: [String: Any] = [
            "source": source,
            "scores": scores,
            "model": model,
            "top": top.map { ["name": $0.name, "score": $0.score] },
        ]
        if let scoredAt { data["scoredAt"] = Timestamp(date: scoredAt) }
        return data
    }
}

// MARK: - DailyInsightsReport

extension DailyInsightsReport {

    /// Decrypt the four text fields; the rest are plaintext. `id` is the Firestore
    /// document id (`{date}_{millis}`), which uniquely identifies one generation.
    init(firestore data: [String: Any], id: String, cipher: FieldCipher) throws {
        func dec(_ key: String) throws -> String {
            try cipher.opened(data[key], "dailyReports.\(key)")
        }
        self.init(
            id: id,
            date: data["date"] as? String ?? "",
            insights: try dec("insights"),
            findings: try dec("findings"),
            gem: try dec("question"),   // legacy field name; AAD stays dailyReports.question
            emotionSummary: try dec("emotionSummary"),
            totalWords: data["totalWords"] as? Int ?? 0,
            wordsToday: data["wordsToday"] as? Int ?? 0,
            streakCount: data["streakCount"] as? Int ?? 0,
            emotions: (data["emotions"] as? [[String: Any]] ?? []).compactMap {
                guard let n = $0["name"] as? String,
                      let s = ($0["score"] as? NSNumber)?.doubleValue else { return nil }
                return .init(name: n, score: s)
            },
            imageUrl: (data["imageUrl"] as? String).flatMap(URL.init),
            imageThumbUrl: (data["imageThumbUrl"] as? String).flatMap(URL.init),
            imageQuery: data["imageQuery"] as? String,
            photographerName: data["photographerName"] as? String,
            photographerUrl: (data["photographerUrl"] as? String).flatMap(URL.init),
            sourceEntryIds: data["sourceEntryIds"] as? [String] ?? [],
            model: data["model"] as? String ?? "",
            generatedAt: timestamp(data["generatedAt"])
        )
    }
}
