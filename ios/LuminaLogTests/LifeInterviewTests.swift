import XCTest
@testable import LuminaLog

@MainActor
final class LifeInterviewTests: XCTestCase {

    // MARK: - Fixtures

    private static let sectionA = LifeInterviewSection(
        key: "A", title: "Life chapters", minutes: 20, sensitive: false,
        opening: "Imagine your life is a book.",
        items: [LifeInterviewItem(key: "A1", title: "The chapters", question: "What are the chapters?")]
    )

    private static let sectionB = LifeInterviewSection(
        key: "B", title: "Key scenes", minutes: 20, sensitive: true,
        opening: "Now a few scenes.",
        items: [
            LifeInterviewItem(key: "B1", title: "High point", question: "A high point?"),
            LifeInterviewItem(key: "B2", title: "Turning point", question: "A turning point?"),
            LifeInterviewItem(key: "B3", title: "Early memory", question: "An early memory?"),
        ]
    )

    private static let script = LifeInterviewScript(version: "test", sections: [sectionA, sectionB])

    private func sitting(
        _ interviewId: String?, section: String? = nil, item: String? = nil, done: Bool? = nil, at seconds: TimeInterval
    ) -> Chat {
        Chat(
            userId: "u", kind: .voice, title: "t",
            createdAt: Date(timeIntervalSince1970: seconds),
            lastMessageAt: Date(timeIntervalSince1970: seconds + 60),
            interviewId: interviewId, interviewSection: section, interviewItem: item, interviewSectionDone: done
        )
    }

    private func waitUntil(timeout: TimeInterval = 2, _ condition: () -> Bool) async {
        let deadline = Date().addingTimeInterval(timeout)
        while !condition() && Date() < deadline {
            try? await Task.sleep(nanoseconds: 10_000_000)
        }
    }

    // MARK: - Script

    func testScriptDecodesFromTheServerShape() throws {
        let json = """
        {"version":"2026-11-18","sections":[{"key":"A","title":"Life chapters","minutes":20,"sensitive":false,
        "opening":"Imagine.","items":[{"key":"A1","title":"The chapters","question":"What are they?"}]}]}
        """
        let script = try JSONDecoder().decode(LifeInterviewScript.self, from: Data(json.utf8))
        XCTAssertEqual(script.sections.first?.items.first?.key, "A1")
        XCTAssertEqual(script.totalMinutes, 20)
        XCTAssertEqual(script.section("A")?.title, "Life chapters")
        XCTAssertNil(script.section("Z"))
    }

    // MARK: - Grouping

    func testChatsGroupIntoInterviewsNewestFirstAndNumberedByStart() {
        let chats = [
            sitting("second", section: "A", at: 2_000),
            sitting(nil, at: 1_500),
            sitting("first", section: "B", at: 1_200),
            sitting("first", section: "A", at: 1_000),
        ]
        let interviews = LifeInterviewGrouping.interviews(from: chats)

        XCTAssertEqual(interviews.map(\.id), ["second", "first"])
        XCTAssertEqual(interviews.map(\.number), [2, 1])
        XCTAssertEqual(interviews[1].sittings.map(\.interviewSection), ["A", "B"])
        XCTAssertEqual(interviews[1].startedAt, Date(timeIntervalSince1970: 1_000))
    }

    func testOrdinaryChatsAreNotInterviews() {
        XCTAssertTrue(LifeInterviewGrouping.interviews(from: [sitting(nil, at: 1), sitting("", at: 2)]).isEmpty)
    }

    // MARK: - Progress

    func testSectionProgressFollowsItsSittings() {
        let interview = LifeInterview(id: "i", number: 1, sittings: [
            sitting("i", section: "A", item: "A1", done: true, at: 1_000),
            sitting("i", section: "B", item: "B1", at: 2_000),
            sitting("i", section: "B", item: "B2", at: 3_000),
        ])

        XCTAssertEqual(interview.progress(for: "A"), .done)
        XCTAssertEqual(interview.progress(for: "B"), .inProgress(item: "B2"))
        XCTAssertEqual(interview.progress(for: "C"), .notStarted)
        XCTAssertEqual(interview.completedSections(in: Self.script), 1)
        XCTAssertFalse(interview.isComplete(in: Self.script))
        XCTAssertEqual(interview.nextSection(in: Self.script)?.key, "B")
    }

    func testASectionStaysDoneWhenItIsTakenAgain() {
        let interview = LifeInterview(id: "i", number: 1, sittings: [
            sitting("i", section: "A", item: "A1", done: true, at: 1_000),
            sitting("i", section: "A", item: "A1", at: 2_000),
        ])
        XCTAssertEqual(interview.progress(for: "A"), .done)
    }

    func testInterviewIsCompleteWhenEverySectionIsDone() {
        let interview = LifeInterview(id: "i", number: 1, sittings: [
            sitting("i", section: "A", done: true, at: 1_000),
            sitting("i", section: "B", done: true, at: 2_000),
        ])
        XCTAssertTrue(interview.isComplete(in: Self.script))
        XCTAssertNil(interview.nextSection(in: Self.script))
    }

    // MARK: - Sittings

    func testFreshSittingStartsOnTheFirstQuestionWithTheSectionOpening() {
        let sitting = LifeInterviewSitting(interviewId: "i", section: Self.sectionB)
        XCTAssertEqual(sitting.startItem, "B1")
        XCTAssertFalse(sitting.resumed)
        XCTAssertEqual(sitting.openingLine, "Now a few scenes.")
        XCTAssertEqual(sitting.chatTitle, "Life story: Key scenes")
    }

    func testResumedSittingPicksUpAtTheQuestionItStoppedOn() {
        let sitting = LifeInterviewSitting(interviewId: "i", section: Self.sectionB, resumeAt: "B3")
        XCTAssertEqual(sitting.startItem, "B3")
        XCTAssertTrue(sitting.resumed)
        XCTAssertEqual(sitting.openingLine, "Welcome back. Let's pick up where we left off. An early memory?")
    }

    func testResumingOnTheFirstOrAnUnknownQuestionIsAFreshStart() {
        XCTAssertFalse(LifeInterviewSitting(interviewId: "i", section: Self.sectionB, resumeAt: "B1").resumed)
        let unknown = LifeInterviewSitting(interviewId: "i", section: Self.sectionB, resumeAt: "Z9")
        XCTAssertFalse(unknown.resumed)
        XCTAssertEqual(unknown.startItem, "B1")
    }

    func testInterviewBuildsTheRightSittingForASection() {
        let interview = LifeInterview(id: "i", number: 1, sittings: [sitting("i", section: "B", item: "B2", at: 1_000)])
        XCTAssertEqual(interview.sitting(for: Self.sectionB).startItem, "B2")
        XCTAssertEqual(interview.sitting(for: Self.sectionA).startItem, "A1")
    }

    // MARK: - Turn request

    func testInterviewTurnSendsTheNameAndNothingFromTheJournal() throws {
        let context = VoiceCallContext(
            name: "Sam", bio: "BIO", profile: ["goals": "GOALS"], todayContext: "TODAY",
            ragContext: "RAG", focalEntry: "FOCAL", memoryContext: "MEMORY"
        )
        let request = VoiceTurnRequest(
            chatId: "c", message: "My first chapter", history: [], context: context,
            ragContext: "TURN-RAG", now: "2026-11-18 10:00 JST",
            interview: .init(section: "A", item: "A1", resumed: false)
        )
        let json = String(decoding: try JSONEncoder().encode(request), as: UTF8.self)

        XCTAssertTrue(json.contains("\"interview\":{"))
        XCTAssertTrue(json.contains("\"section\":\"A\""))
        XCTAssertTrue(json.contains("Sam"))
        for leaked in ["BIO", "GOALS", "TODAY", "RAG", "FOCAL", "MEMORY"] {
            XCTAssertFalse(json.contains(leaked), "\(leaked) must not be sent in an interview turn")
        }
    }

    func testOrdinaryTurnIsUnchanged() throws {
        let context = VoiceCallContext(
            name: "Sam", bio: "BIO", profile: [:], todayContext: "TODAY", ragContext: "RAG", focalEntry: nil
        )
        let request = VoiceTurnRequest(
            chatId: "c", message: "Hi", history: [], context: context, ragContext: "", now: "now"
        )
        XCTAssertNil(request.interview)
        XCTAssertEqual(request.bio, "BIO")
        XCTAssertEqual(request.ragContext, "RAG")
        XCTAssertEqual(request.now, "now")
        XCTAssertFalse(String(decoding: try JSONEncoder().encode(request), as: UTF8.self).contains("interview"))
    }

    // MARK: - Call view model

    /// A `VoiceCallService` driven from the test that records how it was started.
    private final class RecordingVoiceService: VoiceCallService {
        private let broadcaster = VoiceCallEventBroadcaster()
        private(set) var startedInterview: LifeInterviewSitting?
        var events: AsyncStream<VoiceCallEvent> { broadcaster.makeStream() }
        func startCall(chatId: String, journalId: String?, journalTitle: String?, interview: LifeInterviewSitting?) async throws {
            startedInterview = interview
        }
        func endCall() async { broadcaster.send(.ended(reason: nil)) }
        func setMuted(_ muted: Bool) {}
        func emit(_ event: VoiceCallEvent) { broadcaster.send(event) }
    }

    func testInterviewCallCreatesAnInterviewChatAndSavesProgress() async {
        UserDefaults.standard.set(true, forKey: DevFlags.devModeKey)
        defer { UserDefaults.standard.removeObject(forKey: DevFlags.devModeKey) }

        let chats = MockChatRepository()
        let voice = RecordingVoiceService()
        let sitting = LifeInterviewSitting(interviewId: "interview-1", section: Self.sectionB)
        let vm = VoiceCallViewModel(voice: voice, chats: chats, credits: MockCreditService(balance: 5), interview: sitting)

        await vm.start()

        XCTAssertEqual(voice.startedInterview, sitting)
        XCTAssertEqual(vm.chat?.interviewId, "interview-1")
        XCTAssertEqual(vm.chat?.interviewSection, "B")
        XCTAssertEqual(vm.chat?.title, "Life story: Key scenes")
        XCTAssertEqual(vm.interviewItem?.key, "B1")
        XCTAssertEqual(vm.interviewPositionText, "1 of 3")

        voice.emit(.interviewProgress(item: "B2", sectionComplete: false))
        await waitUntil { vm.interviewItemKey == "B2" }
        XCTAssertEqual(vm.interviewItem?.title, "Turning point")
        XCTAssertFalse(vm.interviewSectionComplete)

        voice.emit(.interviewProgress(item: nil, sectionComplete: true))
        await waitUntil { vm.interviewSectionComplete }
        XCTAssertTrue(vm.interviewSectionComplete)
        XCTAssertEqual(vm.interviewItemKey, "B2", "closing the section keeps the last question")

        // The progress lands on the stored chat, so the section reads as done.
        var stored: Chat?
        let deadline = Date().addingTimeInterval(2)
        while Date() < deadline {
            var iterator = chats.chats().makeAsyncIterator()
            stored = await iterator.next()?.first { $0.interviewId == "interview-1" }
            if stored?.interviewSectionDone == true { break }
            try? await Task.sleep(nanoseconds: 10_000_000)
        }
        XCTAssertEqual(stored?.interviewItem, "B2")
        XCTAssertEqual(stored?.interviewSectionDone, true)
    }

    func testOrdinaryCallIsNotAnInterview() async {
        UserDefaults.standard.set(true, forKey: DevFlags.devModeKey)
        defer { UserDefaults.standard.removeObject(forKey: DevFlags.devModeKey) }

        let voice = RecordingVoiceService()
        let vm = VoiceCallViewModel(voice: voice, chats: MockChatRepository(), credits: MockCreditService(balance: 5))
        await vm.start()

        XCTAssertNil(voice.startedInterview)
        XCTAssertNil(vm.chat?.interviewId)
        XCTAssertNil(vm.interviewItem)
        XCTAssertNil(vm.interviewPositionText)
    }

    // MARK: - Life Story view model

    func testLifeStoryLoadsTheScriptAndListsInterviews() async throws {
        let chats = MockChatRepository()
        _ = try await chats.createInterviewChat(title: "t", interviewId: "i1", section: "A", item: "A1")
        let vm = LifeStoryViewModel(chats: chats) { Self.script }

        await vm.start()
        await waitUntil { !vm.interviews.isEmpty }

        XCTAssertEqual(vm.script, Self.script)
        XCTAssertNil(vm.loadError)
        XCTAssertEqual(vm.interviews.map(\.id), ["i1"])
        XCTAssertEqual(vm.interview(id: "i1").progress(for: "A"), .inProgress(item: "A1"))
        // An id that has no sittings yet is a new, empty interview.
        let fresh = vm.interview(id: vm.newInterviewId())
        XCTAssertTrue(fresh.sittings.isEmpty)
        XCTAssertEqual(fresh.number, 2)
    }

    func testLifeStoryReportsAScriptFailureAndCanRetry() async {
        var shouldFail = true
        let vm = LifeStoryViewModel(chats: MockChatRepository()) {
            if shouldFail { throw LifeStoryError.unavailable }
            return Self.script
        }

        await vm.start()
        XCTAssertNil(vm.script)
        XCTAssertNotNil(vm.loadError)

        shouldFail = false
        await vm.reloadScript()
        XCTAssertEqual(vm.script, Self.script)
        XCTAssertNil(vm.loadError)
    }

    func testDeletingAnInterviewRemovesEverySitting() async throws {
        let chats = MockChatRepository()
        _ = try await chats.createInterviewChat(title: "a", interviewId: "i1", section: "A", item: "A1")
        _ = try await chats.createInterviewChat(title: "b", interviewId: "i1", section: "B", item: "B1")
        let vm = LifeStoryViewModel(chats: chats) { Self.script }
        await vm.start()
        await waitUntil { vm.interviews.first?.sittings.count == 2 }

        let deleted = await vm.delete(vm.interview(id: "i1"))
        XCTAssertTrue(deleted)
        XCTAssertNil(vm.deleteError)
        await waitUntil { vm.interviews.isEmpty }
        XCTAssertTrue(vm.interviews.isEmpty)
    }

    func testDeletionFailureRemainsVisibleForRetry() async {
        let vm = LifeStoryViewModel(chats: FailingInterviewDeleteRepository()) { Self.script }
        let target = LifeInterview(id: "i1", number: 1, sittings: [
            sitting("i1", section: "A", item: "A1", at: 1_000)
        ])
        let deleted = await vm.delete(target)
        XCTAssertFalse(deleted)
        XCTAssertNotNil(vm.deleteError)
    }

    // MARK: - Turn-taking

    func testInterviewWaitsLongerBeforeEndingATurn() {
        XCTAssertGreaterThan(
            LocalVoiceCallService.interviewTurnConfig.endSilenceFrames,
            VoiceTurnDetector.Config.default.endSilenceFrames
        )
    }
}

@MainActor
private final class FailingInterviewDeleteRepository: ChatRepository {
    func chats() -> AsyncStream<[Chat]> { AsyncStream { $0.finish() } }
    func messages(chatId: String) -> AsyncStream<[ChatMessage]> { AsyncStream { $0.finish() } }
    func createChat(kind: ChatKind, title: String, journalId: String?, journalTitle: String?, mirrorId: String?) async throws -> Chat {
        Chat(userId: "u", kind: kind, title: title)
    }
    func appendMessage(_ message: ChatMessage, to chatId: String) async throws {}
    func updateChatTitle(id: String, title: String) async throws {}
    func deleteChat(id: String) async throws { throw LifeStoryError.unavailable }
}
