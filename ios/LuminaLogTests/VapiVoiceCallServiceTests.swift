import CryptoKit
import XCTest
@testable import LuminaLog

/// Regression guard for the iOS↔server Vapi contract (ADR-0077). The server injects the
/// per-call system prompt via `assistantOverrides.variableValues.systemPrompt` and sends
/// NO `model` override — so the decode struct must tolerate a missing `model` and
/// `buildOverrides` must forward `variableValues` WITHOUT emitting a `model` object
/// (a bare `model` makes Vapi reject the call for a missing provider), or every voice
/// call breaks.
final class VapiVoiceCallServiceTests: XCTestCase {

    /// Exact shape the server's `callConfigHandler` returns today.
    private let serverJSON = """
    {
      "publicKey": "pk_test",
      "assistantId": "asst_1",
      "assistantOverrides": {
        "metadata": { "chatId": "chat-1" },
        "artifactPlan": { "recordingEnabled": true },
        "server": { "url": "https://api.example.com/v1/vapi/webhook", "secret": "s" },
        "serverMessages": ["end-of-call-report"],
        "variableValues": { "systemPrompt": "PERSONALIZED PROMPT" },
        "voice": { "provider": "vapi", "voiceId": "Elliot" },
        "transcriber": { "provider": "deepgram", "model": "nova-2" }
      }
    }
    """.data(using: .utf8)!

    func testDecodesServerShapeWithoutModelAndKeepsVariableValues() throws {
        let config = try JSONDecoder().decode(VapiVoiceCallService.CallConfigResponse.self, from: serverJSON)
        XCTAssertNil(config.assistantOverrides.model)
        XCTAssertEqual(config.assistantOverrides.variableValues?["systemPrompt"], "PERSONALIZED PROMPT")
    }

    func testBuildOverridesForwardsVariableValuesAndOmitsModel() throws {
        let config = try JSONDecoder().decode(VapiVoiceCallService.CallConfigResponse.self, from: serverJSON)
        let overrides = VapiVoiceCallService.buildOverrides(config)

        let vars = overrides["variableValues"] as? [String: String]
        XCTAssertEqual(vars?["systemPrompt"], "PERSONALIZED PROMPT")
        // Critically: NO `model` key when the server didn't send one — a bare `model`
        // object triggers Vapi's `model.provider must be one of…` 400.
        XCTAssertNil(overrides["model"])

        let transcriber = overrides["transcriber"] as? [String: Any]
        XCTAssertEqual(transcriber?["provider"] as? String, "deepgram")

        let metadata = overrides["metadata"] as? [String: String]
        XCTAssertEqual(metadata?["chatId"], "chat-1")
    }

    /// The legacy custom-llm shape (server sends a full `model`) must still forward.
    func testBuildOverridesForwardsLegacyModelWhenPresent() throws {
        let legacyJSON = """
        {
          "publicKey": "pk_test",
          "assistantId": "asst_1",
          "assistantOverrides": {
            "model": { "provider": "custom-llm", "url": "https://x/llm", "model": "m",
                       "messages": [ { "role": "system", "content": "P" } ] }
          }
        }
        """.data(using: .utf8)!
        let config = try JSONDecoder().decode(VapiVoiceCallService.CallConfigResponse.self, from: legacyJSON)
        let overrides = VapiVoiceCallService.buildOverrides(config)
        let model = overrides["model"] as? [String: Any]
        XCTAssertEqual(model?["provider"] as? String, "custom-llm")
        let messages = model?["messages"] as? [[String: String]]
        XCTAssertEqual(messages?.first?["content"], "P")
    }

    // MARK: - Custom-LLM proxy (2026-07-15 spec)

    /// The new proxy shape the server returns when a `dek` was sent:
    /// `model = { provider:"custom-llm", url:.../llm/<token>/..., model:"custom" }`
    /// (no `messages`). `buildOverrides` MUST forward `provider`, `url`, AND `model`
    /// — if `url` is dropped, Vapi never dials our proxy and the whole feature breaks.
    func testBuildOverridesForwardsCustomLLMModelWithURL() throws {
        let json = """
        {
          "publicKey": "pk_test",
          "assistantId": "asst_1",
          "assistantOverrides": {
            "model": { "provider": "custom-llm",
                       "url": "https://api.example.com/v1/vapi/llm/tok_abc/chat/completions",
                       "model": "custom" }
          }
        }
        """.data(using: .utf8)!
        let config = try JSONDecoder().decode(VapiVoiceCallService.CallConfigResponse.self, from: json)
        let overrides = VapiVoiceCallService.buildOverrides(config)
        let model = overrides["model"] as? [String: Any]
        XCTAssertEqual(model?["provider"] as? String, "custom-llm")
        XCTAssertEqual(model?["url"] as? String, "https://api.example.com/v1/vapi/llm/tok_abc/chat/completions")
        XCTAssertEqual(model?["model"] as? String, "custom")
        XCTAssertNil(model?["messages"])
    }

    // MARK: - Call-end classification (surface Vapi error-ends, ADR-0092)

    /// A real two-way conversation is a normal end → `.ended`.
    func testEndEventIsEndedWhenAssistantSpokeAndUserWasHeard() {
        let event = VapiVoiceCallService.endEvent(assistantDidSpeak: true, userWasHeard: true)
        guard case .ended = event else {
            return XCTFail("expected .ended for a normal two-way call, got \(event)")
        }
    }

    /// A call that ended WITHOUT the assistant ever speaking errored (e.g. the
    /// custom-LLM turn failed and Vapi dropped the call) → `.failed`, so the user
    /// sees "Call failed" instead of the benign "Call ended / View transcript" screen.
    func testEndEventIsFailedWhenAssistantNeverSpoke() {
        let event = VapiVoiceCallService.endEvent(assistantDidSpeak: false, userWasHeard: false)
        guard case .failed = event else {
            return XCTFail("expected .failed when the assistant never spoke, got \(event)")
        }
    }

    /// The assistant greeted but Vapi never transcribed a word from the user: the
    /// companion could not hear them (`…did-not-receive-customer-audio`). This used
    /// to score as a NORMAL end, so the failure was invisible. ADR-0110.
    func testEndEventIsFailedWhenUserWasNeverHeard() {
        let event = VapiVoiceCallService.endEvent(assistantDidSpeak: true, userWasHeard: false)
        guard case .failed(let message) = event else {
            return XCTFail("expected .failed when the user was never heard, got \(event)")
        }
        // The message must point at the mic, not a generic connection error.
        XCTAssertTrue(
            message.lowercased().contains("hear you") && message.lowercased().contains("microphone"),
            "expected a mic-specific message, got: \(message)"
        )
    }

    // MARK: - DEK encoding (Model-1 / ZK path)

    func testEncodedDEKIsBase64OfRawKeyOnModel1Path() throws {
        let raw = Data((0..<32).map { UInt8($0) })
        let key = SymmetricKey(data: raw)
        let dek = try XCTUnwrap(VapiVoiceCallService.encodedDEK(aiModel1: true, key: key))
        XCTAssertEqual(dek, raw.base64EncodedString())
        // Round-trips back to the exact 32 raw bytes the server will use as the key.
        XCTAssertEqual(Data(base64Encoded: dek), raw)
    }

    func testEncodedDEKIsNilWhenAiModel1Off() {
        let key = SymmetricKey(data: Data(repeating: 7, count: 32))
        XCTAssertNil(VapiVoiceCallService.encodedDEK(aiModel1: false, key: key))
    }

    func testEncodedDEKIsNilWhenNoKeyLoaded() {
        XCTAssertNil(VapiVoiceCallService.encodedDEK(aiModel1: true, key: nil))
    }

    // MARK: - CallConfigRequest `dek` encoding (omit-when-nil contract)

    func testCallConfigRequestOmitsDEKWhenNil() throws {
        let request = VapiVoiceCallService.CallConfigRequest(chatId: "chat-1", journalId: nil)
        let data = try JSONEncoder().encode(request)
        let json = try XCTUnwrap(String(data: data, encoding: .utf8))
        XCTAssertFalse(json.contains("\"dek\""), "nil dek must be omitted from the JSON, not encoded as null")
    }

    func testCallConfigRequestEncodesDEKWhenSet() throws {
        var request = VapiVoiceCallService.CallConfigRequest(chatId: "chat-1", journalId: nil)
        request.dek = "QUJDRA=="
        let data = try JSONEncoder().encode(request)
        let object = try XCTUnwrap(
            try JSONSerialization.jsonObject(with: data) as? [String: Any]
        )
        XCTAssertEqual(object["dek"] as? String, "QUJDRA==")
    }
}

// MARK: - Microphone permission gate (ADR-0110)

private final class MicGateTokenProvider: TokenProvider {
    func idToken(forceRefresh: Bool) async throws -> String { "test-token" }
}

/// Fails the test if any request escapes — the permission gate must short-circuit
/// BEFORE the service does any network work.
private final class NoRequestURLProtocol: URLProtocol {
    nonisolated(unsafe) static var sawRequest = false
    override class func canInit(with request: URLRequest) -> Bool { sawRequest = true; return true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() { client?.urlProtocol(self, didFailWithError: URLError(.notConnectedToInternet)) }
    override func stopLoading() {}
}

final class VapiVoiceCallMicPermissionTests: XCTestCase {

    @MainActor
    private func makeService(micGranted: Bool) -> VapiVoiceCallService {
        let cfg = URLSessionConfiguration.ephemeral
        cfg.protocolClasses = [NoRequestURLProtocol.self]
        let api = ProxyAPIClient(
            baseURL: URL(string: "https://api.example.com")!,
            tokenProvider: MicGateTokenProvider(),
            session: URLSession(configuration: cfg)
        )
        return VapiVoiceCallService(
            api: api,
            ai: MockAIService(generationDelay: 0, wordDelay: 0),
            currentDEK: { nil },
            requestMicPermission: { micGranted }
        )
    }

    /// Without mic access the call would connect, the assistant would greet, and Vapi
    /// would end it as `…did-not-receive-customer-audio` — a companion that cannot
    /// hear you. Refuse up front with an actionable error instead.
    @MainActor
    func testStartCallThrowsWhenMicPermissionDenied() async {
        NoRequestURLProtocol.sawRequest = false
        let service = makeService(micGranted: false)
        do {
            try await service.startCall(chatId: "chat-1", journalId: nil, journalTitle: nil)
            XCTFail("expected startCall to throw when mic permission is denied")
        } catch let error as VoiceCallError {
            guard case .microphonePermissionDenied = error else {
                return XCTFail("expected .microphonePermissionDenied, got \(error)")
            }
            XCTAssertTrue(
                (error.errorDescription ?? "").contains("Settings"),
                "the message must tell the user where to fix it"
            )
        } catch {
            XCTFail("expected VoiceCallError, got \(error)")
        }
        // The gate must run before any call-config request is issued.
        XCTAssertFalse(NoRequestURLProtocol.sawRequest, "no network work should happen without mic access")
    }

    /// The denial must also reach the UI via the event stream, not just the throw.
    @MainActor
    func testDeniedPermissionEmitsFailedEvent() async {
        let service = makeService(micGranted: false)
        // Subscribe BEFORE starting so the event is buffered for us, then read the
        // stream directly. (A collector Task would race: it may not be scheduled
        // before the assertion runs.)
        var iterator = service.events.makeAsyncIterator()
        try? await service.startCall(chatId: "chat-1", journalId: nil, journalTitle: nil)

        // The FIRST event must be the failure — proving `.connecting` was never
        // announced, because the call never got that far.
        guard let first = await iterator.next() else {
            return XCTFail("expected a .failed event, got none")
        }
        guard case .failed(let message) = first else {
            return XCTFail("expected .failed first (never .connecting), got \(first)")
        }
        XCTAssertTrue(message.lowercased().contains("microphone"))
    }
}
