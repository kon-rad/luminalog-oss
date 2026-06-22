import XCTest
@testable import LuminaLog

@MainActor
final class OnboardingMergeTests: XCTestCase {

    // MARK: - Returning user (fill-blanks-only)

    func testReturningUserFillsOnlyBlankFields() async throws {
        let existing = UserProfile(id: "u", displayName: "Existing", biography: "Has bio")
        let repo = MockProfileRepository(profile: existing)

        try await repo.mergeOnboardingDraft([
            "name": "FromOnboarding",          // should NOT overwrite
            "biography": "New bio",            // should NOT overwrite
            "goals": "Learn Swift",            // blank → fills
        ], overwriteExisting: false)

        let saved = repo.lastSaved
        XCTAssertEqual(saved?.displayName, "Existing")
        XCTAssertEqual(saved?.biography, "Has bio")
        XCTAssertEqual(saved?.details.goals, "Learn Swift")
    }

    func testReturningUserBlankDraftValuesAreIgnored() async throws {
        let existing = UserProfile(id: "u", displayName: "Existing")
        let repo = MockProfileRepository(profile: existing)
        // Only whitespace / empty → no change, nothing saved.
        try await repo.mergeOnboardingDraft(["name": "   ", "goals": ""], overwriteExisting: false)
        XCTAssertNil(repo.lastSaved)
    }

    func testFillBlanksReturnsNilWhenNothingChanges() {
        let profile = UserProfile(id: "u", displayName: "Existing", biography: "Bio")
        let result = applyingOnboardingDraft(["name": "X", "biography": "Y"], to: profile, overwriteExisting: false)
        XCTAssertNil(result)
    }

    // MARK: - New account (onboarding answers win)

    func testNewUserGetsAllProvidedFields() async throws {
        let repo = MockProfileRepository(profile: UserProfile(id: "u"))
        try await repo.mergeOnboardingDraft(["name": "Ada", "goals": "Build", "age": "30"], overwriteExisting: true)
        XCTAssertEqual(repo.lastSaved?.displayName, "Ada")
        XCTAssertEqual(repo.lastSaved?.details.goals, "Build")
        XCTAssertEqual(repo.lastSaved?.details.age, "30")
    }

    func testNewUserOnboardingNameOverridesProviderSeed() async throws {
        // The provider seeded a display name; the user typed a different one.
        let seeded = UserProfile(id: "u", displayName: "Provider Name")
        let repo = MockProfileRepository(profile: seeded)
        try await repo.mergeOnboardingDraft(["name": "Preferred Name"], overwriteExisting: true)
        XCTAssertEqual(repo.lastSaved?.displayName, "Preferred Name")
    }

    func testNewUserBlankOnboardingNameKeepsProviderSeed() async throws {
        let seeded = UserProfile(id: "u", displayName: "Provider Name")
        let repo = MockProfileRepository(profile: seeded)
        // Name left blank in onboarding → provider name preserved; goals fills.
        try await repo.mergeOnboardingDraft(["name": "  ", "goals": "Ship it"], overwriteExisting: true)
        XCTAssertEqual(repo.lastSaved?.displayName, "Provider Name")
        XCTAssertEqual(repo.lastSaved?.details.goals, "Ship it")
    }
}
