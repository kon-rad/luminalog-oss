import Foundation

// MARK: - InfoRequestSender

struct InfoRequestSender: Codable, Equatable, Sendable {
    let address: String
    let ens: String?
    let name: String
    let description: String

    /// Returns the ENS name if present and non-empty, otherwise a short
    /// address fingerprint (e.g. "0x1234...5678").
    var verifiedIdentity: String {
        if let ens, !ens.isEmpty { return ens }
        return "\(address.prefix(6))...\(address.suffix(4))"
    }
}

// MARK: - InfoRequest

struct InfoRequest: Codable, Equatable, Identifiable, Sendable {
    let id: String
    let sender: InfoRequestSender
    let reason: String
    let questions: [String]
    let webhookHost: String
    let createdAt: Date
    let expiresAt: Date
}

// MARK: - InboxListResponse

struct InboxListResponse: Decodable {
    let requests: [InfoRequest]
}

// MARK: - InfoAnswerPayload

struct InfoAnswerPayload: Encodable, Equatable {
    let index: Int
    /// When nil, the answer is omitted from the encoded JSON (declined).
    let answer: String?

    enum CodingKeys: String, CodingKey {
        case index
        case answer
    }

    func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(index, forKey: .index)
        try container.encodeIfPresent(answer, forKey: .answer)
    }

    init(index: Int, answer: String?) {
        self.index = index
        self.answer = answer
    }
}

// MARK: - RespondRequestBody

struct RespondRequestBody: Encodable {
    let answers: [InfoAnswerPayload]
}

// MARK: - RespondResult

struct RespondResult: Decodable, Equatable {
    let delivered: Bool
    let deliveredAt: Date
}

// MARK: - UsernameCheck

struct UsernameCheck: Decodable, Equatable {
    let username: String
    let available: Bool
    let reason: String?
}

// MARK: - UsernameUpdate

struct UsernameUpdate: Decodable, Equatable {
    let username: String
    let usernameChangedAt: Date
    let nextChangeAt: Date
}

// MARK: - SetUsernameBody

struct SetUsernameBody: Encodable {
    let username: String
}

// MARK: - UsernameError

enum UsernameError: LocalizedError, Equatable {
    case invalid
    case reserved
    case taken
    case tooSoon(nextChangeAt: Date?)
    case unknown

    var errorDescription: String? {
        switch self {
        case .invalid:
            return "That username contains invalid characters."
        case .reserved:
            return "That username is reserved."
        case .taken:
            return "That username is already taken."
        case .tooSoon(let nextChangeAt):
            if let date = nextChangeAt {
                return "You can change your username again after \(date.formatted())."
            }
            return "You changed your username too recently."
        case .unknown:
            return "An unknown error occurred."
        }
    }

    static func from(_ error: Error) -> UsernameError {
        guard let httpError = error as? ProxyAPIError,
              case .httpError(_, let body) = httpError,
              let data = body.data(using: .utf8),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let errorStr = json["error"] as? String
        else {
            return .unknown
        }

        switch errorStr {
        case "invalid": return .invalid
        case "reserved": return .reserved
        case "taken": return .taken
        case "too_soon":
            let nextChangeAt = (json["nextChangeAt"] as? String)
                .flatMap { ISO8601DateFormatter().date(from: $0) }
            return .tooSoon(nextChangeAt: nextChangeAt)
        default:
            return .unknown
        }
    }
}

// MARK: - EmptyBody

/// Empty body used for requests that send no payload (e.g. ignore).
private struct EmptyBody: Encodable {}