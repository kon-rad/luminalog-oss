import XCTest
import CryptoKit
@testable import LuminaLog

final class EncouragementMappingTests: XCTestCase {

    private let cipher = FieldCipher(key: SymmetricKey(size: .bits256))

    func testRoundTripsThroughFirestoreData() throws {
        let created = Date(timeIntervalSince1970: 1_700_000_000)
        let message = EncouragementMessage(
            id: "2026-08-24_morning",
            timeOfDay: .morning,
            text: "You named the hard part yesterday. Take the smallest version of it today.",
            createdAt: created,
            deliveredAt: nil
        )

        let data = try message.firestoreData(cipher: cipher)
        let decoded = try EncouragementMessage(firestore: data, id: message.id, cipher: cipher)

        XCTAssertEqual(decoded.timeOfDay, message.timeOfDay)
        XCTAssertEqual(decoded.text, message.text)
        XCTAssertEqual(decoded.createdAt.timeIntervalSince1970, created.timeIntervalSince1970, accuracy: 1)
        XCTAssertNil(decoded.deliveredAt)
    }

    func testTextIsNotStoredInPlaintext() throws {
        let message = EncouragementMessage(
            id: "2026-08-24_afternoon",
            timeOfDay: .afternoon,
            text: "Secret reflection text.",
            createdAt: Date(),
            deliveredAt: nil
        )

        let data = try message.firestoreData(cipher: cipher)
        let dump = String(describing: data)

        XCTAssertFalse(dump.contains("Secret reflection text."))
    }

    func testDecryptionFailsWhenTheAADContextDoesNotMatch() throws {
        let message = EncouragementMessage(
            id: "2026-08-24_evening",
            timeOfDay: .evening, text: "T",
            createdAt: Date(timeIntervalSince1970: 1_700_000_000),
            deliveredAt: nil
        )
        var data = try message.firestoreData(cipher: cipher)
        // Swap the text ciphertext for one sealed under a different context.
        data["text"] = try cipher.sealed("T", "dailyReports.findings")

        XCTAssertThrowsError(try EncouragementMessage(firestore: data, id: message.id, cipher: cipher))
    }

    func testDecodingFailsWhenTimeOfDayIsMissingOrUnrecognized() throws {
        let message = EncouragementMessage(
            id: "2026-08-24_morning",
            timeOfDay: .morning, text: "T",
            createdAt: Date(timeIntervalSince1970: 1_700_000_000),
            deliveredAt: nil
        )
        var data = try message.firestoreData(cipher: cipher)
        data["timeOfDay"] = "midnight"

        XCTAssertThrowsError(try EncouragementMessage(firestore: data, id: message.id, cipher: cipher))
    }

    func testDocumentIdEmbedsDateKeyAndTimeOfDay() {
        let a = EncouragementIds.documentId(dateKey: "2026-08-24", timeOfDay: .morning)
        let b = EncouragementIds.documentId(dateKey: "2026-08-24", timeOfDay: .evening)
        let c = EncouragementIds.documentId(dateKey: "2026-08-25", timeOfDay: .morning)

        XCTAssertEqual(a, "2026-08-24_morning")
        XCTAssertEqual(b, "2026-08-24_evening")
        XCTAssertEqual(EncouragementIds.dateKeyPrefix(a), "2026-08-24")
        XCTAssertEqual(EncouragementIds.dateKeyPrefix(c), "2026-08-25")
    }

    func testDeliveredAtSurvivesTheRoundTrip() throws {
        let delivered = Date(timeIntervalSince1970: 1_700_050_000)
        let message = EncouragementMessage(
            id: "2026-08-24_afternoon",
            timeOfDay: .afternoon, text: "T",
            createdAt: Date(timeIntervalSince1970: 1_700_000_000),
            deliveredAt: delivered
        )

        let data = try message.firestoreData(cipher: cipher)
        let decoded = try EncouragementMessage(firestore: data, id: message.id, cipher: cipher)

        XCTAssertEqual(decoded.deliveredAt?.timeIntervalSince1970 ?? 0, delivered.timeIntervalSince1970, accuracy: 1)
    }

    func testDeliveredAtIsOmittedRatherThanWrittenAsNullWhileQueued() throws {
        let message = EncouragementMessage(
            id: "2026-08-24_morning",
            timeOfDay: .morning, text: "T",
            createdAt: Date(timeIntervalSince1970: 1_700_000_000),
            deliveredAt: nil
        )

        let data = try message.firestoreData(cipher: cipher)

        XCTAssertNil(data["deliveredAt"])
    }
}
