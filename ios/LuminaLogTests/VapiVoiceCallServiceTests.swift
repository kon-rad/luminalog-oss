import XCTest
@testable import LuminaLog

/// Regression guard for the iOS↔server Vapi contract (ADR-0077). The server
/// overrides ONLY `assistantOverrides.model.messages` (the per-call system prompt)
/// and omits provider/url/model — so the decode struct must tolerate that shape and
/// `buildOverrides` must forward the messages, or every voice call breaks.
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
        "model": { "messages": [ { "role": "system", "content": "PERSONALIZED PROMPT" } ] },
        "voice": { "provider": "vapi", "voiceId": "Elliot" },
        "transcriber": { "provider": "deepgram", "model": "nova-2" }
      }
    }
    """.data(using: .utf8)!

    func testDecodesServerShapeWithoutProviderAndKeepsMessages() throws {
        let config = try JSONDecoder().decode(VapiVoiceCallService.CallConfigResponse.self, from: serverJSON)
        XCTAssertNil(config.assistantOverrides.model.provider)
        XCTAssertEqual(config.assistantOverrides.model.messages?.first?.role, "system")
        XCTAssertEqual(config.assistantOverrides.model.messages?.first?.content, "PERSONALIZED PROMPT")
    }

    func testBuildOverridesForwardsSystemPromptAndTranscriber() throws {
        let config = try JSONDecoder().decode(VapiVoiceCallService.CallConfigResponse.self, from: serverJSON)
        let overrides = VapiVoiceCallService.buildOverrides(config)

        let model = overrides["model"] as? [String: Any]
        let messages = model?["messages"] as? [[String: String]]
        XCTAssertEqual(messages?.first?["role"], "system")
        XCTAssertEqual(messages?.first?["content"], "PERSONALIZED PROMPT")
        // No stale custom-llm keys leak when the server didn't send them.
        XCTAssertNil(model?["provider"])

        let transcriber = overrides["transcriber"] as? [String: Any]
        XCTAssertEqual(transcriber?["provider"] as? String, "deepgram")

        let metadata = overrides["metadata"] as? [String: String]
        XCTAssertEqual(metadata?["chatId"], "chat-1")
    }
}
