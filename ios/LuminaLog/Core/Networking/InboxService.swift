import Foundation

// MARK: - Protocol

protocol InboxService: AnyObject {
    func pending() async throws -> [InfoRequest]
    func ignore(id: String) async throws
    func respond(id: String, answers: [InfoAnswerPayload]) async throws -> RespondResult
    func checkUsername(_ username: String) async throws -> UsernameCheck
    func setUsername(_ username: String) async throws -> UsernameUpdate
}

// MARK: - ProxyInboxService

final class ProxyInboxService: InboxService {

    private let api: ProxyAPIClient

    init(api: ProxyAPIClient) {
        self.api = api
    }

    func pending() async throws -> [InfoRequest] {
        let response: InboxListResponse = try await api.get(path: "/v1/inbox")
        return response.requests
    }

    func ignore(id: String) async throws {
        let escaped = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
        try await api.post(path: "/v1/inbox/\(escaped)/ignore", body: IgnoreBody())
    }

    func respond(id: String, answers: [InfoAnswerPayload]) async throws -> RespondResult {
        let escaped = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
        let body = RespondRequestBody(answers: answers)
        return try await api.post(path: "/v1/inbox/\(escaped)/respond", body: body)
    }

    func checkUsername(_ username: String) async throws -> UsernameCheck {
        let escaped = username.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? username
        return try await api.get(path: "/v1/profile/username/check?u=\(escaped)")
    }

    func setUsername(_ username: String) async throws -> UsernameUpdate {
        let body = SetUsernameBody(username: username)
        return try await api.put(path: "/v1/profile/username", body: body)
    }
}

// MARK: - MockInboxService

final class MockInboxService: InboxService {

    var requests: [InfoRequest] = []
    var respondError: Error?
    var respondedAnswers: [String: [InfoAnswerPayload]] = [:]
    var ignoredIds: [String] = []
    var checkResult: UsernameCheck = UsernameCheck(username: "", available: false, reason: nil)
    var setResult: Result<UsernameUpdate, Error> = .failure(UsernameError.unknown)
    var checkedNames: [String] = []

    func pending() async throws -> [InfoRequest] {
        requests
    }

    func ignore(id: String) async throws {
        ignoredIds.append(id)
    }

    func respond(id: String, answers: [InfoAnswerPayload]) async throws -> RespondResult {
        if let error = respondError { throw error }
        respondedAnswers[id] = answers
        return RespondResult(delivered: true, deliveredAt: Date())
    }

    func checkUsername(_ username: String) async throws -> UsernameCheck {
        checkedNames.append(username)
        return checkResult
    }

    func setUsername(_ username: String) async throws -> UsernameUpdate {
        checkedNames.append(username)
        return try setResult.get()
    }
}

// MARK: - IgnoreBody

/// Empty body used for requests that send no payload (e.g. ignore).
private struct IgnoreBody: Encodable {}