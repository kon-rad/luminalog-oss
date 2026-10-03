import XCTest
import CryptoKit
@testable import LuminaLog

final class MirrorInputsMappingTests: XCTestCase {

    private let cipher = FieldCipher(key: SymmetricKey(size: .bits256))

    private func sample(system: String? = "SYSTEM PROMPT with entry text") -> MirrorInputs {
        MirrorInputs(
            dateKey: "2026-10-03",
            sources: [MirrorSource(id: "e1", type: "text", title: "Monday",
                                   createdAt: Date(timeIntervalSince1970: 1_790_000_000),
                                   content: "I kept avoiding the hard call.")],
            system: system,
            user: system == nil ? nil : "Generate the three echoes now as strict JSON.",
            model: system == nil ? nil : "venice-model",
            attempts: system == nil ? nil : 2,
            fallbackSlots: [.evening],
            createdAt: Date(timeIntervalSince1970: 1_790_000_500)
        )
    }

    func testRoundTrips() throws {
        let inputs = sample()
        let decoded = try MirrorInputs(firestore: inputs.firestoreData(cipher: cipher), dateKey: "2026-10-03", cipher: cipher)
        XCTAssertEqual(decoded.sources, inputs.sources)
        XCTAssertEqual(decoded.system, inputs.system)
        XCTAssertEqual(decoded.user, inputs.user)
        XCTAssertEqual(decoded.model, "venice-model")
        XCTAssertEqual(decoded.attempts, 2)
        XCTAssertEqual(decoded.fallbackSlots, [.evening])
        XCTAssertEqual(decoded.createdAt.timeIntervalSince1970, inputs.createdAt.timeIntervalSince1970, accuracy: 1)
    }

    func testPromptAndSourcesAreNotPlaintext() throws {
        let dump = String(describing: try sample().firestoreData(cipher: cipher))
        XCTAssertFalse(dump.contains("SYSTEM PROMPT"))
        XCTAssertFalse(dump.contains("hard call"))
        XCTAssertFalse(dump.contains("Monday"))
    }

    func testOlderServerWithoutPromptDecodesNilPromptFields() throws {
        let inputs = sample(system: nil)
        let data = try inputs.firestoreData(cipher: cipher)
        XCTAssertNil(data["system"])
        let decoded = try MirrorInputs(firestore: data, dateKey: "2026-10-03", cipher: cipher)
        XCTAssertNil(decoded.system)
        XCTAssertNil(decoded.user)
        XCTAssertNil(decoded.attempts)
        XCTAssertEqual(decoded.sources.count, 1)
    }

    @MainActor
    func testInMemoryRepositoryStoresInputsAndFindsMessageById() async throws {
        let repo = InMemoryEncouragementRepository()
        let message = EncouragementMessage(id: "2026-10-03_morning", timeOfDay: .morning,
                                           text: "t", createdAt: Date(), deliveredAt: nil)
        try await repo.save([message], inputs: sample())
        let found = try await repo.message(id: "2026-10-03_morning")
        XCTAssertEqual(found?.text, "t")
        let missing = try await repo.message(id: "2026-10-03_evening")
        XCTAssertNil(missing)
        let inputs = try await repo.inputs(forDateKey: "2026-10-03")
        XCTAssertEqual(inputs?.system, "SYSTEM PROMPT with entry text")
    }
}
