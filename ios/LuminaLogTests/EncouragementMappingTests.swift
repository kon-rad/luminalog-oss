import XCTest
import CryptoKit
@testable import LuminaLog

final class EncouragementMappingTests: XCTestCase {

    private let cipher = FieldCipher(key: SymmetricKey(size: .bits256))

    func testRoundTripsThroughFirestoreData() throws {
        let created = Date(timeIntervalSince1970: 1_700_000_000)
        let message = EncouragementMessage(
            id: "2026-08-24_1700000000000_0",
            title: "One small step",
            body: "You named the hard part yesterday. Take the smallest version of it today.",
            createdAt: created,
            deliveredAt: nil
        )

        let data = try message.firestoreData(cipher: cipher)
        let decoded = try EncouragementMessage(firestore: data, id: message.id, cipher: cipher)

        XCTAssertEqual(decoded.title, message.title)
        XCTAssertEqual(decoded.body, message.body)
        XCTAssertEqual(decoded.createdAt.timeIntervalSince1970, created.timeIntervalSince1970, accuracy: 1)
        XCTAssertNil(decoded.deliveredAt)
    }

    func testTitleAndBodyAreNotStoredInPlaintext() throws {
        let message = EncouragementMessage(
            id: "2026-08-24_1700000000000_1",
            title: "Secret title",
            body: "Secret body text.",
            createdAt: Date(),
            deliveredAt: nil
        )

        let data = try message.firestoreData(cipher: cipher)
        let dump = String(describing: data)

        XCTAssertFalse(dump.contains("Secret title"))
        XCTAssertFalse(dump.contains("Secret body text."))
    }

    func testDecryptionFailsWhenTheAADContextDoesNotMatch() throws {
        let message = EncouragementMessage(
            id: "2026-08-24_1700000000000_9",
            title: "T", body: "B",
            createdAt: Date(timeIntervalSince1970: 1_700_000_000),
            deliveredAt: nil
        )
        var data = try message.firestoreData(cipher: cipher)
        // Swap the title ciphertext for one sealed under a different context.
        data["title"] = try cipher.sealed("T", "dailyReports.findings")

        XCTAssertThrowsError(try EncouragementMessage(firestore: data, id: message.id, cipher: cipher))
    }

    func testDocumentIdSortsChronologicallyWithinAndAcrossDays() {
        let earlier = Date(timeIntervalSince1970: 1_700_000_000)
        let later = Date(timeIntervalSince1970: 1_700_086_400)

        let a = EncouragementIds.documentId(dateKey: "2026-08-24", generatedAt: earlier, index: 0)
        let b = EncouragementIds.documentId(dateKey: "2026-08-24", generatedAt: earlier, index: 1)
        let c = EncouragementIds.documentId(dateKey: "2026-08-25", generatedAt: later, index: 0)

        XCTAssertTrue(a < b)
        XCTAssertTrue(b < c)
        XCTAssertEqual(EncouragementIds.dateKeyPrefix(a), "2026-08-24")
    }

    func testDeliveredAtSurvivesTheRoundTrip() throws {
        let delivered = Date(timeIntervalSince1970: 1_700_050_000)
        let message = EncouragementMessage(
            id: "2026-08-24_1700000000000_2",
            title: "T", body: "B",
            createdAt: Date(timeIntervalSince1970: 1_700_000_000),
            deliveredAt: delivered
        )

        let data = try message.firestoreData(cipher: cipher)
        let decoded = try EncouragementMessage(firestore: data, id: message.id, cipher: cipher)

        XCTAssertEqual(decoded.deliveredAt?.timeIntervalSince1970 ?? 0, delivered.timeIntervalSince1970, accuracy: 1)
    }
}
