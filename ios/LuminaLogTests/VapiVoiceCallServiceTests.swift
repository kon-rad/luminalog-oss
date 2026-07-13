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
}
