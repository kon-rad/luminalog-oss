import XCTest
@testable import LuminaLog

/// ProfileViewModel consumes async streams, so tests drive the spies and poll
/// the published state with a bounded wait (same pattern as HomeViewModelTests).
final class ProfileViewModelTests: XCTestCase {

    // MARK: - Spies

    /// Streams a seeded profile and records every `update(_:)` call.
    @MainActor
    private final class SpyProfileRepository: ProfileRepository {
        struct UpdateError: Error {}

        private(set) var updates: [UserProfile] = []
        var shouldFailUpdate = false

        private var stored: UserProfile?
        private var continuations: [UUID: AsyncStream<UserProfile?>.Continuation] = [:]

        init(profile: UserProfile? = MockData.profile) {
            stored = profile
        }

        func profile() -> AsyncStream<UserProfile?> {
            AsyncStream { continuation in
                let key = UUID()
                continuations[key] = continuation
                continuation.onTermination = { [weak self] _ in
                    Task { @MainActor in
                        self?.continuations[key] = nil
                    }
                }
                continuation.yield(stored)
            }
        }

        func update(_ profile: UserProfile) async throws {
            if shouldFailUpdate { throw UpdateError() }
            updates.append(profile)
            stored = profile
            for continuation in continuations.values {
                continuation.yield(stored)
            }
        }

        func ensureUserDocument(displayName: String?, email: String?, photoURL: URL?) async throws {}
        func recordEntrySaved(wordCountDelta: Int, on date: Date) async throws {}
    }

    /// Records uploads without touching the file system.
    @MainActor
    private final class SpyMediaUploader: MediaUploader {
        struct UploadError: Error {}

        private(set) var uploads: [(kind: MediaKind, journalId: String)] = []
        private(set) var viewURLKeys: [String] = []
        var shouldFail = false
        var s3Key = "profile/avatar-1.jpg"

        func upload(fileURL: URL, kind: MediaKind, journalId: String) async throws -> MediaItem {
            if shouldFail { throw UploadError() }
            uploads.append((kind, journalId))
            return MediaItem(s3Key: s3Key, kind: kind)
        }

        func viewURL(for s3Key: String) async throws -> URL {
            viewURLKeys.append(s3Key)
            return URL(fileURLWithPath: "/resolved/\(s3Key)")
        }
    }

    // MARK: - Harness

    @MainActor
    private struct Harness {
        let viewModel: ProfileViewModel
        let auth: MockAuthService
        let profiles: SpyProfileRepository
        let subscriptions: MockSubscriptionService
        let media: SpyMediaUploader

        init(
            profile: UserProfile? = MockData.profile,
            entitlement: Entitlement = Entitlement()
        ) {
            auth = MockAuthService(signedIn: true)
            profiles = SpyProfileRepository(profile: profile)
            subscriptions = MockSubscriptionService(entitlement: entitlement)
            media = SpyMediaUploader()
            viewModel = ProfileViewModel(
                auth: auth,
                profiles: profiles,
                subscriptions: subscriptions,
                media: media
            )
        }
    }

    /// Polls `condition` until it holds or the timeout elapses, then asserts.
    @MainActor
    private func waitUntil(
        timeout: TimeInterval = 2,
        _ message: String,
        _ condition: () -> Bool
    ) async {
        let deadline = Date().addingTimeInterval(timeout)
        while !condition() && Date() < deadline {
            try? await Task.sleep(nanoseconds: 10_000_000)
        }
        XCTAssertTrue(condition(), message)
    }

    @MainActor
    private func makeStarted(
        profile: UserProfile? = MockData.profile,
        entitlement: Entitlement = Entitlement()
    ) async -> Harness {
        let harness = Harness(profile: profile, entitlement: entitlement)
        harness.viewModel.start()
        await waitUntil("Profile stream emits the seeded profile") {
            harness.viewModel.profile != nil
        }
        return harness
    }

    // MARK: - Bio

    @MainActor
    func testSaveBioCallsRepositoryWithNewBio() async {
        let harness = await makeStarted()

        harness.viewModel.bioDraft = "A brand new bio."
        XCTAssertTrue(harness.viewModel.isBioDirty)

        await harness.viewModel.saveBio()

        XCTAssertEqual(harness.profiles.updates.count, 1)
        XCTAssertEqual(harness.profiles.updates.last?.biography, "A brand new bio.")
        // Everything else on the profile is preserved.
        XCTAssertEqual(harness.profiles.updates.last?.displayName, MockData.profile.displayName)
        XCTAssertEqual(harness.profiles.updates.last?.stats, MockData.profile.stats)
    }

    @MainActor
    func testSaveBioSkippedWhenUnchanged() async {
        let harness = await makeStarted()

        XCTAssertFalse(harness.viewModel.isBioDirty)
        await harness.viewModel.saveBio()

        XCTAssertTrue(harness.profiles.updates.isEmpty,
                      "A clean bio must not hit the repository")
    }

    @MainActor
    func testBioBecomesCleanAfterSaveRoundTrips() async {
        let harness = await makeStarted()

        harness.viewModel.bioDraft = "Round-trip bio."
        await harness.viewModel.saveBio()

        await waitUntil("The updated profile emission marks the draft clean") {
            !harness.viewModel.isBioDirty
        }
        XCTAssertEqual(harness.viewModel.profile?.biography, "Round-trip bio.")
    }

    @MainActor
    func testProfileEmissionDoesNotClobberDirtyBioDraft() async {
        let harness = await makeStarted()

        harness.viewModel.bioDraft = "Mid-edit draft…"

        // Another writer (e.g. a different device) updates the name.
        var remote = harness.viewModel.profile!
        remote.displayName = "Renamed Elsewhere"
        try? await harness.profiles.update(remote)

        await waitUntil("Remote rename arrives") {
            harness.viewModel.profile?.displayName == "Renamed Elsewhere"
        }
        XCTAssertEqual(harness.viewModel.bioDraft, "Mid-edit draft…",
                       "A dirty bio draft must survive unrelated profile emissions")
    }

    // MARK: - Display name

    @MainActor
    func testSaveDisplayNamePersistsTrimmedName() async {
        let harness = await makeStarted()

        harness.viewModel.displayNameDraft = "  New Name  "
        await harness.viewModel.saveDisplayName()

        XCTAssertEqual(harness.profiles.updates.count, 1)
        XCTAssertEqual(harness.profiles.updates.last?.displayName, "New Name")
        XCTAssertEqual(harness.viewModel.displayNameDraft, "New Name")
    }

    @MainActor
    func testSaveDisplayNameSkippedWhenUnchangedAndRevertsWhenEmpty() async {
        let harness = await makeStarted()

        // Unchanged → no repository call.
        await harness.viewModel.saveDisplayName()
        XCTAssertTrue(harness.profiles.updates.isEmpty)

        // Emptied → reverts to the stored name, no repository call.
        harness.viewModel.displayNameDraft = "   "
        await harness.viewModel.saveDisplayName()
        XCTAssertTrue(harness.profiles.updates.isEmpty)
        XCTAssertEqual(harness.viewModel.displayNameDraft, MockData.profile.displayName)
    }

    // MARK: - Avatar

    @MainActor
    func testUploadAvatarUploadsToProfileJournalAndPersistsS3Key() async {
        let harness = await makeStarted()
        harness.media.s3Key = "profile/avatar-42.jpg"

        await harness.viewModel.uploadAvatar(imageData: Data("jpeg-bytes".utf8))

        XCTAssertEqual(harness.media.uploads.count, 1)
        XCTAssertEqual(harness.media.uploads.first?.kind, .image)
        XCTAssertEqual(harness.media.uploads.first?.journalId, "profile")

        // The s3Key string is stored as the profile's photoURL.
        XCTAssertEqual(harness.profiles.updates.last?.photoURL?.absoluteString,
                       "profile/avatar-42.jpg")

        // The avatar display URL resolves through the uploader.
        await waitUntil("Avatar URL resolves via viewURL(for:)") {
            harness.viewModel.avatarURL != nil
        }
        XCTAssertEqual(harness.media.viewURLKeys.last, "profile/avatar-42.jpg")
    }

    @MainActor
    func testUploadAvatarFailureSurfacesErrorAndSkipsProfileUpdate() async {
        let harness = await makeStarted()
        harness.media.shouldFail = true

        await harness.viewModel.uploadAvatar(imageData: Data("jpeg-bytes".utf8))

        XCTAssertTrue(harness.profiles.updates.isEmpty)
        XCTAssertNotNil(harness.viewModel.errorMessage)
    }

    // MARK: - Subscription label

    @MainActor
    func testSubscriptionLabelForFreeAndPro() async {
        let free = await makeStarted()
        await waitUntil("Free entitlement arrives") {
            free.viewModel.entitlement != nil
        }
        XCTAssertEqual(free.viewModel.subscriptionLabel, "Free plan")

        let expiry = Date(timeIntervalSince1970: 2_000_000_000)
        let pro = await makeStarted(entitlement: Entitlement(
            isPro: true,
            productId: "luminalog.pro.annual",
            expiresAt: expiry
        ))
        await waitUntil("Pro entitlement arrives") {
            pro.viewModel.isPro
        }
        XCTAssertEqual(
            pro.viewModel.subscriptionLabel,
            "Pro — renews \(expiry.formatted(date: .abbreviated, time: .omitted))"
        )
    }

    // MARK: - Sign out / delete

    @MainActor
    func testSignOutSignsOutOfAuth() async {
        let harness = await makeStarted()

        harness.viewModel.signOut()

        XCTAssertNil(harness.auth.currentUserId)
        XCTAssertNil(harness.viewModel.errorMessage)
    }

    @MainActor
    func testDeleteAccountDeletesViaAuth() async {
        let harness = await makeStarted()

        await harness.viewModel.deleteAccount()

        XCTAssertNil(harness.auth.currentUserId)
        XCTAssertNil(harness.viewModel.errorMessage)
    }
}
