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
        func recordMediaUploaded(kind: MediaKind, bytes: Int) async throws {}
        func recordTimeSpent(minutes: Int) async throws {}
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

        func localFileURL(for s3Key: String) async throws -> URL {
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
                credits: MockCreditService(),
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

    // MARK: - Edit view model factory

    @MainActor
    func testMakeEditViewModelSeedsFromSameProfile() async {
        let harness = await makeStarted()
        let editVM = harness.viewModel.makeEditViewModel()
        editVM.start()
        let deadline = Date().addingTimeInterval(2)
        while editVM.profile == nil && Date() < deadline {
            try? await Task.sleep(nanoseconds: 10_000_000)
        }
        XCTAssertEqual(editVM.profile?.id, MockData.profile.id)
        XCTAssertEqual(editVM.displayNameDraft, MockData.profile.displayName)
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
