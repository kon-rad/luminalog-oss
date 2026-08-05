import XCTest
@testable import LuminaLog

/// `users/{uid}` can be created by the SERVER before the client's first
/// successful write — the RevenueCat webhook merge-sets `entitlement` the moment
/// a purchase lands. `ensureUserDocument` used to bail out whenever the doc
/// existed, so such a user never got their name/photo seeded at all (ADR-0114).
final class IdentityBackfillTests: XCTestCase {

    private let photo = URL(string: "https://example.com/me.jpg")!

    func testFillsEveryFieldMissingFromAServerCreatedDoc() {
        // What the RevenueCat webhook leaves behind: entitlement, nothing else.
        let existing: [String: Any] = ["entitlement": ["proExpiresAtMs": 123]]

        let patch = UserProfile.identityBackfill(
            existing: existing, displayName: "Ada Lovelace",
            email: "ada@example.com", photoURL: photo
        )

        XCTAssertEqual(patch.displayName, "Ada Lovelace")
        XCTAssertEqual(patch.email, "ada@example.com")
        XCTAssertEqual(patch.photoURL, photo.absoluteString)
        XCTAssertFalse(patch.isEmpty)
    }

    func testNeverOverwritesWhatTheUserAlreadySet() {
        let existing: [String: Any] = [
            "displayName": "Ada",                      // user-edited nickname
            "email": "ada@example.com",
            "photoURL": "users/u1/journals/profile/pic.jpg",  // their uploaded photo
        ]

        let patch = UserProfile.identityBackfill(
            existing: existing, displayName: "Ada Lovelace",
            email: "other@example.com", photoURL: photo
        )

        XCTAssertTrue(patch.isEmpty, "a complete profile must produce no write")
    }

    func testTreatsBlankStoredValuesAsMissing() {
        let existing: [String: Any] = ["displayName": "   ", "email": ""]

        let patch = UserProfile.identityBackfill(
            existing: existing, displayName: "Ada", email: "ada@example.com", photoURL: nil
        )

        XCTAssertEqual(patch.displayName, "Ada")
        XCTAssertEqual(patch.email, "ada@example.com")
        XCTAssertNil(patch.photoURL)
    }

    func testIgnoresBlankProviderValues() {
        // Sign in with Apple gives no displayName after the first authorization.
        let patch = UserProfile.identityBackfill(
            existing: [:], displayName: "  ", email: nil, photoURL: nil
        )

        XCTAssertTrue(patch.isEmpty)
    }
}
