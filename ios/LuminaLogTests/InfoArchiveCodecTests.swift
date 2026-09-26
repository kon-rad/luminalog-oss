import XCTest
import CryptoKit
@testable import LuminaLog

final class InfoArchiveCodecTests: XCTestCase {

    // MARK: - Helpers

    private func makeKey() -> SymmetricKey {
        SymmetricKey(data: Data(repeating: 0xAB, count: 32))
    }

    private func makeEntry() -> InfoArchiveEntry {
        InfoArchiveEntry(
            sender: InfoRequestSender(
                address: "0xabc",
                ens: "alice.eth",
                name: "Alice",
                description: "A friendly request"
            ),
            reason: "Research",
            webhookHost: "https://hook.example.com",
            items: [
                InfoArchiveEntry.Item(
                    index: 0,
                    question: "What is your favorite color?",
                    answer: "Blue"
                ),
                InfoArchiveEntry.Item(
                    index: 1,
                    question: "How old are you?",
                    answer: nil
                ),
            ],
            respondedAt: Date(timeIntervalSince1970: 1_700_000_000)
        )
    }

    // MARK: - Round-trip

    func testRoundTripWithSameKey() throws {
        let key = makeKey()
        let entry = makeEntry()

        let serialized = try InfoArchiveCodec.encode(entry, key: key)
        let decoded = try InfoArchiveCodec.decode(serialized, key: key)

        XCTAssertEqual(decoded.sender, entry.sender)
        XCTAssertEqual(decoded.reason, entry.reason)
        XCTAssertEqual(decoded.webhookHost, entry.webhookHost)
        XCTAssertEqual(decoded.items.count, entry.items.count)
        XCTAssertEqual(decoded.items[0].index, 0)
        XCTAssertEqual(decoded.items[0].question, "What is your favorite color?")
        XCTAssertEqual(decoded.items[0].answer, "Blue")
        XCTAssertEqual(decoded.items[1].index, 1)
        XCTAssertEqual(decoded.items[1].question, "How old are you?")
        XCTAssertNil(decoded.items[1].answer)
        XCTAssertEqual(decoded.respondedAt.timeIntervalSince1970, 1_700_000_000)
    }

    // MARK: - No plaintext at rest

    func testNoPlaintextAtRest() throws {
        let key = makeKey()
        let entry = makeEntry()

        let serialized = try InfoArchiveCodec.encode(entry, key: key)

        // Search the raw bytes: ciphertext isn't valid UTF-8, so don't decode it.
        for plaintext in ["favorite color", "Blue", "alice.eth", "Research", "How old are you?"] {
            XCTAssertNil(serialized.range(of: Data(plaintext.utf8)), "\(plaintext) should not appear in encrypted data")
        }
    }

    // MARK: - Wrong key fails

    func testWrongKeyFailsToDecode() throws {
        let key = makeKey()
        let wrongKey = SymmetricKey(data: Data(repeating: 0xCD, count: 32))
        let entry = makeEntry()

        let serialized = try InfoArchiveCodec.encode(entry, key: key)

        // CryptoKit's authentication failure surfaces as its own error type.
        XCTAssertThrowsError(try InfoArchiveCodec.decode(serialized, key: wrongKey))
    }

    // MARK: - MockInfoArchiveRepository

    func testMockArchiveSaveAndList() async throws {
        let mock = MockInfoArchiveRepository()
        let entry = makeEntry()

        // Initially empty
        var listed = try await mock.list()
        XCTAssertTrue(listed.isEmpty)

        // Save and list
        try await mock.save(entry)
        listed = try await mock.list()
        XCTAssertEqual(listed.count, 1)
        XCTAssertEqual(listed.first?.reason, entry.reason)
    }

    func testMockArchiveDelete() async throws {
        let mock = MockInfoArchiveRepository()
        let entry = makeEntry()

        try await mock.save(entry)
        try await mock.save(
            InfoArchiveEntry(
                sender: InfoRequestSender(
                    address: "0xdef", ens: nil, name: "Bob", description: "Bob's request"
                ),
                reason: "Networking",
                webhookHost: "https://bob.example.com",
                items: [],
                respondedAt: Date()
            )
        )

        var listed = try await mock.list()
        XCTAssertEqual(listed.count, 2)

        // Delete first
        try await mock.delete(entry)
        listed = try await mock.list()
        XCTAssertEqual(listed.count, 1)
        XCTAssertEqual(listed.first?.reason, "Networking")
    }
}