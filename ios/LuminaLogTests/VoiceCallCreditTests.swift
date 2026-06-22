import XCTest
@testable import LuminaLog

@MainActor
final class VoiceCallCreditTests: XCTestCase {

    // Credit metering is gated behind !DevFlags.devMode. The test runner
    // inherits the app's registered default (devMode = true), so we flip it
    // off for the duration of each test and restore it in tearDown.
    override func setUp() async throws {
        try await super.setUp()
        UserDefaults.standard.set(false, forKey: DevFlags.devModeKey)
    }

    override func tearDown() async throws {
        UserDefaults.standard.removeObject(forKey: DevFlags.devModeKey)
        try await super.tearDown()
    }

    /// A `VoiceCallService` whose events are driven on demand from the test.
    private final class StreamVoiceService: VoiceCallService {
        private let broadcaster = VoiceCallEventBroadcaster()
        private(set) var endCalls = 0
        var events: AsyncStream<VoiceCallEvent> { broadcaster.makeStream() }
        func startCall(chatId: String, journalId: String?, journalTitle: String?) async throws {}
        func endCall() async { endCalls += 1; broadcaster.send(.ended(reason: nil)) }
        func setMuted(_ muted: Bool) {}
        func emit(_ event: VoiceCallEvent) { broadcaster.send(event) }
    }

    private func waitUntil(timeout: TimeInterval = 2, _ condition: () -> Bool) async {
        let deadline = Date().addingTimeInterval(timeout)
        while !condition() && Date() < deadline {
            try? await Task.sleep(nanoseconds: 10_000_000)
        }
    }

    private func waitBalance(_ credits: MockCreditService, equals target: Int, timeout: TimeInterval = 2) async -> Int {
        let deadline = Date().addingTimeInterval(timeout)
        var bal = await credits.currentBalance()
        while bal != target && Date() < deadline {
            try? await Task.sleep(nanoseconds: 10_000_000)
            bal = await credits.currentBalance()
        }
        return bal
    }

    private func makeStarted(balance: Int) async -> (VoiceCallViewModel, StreamVoiceService, MockCreditService) {
        let credits = MockCreditService(balance: balance)
        let voice = StreamVoiceService()
        let vm = VoiceCallViewModel(voice: voice, chats: MockChatRepository(), credits: credits)
        await vm.start()
        voice.emit(.connected)
        await waitUntil { vm.phase == .active }
        return (vm, voice, credits)
    }

    // 1 credit = 6 minutes -> 400s rounds up to ceil(400/360) = 2 credits.
    func testDeductionUsesSixMinutesPerCredit() async {
        let (vm, voice, credits) = await makeStarted(balance: 10)
        vm.setElapsedForTesting(400)
        voice.emit(.ended(reason: nil))
        let bal = await waitBalance(credits, equals: 8)
        XCTAssertEqual(bal, 8, "400s call costs 2 credits at 6 min/credit")
    }

    // A short connected call still costs the 1-credit minimum.
    func testShortCallCostsOneCredit() async {
        let (vm, voice, credits) = await makeStarted(balance: 10)
        vm.setElapsedForTesting(30)
        voice.emit(.ended(reason: nil))
        let bal = await waitBalance(credits, equals: 9)
        XCTAssertEqual(bal, 9)
    }

    func testLowCreditWarningRaisedNearBudgetEnd() async {
        let (vm, _, _) = await makeStarted(balance: 1)   // 360s budget
        vm.primeBudgetForTesting(360)
        vm.setElapsedForTesting(310)                      // 50s remaining
        vm.checkBudgetForTesting()
        XCTAssertTrue(vm.lowCreditWarning)
    }

    func testAutoEndsWhenBudgetExhausted() async {
        let (vm, voice, _) = await makeStarted(balance: 1)
        vm.primeBudgetForTesting(360)
        vm.setElapsedForTesting(360)
        vm.checkBudgetForTesting()
        await waitUntil { voice.endCalls >= 1 }
        XCTAssertGreaterThanOrEqual(voice.endCalls, 1)
        XCTAssertTrue(vm.outOfCredits)
    }
}
