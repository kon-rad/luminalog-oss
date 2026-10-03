import XCTest
@testable import LuminaLog

@MainActor
final class MirrorDetailViewModelTests: XCTestCase {

    private let message = EncouragementMessage(id: "2026-10-03_morning", timeOfDay: .morning,
                                                text: "Name it.", createdAt: Date(), deliveredAt: Date())

    private func inputs() -> MirrorInputs {
        MirrorInputs(dateKey: "2026-10-03",
                     sources: [MirrorSource(id: "e1", type: "text", title: "Monday", createdAt: Date(timeIntervalSince1970: 1_790_800_000), content: "Excerpt.")],
                     system: "SYS", user: "USR", model: "m", attempts: 1, fallbackSlots: [], createdAt: Date())
    }

    func testLoadsMessageAndInputs() async throws {
        let repo = InMemoryEncouragementRepository()
        try await repo.save([message], inputs: inputs())
        let vm = MirrorDetailViewModel(id: message.id, repository: repo)
        await vm.load()
        guard case let .loaded(loaded, loadedInputs) = vm.state else { return XCTFail("\(vm.state)") }
        XCTAssertEqual(loaded.text, "Name it.")
        XCTAssertEqual(loadedInputs?.system, "SYS")
    }

    func testOlderMirrorLoadsWithoutInputs() async throws {
        let repo = InMemoryEncouragementRepository()
        try await repo.save([message], inputs: nil)
        let vm = MirrorDetailViewModel(id: message.id, repository: repo)
        await vm.load()
        guard case let .loaded(_, loadedInputs) = vm.state else { return XCTFail("\(vm.state)") }
        XCTAssertNil(loadedInputs)
    }

    func testMissingMessageIsNotFound() async {
        let vm = MirrorDetailViewModel(id: "2026-01-01_morning", repository: InMemoryEncouragementRepository())
        await vm.load()
        XCTAssertEqual(vm.state, .notFound)
    }

    func testDetailsTextHasSourcesThenPromptVerbatim() {
        let text = MirrorDetailViewModel.detailsText(inputs())
        let sources = try! XCTUnwrap(text.range(of: "Excerpt."))
        let system = try! XCTUnwrap(text.range(of: "SYS"))
        let user = try! XCTUnwrap(text.range(of: "USR"))
        XCTAssertLessThan(sources.lowerBound, system.lowerBound)
        XCTAssertLessThan(system.lowerBound, user.lowerBound)
    }

    func testDetailsTextWithoutPromptSaysSo() {
        var older = inputs()
        older.system = nil
        older.user = nil
        XCTAssertTrue(MirrorDetailViewModel.detailsText(older).contains("Prompt text not recorded."))
    }
}
