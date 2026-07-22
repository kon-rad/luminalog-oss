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

    /// A call that ended after the assistant spoke is a normal end → `.ended`.
    func testEndEventIsEndedWhenAssistantSpoke() {
        let event = VapiVoiceCallService.endEvent(assistantDidSpeak: true)
        guard case .ended = event else {
            return XCTFail("expected .ended when the assistant spoke, got \(event)")
        }
    }

    /// A call that ended WITHOUT the assistant ever speaking errored (e.g. the
    /// custom-LLM turn failed and Vapi dropped the call) → `.failed`, so the user
    /// sees "Call failed" instead of the benign "Call ended / View transcript" screen.
    func testEndEventIsFailedWhenAssistantNeverSpoke() {
        let event = VapiVoiceCallService.endEvent(assistantDidSpeak: false)
        guard case .failed = event else {
            return XCTFail("expected .failed when the assistant never spoke, got \(event)")
        }
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
