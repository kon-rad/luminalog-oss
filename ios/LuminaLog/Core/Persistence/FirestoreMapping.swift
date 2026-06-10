import Foundation
import FirebaseFirestore

// Explicit Firestore document ↔ pure-model mapping (spec §3).
// All Firebase types stay inside Core/Persistence; the models remain pure.

// MARK: - Date helpers

private func timestamp(_ value: Any?) -> Date? {
    (value as? Timestamp)?.dateValue()
}

// MARK: - JournalEntry

extension JournalEntry {

    init?(documentId: String, data: [String: Any]) {
        guard
            let userId = data["userId"] as? String,
            let typeRaw = data["type"] as? String,
            let type = JournalType(rawValue: typeRaw)
        else { return nil }

        let media = (data["media"] as? [[String: Any]] ?? []).compactMap(MediaItem.init(data:))

        self.init(
            id: documentId,
            userId: userId,
            type: type,
            title: data["title"] as? String ?? "",
            createdAt: timestamp(data["createdAt"]) ?? Date(),
            updatedAt: timestamp(data["updatedAt"]) ?? Date(),
            content: data["content"] as? String ?? "",
            contentEditedAt: timestamp(data["contentEditedAt"]),
            media: media,
            transcriptStatus: (data["transcriptStatus"] as? String).flatMap(TranscriptStatus.init(rawValue:)),
            summary: AIGeneration(data: data["summary"] as? [String: Any]),
            insights: AIGeneration(data: data["insights"] as? [String: Any]),
            prompts: AIPrompts(data: data["prompts"] as? [String: Any]),
            vector: VectorState(data: data["vector"] as? [String: Any]) ?? VectorState(),
            wordCount: data["wordCount"] as? Int ?? 0
        )
    }

    var firestoreData: [String: Any] {
        var data: [String: Any] = [
            "userId": userId,
            "type": type.rawValue,
            "title": title,
            "createdAt": Timestamp(date: createdAt),
            "updatedAt": Timestamp(date: updatedAt),
            "content": content,
            "media": media.map(\.firestoreData),
            "vector": vector.firestoreData,
            "wordCount": wordCount,
        ]
        if let contentEditedAt { data["contentEditedAt"] = Timestamp(date: contentEditedAt) }
        if let transcriptStatus { data["transcriptStatus"] = transcriptStatus.rawValue }
        if let summary { data["summary"] = summary.firestoreData }
        if let insights { data["insights"] = insights.firestoreData }
        if let prompts { data["prompts"] = prompts.firestoreData }
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

    init?(data: [String: Any]?) {
        guard let data, let text = data["text"] as? String else { return nil }
        self.init(
            text: text,
            generatedAt: timestamp(data["generatedAt"]) ?? Date(),
            model: data["model"] as? String ?? ""
        )
    }

    var firestoreData: [String: Any] {
        ["text": text, "generatedAt": Timestamp(date: generatedAt), "model": model]
    }
}

extension AIPrompts {

    init?(data: [String: Any]?) {
        guard let data, let items = data["items"] as? [String] else { return nil }
        self.init(
            items: items,
            generatedAt: timestamp(data["generatedAt"]) ?? Date(),
            model: data["model"] as? String ?? ""
        )
    }

    var firestoreData: [String: Any] {
        ["items": items, "generatedAt": Timestamp(date: generatedAt), "model": model]
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

    init(documentId: String, data: [String: Any]) {
        self.init(
            id: documentId,
            displayName: data["displayName"] as? String ?? "",
            email: data["email"] as? String ?? "",
            photoURL: (data["photoURL"] as? String).flatMap(URL.init(string:)),
            biography: data["biography"] as? String ?? "",
            createdAt: timestamp(data["createdAt"]) ?? Date(),
            timezone: data["timezone"] as? String ?? TimeZone.current.identifier,
            stats: Stats(data: data["stats"] as? [String: Any] ?? [:]),
            dailyPrompt: DailyPrompt(data: data["dailyPrompt"] as? [String: Any])
        )
    }

    var firestoreData: [String: Any] {
        var data: [String: Any] = [
            "displayName": displayName,
            "email": email,
            "biography": biography,
            "createdAt": Timestamp(date: createdAt),
            "timezone": timezone,
            "stats": stats.firestoreData,
        ]
        if let photoURL { data["photoURL"] = photoURL.absoluteString }
        if let dailyPrompt { data["dailyPrompt"] = dailyPrompt.firestoreData }
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

    init?(data: [String: Any]?) {
        guard let data, let text = data["text"] as? String else { return nil }
        self.init(text: text, date: timestamp(data["date"]) ?? Date())
    }

    var firestoreData: [String: Any] {
        ["text": text, "date": Timestamp(date: date)]
    }
}

// MARK: - Chat

extension Chat {

    init?(documentId: String, data: [String: Any]) {
        guard
            let userId = data["userId"] as? String,
            let kindRaw = data["kind"] as? String,
            let kind = ChatKind(rawValue: kindRaw)
        else { return nil }
        self.init(
            id: documentId,
            userId: userId,
            kind: kind,
            title: data["title"] as? String ?? "",
            createdAt: timestamp(data["createdAt"]) ?? Date(),
            lastMessageAt: timestamp(data["lastMessageAt"]) ?? Date(),
            vapiCallId: data["vapiCallId"] as? String
        )
    }

    var firestoreData: [String: Any] {
        var data: [String: Any] = [
            "userId": userId,
            "kind": kind.rawValue,
            "title": title,
            "createdAt": Timestamp(date: createdAt),
            "lastMessageAt": Timestamp(date: lastMessageAt),
        ]
        if let vapiCallId { data["vapiCallId"] = vapiCallId }
        return data
    }
}

extension ChatMessage {

    init?(documentId: String, data: [String: Any]) {
        guard
            let roleRaw = data["role"] as? String,
            let role = MessageRole(rawValue: roleRaw),
            let text = data["text"] as? String
        else { return nil }
        self.init(
            id: documentId,
            role: role,
            text: text,
            createdAt: timestamp(data["createdAt"]) ?? Date()
        )
    }

    var firestoreData: [String: Any] {
        [
            "role": role.rawValue,
            "text": text,
            "createdAt": Timestamp(date: createdAt),
        ]
    }
}
