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

private extension FieldCipher {
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
                media: media,
                transcriptStatus: (data["transcriptStatus"] as? String).flatMap(TranscriptStatus.init(rawValue:)),
                summary: try AIGeneration(data: data["summary"] as? [String: Any], cipher: cipher, context: "journals.summary"),
                insights: try AIGeneration(data: data["insights"] as? [String: Any], cipher: cipher, context: "journals.insights"),
                prompts: try AIPrompts(data: data["prompts"] as? [String: Any], cipher: cipher),
                vector: VectorState(data: data["vector"] as? [String: Any]) ?? VectorState(),
                wordCount: data["wordCount"] as? Int ?? 0
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
        if let transcriptStatus { data["transcriptStatus"] = transcriptStatus.rawValue }
        if let summary { data["summary"] = try summary.firestoreData(cipher: cipher, context: "journals.summary") }
        if let insights { data["insights"] = try insights.firestoreData(cipher: cipher, context: "journals.insights") }
        if let prompts { data["prompts"] = try prompts.firestoreData(cipher: cipher) }
        return data
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
            height: data["height"] as? Int
        )
    }

    var firestoreData: [String: Any] {
        var data: [String: Any] = ["s3Key": s3Key, "kind": kind.rawValue]
        if let durationSec { data["durationSec"] = durationSec }
        if let width { data["width"] = width }
        if let height { data["height"] = height }
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
            dailyPrompt: UserProfile.DailyPrompt(data: data["dailyPrompt"] as? [String: Any], cipher: cipher)
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
        ]
        if let photoURL { data["photoURL"] = photoURL.absoluteString }
        if let dailyPrompt { data["dailyPrompt"] = try dailyPrompt.firestoreData(cipher: cipher) }
        return data
    }
}

extension UserProfile.Stats {

    init(data: [String: Any]) {
        self.init(
            streakCount: data["streakCount"] as? Int ?? 0,
            lastEntryDate: timestamp(data["lastEntryDate"]),
            totalWords: data["totalWords"] as? Int ?? 0
        )
    }

    var firestoreData: [String: Any] {
        var data: [String: Any] = ["streakCount": streakCount, "totalWords": totalWords]
        if let lastEntryDate { data["lastEntryDate"] = Timestamp(date: lastEntryDate) }
        return data
    }
}

extension UserProfile.DailyPrompt {

    init?(data: [String: Any]?, cipher: FieldCipher) {
        guard let data,
              let text = try? cipher.openedIfPresent(data["text"], "users.dailyPrompt.text")
        else { return nil }
        self.init(
            text: text,
            date: timestamp(data["date"]) ?? Date(),
            sourceEntryIds: data["sourceEntryIds"] as? [String]
        )
    }

    func firestoreData(cipher: FieldCipher) throws -> [String: Any] {
        var data: [String: Any] = [
            "text": try cipher.sealed(text, "users.dailyPrompt.text"),
            "date": Timestamp(date: date),
        ]
        if let sourceEntryIds { data["sourceEntryIds"] = sourceEntryIds }
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
            vapiCallId: data["vapiCallId"] as? String
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
        self.init(journalId: journalId, snippet: snippet)
    }

    func firestoreData(cipher: FieldCipher, index: Int) throws -> [String: Any] {
        [
            "journalId": journalId,
            "snippet": try cipher.sealed(snippet, "messages.sources.\(index).snippet"),
        ]
    }
}
