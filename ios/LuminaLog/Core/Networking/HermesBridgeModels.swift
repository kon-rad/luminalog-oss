import Foundation

/// Wire models for the `hermes-bridge` gateway API (see `hermes-bridge/README.md`
/// in the vault repo). Field names mirror the gateway's JSON exactly.

struct HermesTaskSummary: Codable, Identifiable {
    let id: String
    let title: String
    let status: String
    let priority: Int
    let completedAt: Int?

    enum CodingKeys: String, CodingKey {
        case id, title, status, priority
        case completedAt = "completed_at"
    }
}

struct HermesCommitSummary: Codable, Identifiable {
    var id: String { hash }
    let hash: String
    let shortHash: String
    let author: String
    let date: String
    let subject: String
}

struct HermesFileEntry: Codable, Identifiable {
    var id: String { name }
    let name: String
    let type: String
}

struct HermesFileResult: Codable {
    let type: String // "file" | "directory"
    let path: String
    let content: String?
    let entries: [HermesFileEntry]?
}

/// A message received over the `/v1/hermes/stream` WebSocket.
enum HermesStreamEvent: Decodable, Equatable {
    case stdout(String)
    case stderr(String)
    case status(String)
    case exit(Int?)

    private enum CodingKeys: String, CodingKey { case type, data, state, code }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        switch try container.decode(String.self, forKey: .type) {
        case "stdout":
            self = .stdout(try container.decode(String.self, forKey: .data))
        case "stderr":
            self = .stderr(try container.decode(String.self, forKey: .data))
        case "status":
            self = .status(try container.decode(String.self, forKey: .state))
        case "exit":
            self = .exit(try container.decodeIfPresent(Int.self, forKey: .code))
        default:
            throw DecodingError.dataCorruptedError(
                forKey: .type, in: container, debugDescription: "Unknown stream event type"
            )
        }
    }
}

/// A message sent over the `/v1/hermes/stream` WebSocket.
enum HermesStreamControl: Encodable {
    case start
    case stop
    case stdin(String)

    private enum CodingKeys: String, CodingKey { case type, data }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .start:
            try container.encode("start", forKey: .type)
        case .stop:
            try container.encode("stop", forKey: .type)
        case .stdin(let data):
            try container.encode("stdin", forKey: .type)
            try container.encode(data, forKey: .data)
        }
    }
}
