import XCTest
@testable import LuminaLog

private enum TestVoiceError: Error { case unavailable }

private actor TestVoiceEngines: LocalVoiceEngineProviding {
    var shouldFail = false
    var prepared: [CallVoiceChoice] = []

    func prepare(status: @escaping @Sendable (String) -> Void) async throws -> LocalVoiceEngineSet {
        throw TestVoiceError.unavailable
    }

    func prepareVoice(_ choice: CallVoiceChoice) async throws {
        prepared.append(choice)
        if shouldFail { throw TestVoiceError.unavailable }
    }

    func unload() async {}
    func setFailure(_ value: Bool) { shouldFail = value }
}

@MainActor
final class CallVoicePreferenceTests: XCTestCase {
    private func defaults() -> UserDefaults {
        let suite = "CallVoicePreferenceTests.\(UUID().uuidString)"
        return UserDefaults(suiteName: suite)!
    }

    func testDefaultAndUnknownSavedVoiceUseHeart() {
        let store = defaults()
        XCTAssertEqual(CallVoiceChoice.saved(in: store), .heart)
        store.set("unexpected_voice", forKey: CallVoiceChoice.storageKey)
        XCTAssertEqual(CallVoiceChoice.saved(in: store), .heart)
    }

    func testReadyVoiceIsSavedAndReloaded() async {
        let store = defaults()
        let engines = TestVoiceEngines()
        let preference = CallVoicePreference(defaults: store, engines: engines)

        await preference.select(.bella)

        XCTAssertEqual(preference.selected, .bella)
        XCTAssertEqual(CallVoiceChoice.saved(in: store), .bella)
        let prepared = await engines.prepared
        XCTAssertEqual(prepared, [.bella])
        XCTAssertEqual(CallVoicePreference(defaults: store, engines: engines).selected, .bella)
    }

    func testFailedPreparationKeepsOldVoiceAndCanRetry() async {
        let store = defaults()
        let engines = TestVoiceEngines()
        let preference = CallVoicePreference(defaults: store, engines: engines)
        await engines.setFailure(true)

        await preference.select(.adam)
        XCTAssertEqual(preference.selected, .heart)
        XCTAssertEqual(CallVoiceChoice.saved(in: store), .heart)
        XCTAssertEqual(preference.failedChoice, .adam)
        XCTAssertNotNil(preference.errorMessage)

        await engines.setFailure(false)
        await preference.select(.adam)
        XCTAssertEqual(preference.selected, .adam)
        XCTAssertNil(preference.errorMessage)
    }

    func testSavedChoiceAndEffectiveVoiceStaySeparate() async {
        let store = defaults()
        let preference = CallVoicePreference(defaults: store, engines: TestVoiceEngines())
        preference.reportEffective(.heart)
        await preference.select(.device)

        XCTAssertEqual(preference.selected, .device)
        XCTAssertEqual(preference.effective, .heart)
        preference.reportEffective(.device, reason: "The phone is warm.")
        XCTAssertEqual(preference.effective, .device)
        XCTAssertEqual(preference.fallbackReason, "The phone is warm.")
        preference.clearCall()
        XCTAssertNil(preference.effective)
        XCTAssertEqual(preference.selected, .device)
    }
}
