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

        func ensureUserDocument(displayName: String?, email: String?, photoURL: URL?) async throws -> Bool { false }
        func mergeOnboardingDraft(_ draft: [String: String], overwriteExisting: Bool) async throws {}
        func addTotalWords(delta: Int) async throws {}
        func reconcileDailyGoal(todayTotal: Int, now: Date) async throws {}
        func recordMediaUploaded(kind: MediaKind, bytes: Int) async throws {}
        func recordTimeSpent(minutes: Int) async throws {}
        func recordPromptAnswered() async throws {}
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

        func prepareUpload(fileURL: URL, kind: MediaKind, journalId: String) async throws -> PreparedUpload {
            PreparedUpload(encryptedFileURL: fileURL, s3Key: s3Key, mediaItem: MediaItem(s3Key: s3Key, kind: kind))
        }

        func presignUpload(s3Key: String?, kind: MediaKind, ext: String, bytes: Int, journalId: String) async throws -> (s3Key: String, url: URL) {
            (s3Key ?? self.s3Key, URL(fileURLWithPath: "/dev/null"))
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
                media: media,
                speech: MockSpeechTranscriber()
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
        let nameField = ProfileFieldCatalog.all.first { $0.key == "name" }!
        XCTAssertEqual(editVM.value(for: nameField), MockData.profile.displayName)
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
            productId: "com.luminalog.pro.yearly",
            expiresAt: expiry
        ))
        await waitUntil("Pro entitlement arrives") {
            pro.viewModel.isPro
        }
        XCTAssertEqual(
            pro.viewModel.subscriptionLabel,
            "Pro, renews \(expiry.formatted(date: .abbreviated, time: .omitted))"
        )
    }

    // MARK: - Manage subscription routing (design 2026-08-23, section 3)

    @MainActor
    func testFreePlanRoutesToPaywall() async {
        let harness = await makeStarted()
        await waitUntil("Free entitlement arrives") { harness.viewModel.entitlement != nil }

        let destination = await harness.viewModel.manageSubscription()

        XCTAssertEqual(destination, .paywall)
        XCTAssertEqual(harness.subscriptions.showManageSubscriptionsCount, 0)
    }

    @MainActor
    func testAppStoreSubscriptionOpensStoreKitSheet() async {
        let harness = await makeStarted(entitlement: Entitlement(
            isPro: true,
            store: .appStore,
            // Apple's own management URL: it must still not be opened in a
            // browser, because Apple requires the in-app sheet.
            managementURL: URL(string: "https://apps.apple.com/account/subscriptions")
        ))
        await waitUntil("Pro entitlement arrives") { harness.viewModel.isPro }

        let destination = await harness.viewModel.manageSubscription()

        XCTAssertEqual(destination, .appStoreSheet)
        XCTAssertEqual(harness.subscriptions.showManageSubscriptionsCount, 1)
    }

    @MainActor
    func testWebSubscriptionOpensCustomerPortal() async {
        let portal = URL(string: "https://pay.rev.cat/portal/abc123")!
        let harness = await makeStarted(entitlement: Entitlement(
            isPro: true,
            store: .rcBilling,
            managementURL: portal
        ))
        await waitUntil("Pro entitlement arrives") { harness.viewModel.isPro }

        let destination = await harness.viewModel.manageSubscription()

        XCTAssertEqual(destination, .portal(portal))
        XCTAssertEqual(harness.subscriptions.showManageSubscriptionsCount, 0)
    }

    @MainActor
    func testPromotionalGrantIsNotManageable() async {
        let harness = await makeStarted(entitlement: Entitlement(isPro: true, store: .promotional))
        await waitUntil("Pro entitlement arrives") { harness.viewModel.isPro }

        let destination = await harness.viewModel.manageSubscription()

        XCTAssertEqual(destination, .notManageable)
        XCTAssertEqual(harness.subscriptions.showManageSubscriptionsCount, 0)
    }

    /// The case that makes this routing worth writing: a non-Apple subscription
    /// with no management URL must not fall through to Apple's subscriptions
    /// page, which is what the bare SDK call would do.
    @MainActor
    func testWebSubscriptionWithoutManagementURLIsNotManageable() async {
        let harness = await makeStarted(entitlement: Entitlement(isPro: true, store: .rcBilling))
        await waitUntil("Pro entitlement arrives") { harness.viewModel.isPro }

        let destination = await harness.viewModel.manageSubscription()

        XCTAssertEqual(destination, .notManageable)
        XCTAssertEqual(harness.subscriptions.showManageSubscriptionsCount, 0)
    }

    /// A store RevenueCat adds later maps to `.unknown` (the default case in
    /// the service's mapping). With a portal URL it still routes to the portal.
    @MainActor
    func testUnknownStoreWithURLRoutesToPortal() async {
        let portal = URL(string: "https://pay.rev.cat/portal/legacy")!
        let harness = await makeStarted(entitlement: Entitlement(
            isPro: true,
            store: .unknown,
            managementURL: portal
        ))
        await waitUntil("Pro entitlement arrives") { harness.viewModel.isPro }

        let destination = await harness.viewModel.manageSubscription()

        XCTAssertEqual(destination, .portal(portal))
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
