import XCTest
import CryptoKit
@testable import LuminaLog

/// In-memory `SecretStore` so the session tests don't touch the real Keychain.
private final class MemorySecretStore: SecretStore {
    private var storage: [String: Data] = [:]
    func data(for account: String) -> Data? { storage[account] }
    func set(_ data: Data, for account: String) { storage[account] = data }
    func remove(for account: String) { storage[account] = nil }
}

/// SessionStore consumes the (mock) auth stream asynchronously, so tests
/// drive the mock and poll the published state with a bounded wait.
final class SessionStoreTests: XCTestCase {

    @MainActor
    private func makeStore(
        auth: MockAuthService,
        subscriptions: MockSubscriptionService,
        consentService: ConsentService? = nil,
        keys: UserKeyStore? = nil,
        transport: KeyMigrationTransport = MockKeyMigrationTransport(),
        profiles: ProfileRepository? = nil,
        onboarding: OnboardingStore? = nil
    ) -> SessionStore {
        let keys = keys ?? UserKeyStore(provider: MockKeyProvider(), secrets: MemorySecretStore())
        return SessionStore(
            auth: auth,
            keys: keys,
            keyEnrollment: KeyEnrollmentService(
                keys: keys,
                enroller: ClientKeyEnroller(transport: transport, iCloudStore: MemorySecretStore()),
                transport: transport,
                defaults: UserDefaults(suiteName: "test-keys-\(UUID().uuidString)")!
            ),
            profiles: profiles ?? MockProfileRepository(),
            subscriptions: subscriptions,
            onboarding: onboarding ?? OnboardingStore(
                defaults: UserDefaults(suiteName: "test-session-\(UUID().uuidString)")!
            ),
            consentService: consentService ?? ConsentService(
                api: SpyPutAPI(),
                store: ConsentStore(defaults: UserDefaults(suiteName: "test-consent-\(UUID().uuidString)")!)
            )
        )
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
    func testStartsLoadingThenSignedOutWhenStreamYieldsNil() async {
        let auth = MockAuthService(signedIn: false)
        let subscriptions = MockSubscriptionService()
        let store = makeStore(auth: auth, subscriptions: subscriptions)

        XCTAssertEqual(store.state, .loading, "Must not route before the first emission")

        await waitUntil("Initial nil uid routes to signedOut") {
            store.state == .signedOut
        }
        XCTAssertNil(store.profile)
        XCTAssertEqual(subscriptions.setUserCalls, [nil],
                       "Signed-out state aligns the subscription identity to nil")
    }

    @MainActor
    func testStartsSignedInWhenStreamYieldsUid() async {
        let auth = MockAuthService(signedIn: true)
        let subscriptions = MockSubscriptionService()
        let store = makeStore(auth: auth, subscriptions: subscriptions)

        await waitUntil("Initial uid routes to signedIn") {
            store.state == .signedIn(userId: MockData.userId)
        }
        await waitUntil("Profile stream populates the published profile") {
            store.profile != nil
        }
        XCTAssertEqual(store.profile?.id, MockData.userId)
        XCTAssertEqual(subscriptions.setUserCalls, [MockData.userId])
    }

    @MainActor
    func testDemoSignInThenSignOutRoundTrip() async {
        let auth = MockAuthService(signedIn: false)
        let subscriptions = MockSubscriptionService()
        let store = makeStore(auth: auth, subscriptions: subscriptions)

        await waitUntil("Starts signed out") { store.state == .signedOut }

        // The "Explore in Demo Mode" path.
        await auth.signInDemo()

        await waitUntil("Demo sign-in routes to signedIn") {
            store.state == .signedIn(userId: MockData.userId)
        }
        await waitUntil("Profile populated after sign-in") {
            store.profile != nil
        }
        await waitUntil("Subscription identity set to the demo uid") {
            subscriptions.setUserCalls == [nil, MockData.userId]
        }

        try? auth.signOut()

        await waitUntil("Sign-out routes back to signedOut") {
            store.state == .signedOut
        }
        XCTAssertNil(store.profile, "Profile must be cleared on sign-out")
        await waitUntil("Subscription identity cleared on sign-out") {
            subscriptions.setUserCalls == [nil, MockData.userId, nil]
        }
    }

    @MainActor
    func testDuplicateUidEmissionsAreIgnored() async {
        let auth = MockAuthService(signedIn: false)
        let subscriptions = MockSubscriptionService()
        let store = makeStore(auth: auth, subscriptions: subscriptions)

        await waitUntil("Starts signed out") { store.state == .signedOut }

        await auth.signInDemo()
        await waitUntil("Signed in") {
            store.state == .signedIn(userId: MockData.userId)
        }

        // Re-emitting the same uid (e.g. a token refresh) must not re-run
        // the sign-in work.
        await auth.signInDemo()
        try? await Task.sleep(nanoseconds: 100_000_000)

        XCTAssertEqual(subscriptions.setUserCalls, [nil, MockData.userId],
                       "Duplicate uid emissions must not call setUser again")
    }

    // MARK: - Consent-sync bootstrap wiring

    /// Sign-in bootstrap must mirror unsynced local consent to the server via
    /// `consentService.syncIfNeeded()`. This is the fix for Task 6's review
    /// finding: without it, a future refactor could silently drop or reorder
    /// the consent sync call with no test going red.
    @MainActor
    func testSignInBootstrapSyncsUnsyncedLocalConsent() async {
        let auth = MockAuthService(signedIn: false)
        let subscriptions = MockSubscriptionService()
        let putAPI = SpyPutAPI()
        let consentStore = ConsentStore(defaults: UserDefaults(suiteName: "test-consent-sync-\(UUID().uuidString)")!)
        consentStore.recordLocalConsent()
        XCTAssertTrue(consentStore.needsServerSync, "Precondition: local consent recorded but not yet synced")
        let consentService = ConsentService(api: putAPI, store: consentStore)
        let store = makeStore(auth: auth, subscriptions: subscriptions, consentService: consentService)

        await waitUntil("Starts signed out") { store.state == .signedOut }

        await auth.signInDemo()

        await waitUntil("Sign-in bootstrap PUTs the local consent to the server") {
            putAPI.puts.contains { $0.path == "/v1/consent" }
        }
        XCTAssertFalse(consentStore.needsServerSync,
                       "Bootstrap sync must mark local consent as synced")
    }

    @MainActor
    func testSignInBootstrapSkipsConsentSyncWhenNothingToSync() async {
        let auth = MockAuthService(signedIn: false)
        let subscriptions = MockSubscriptionService()
        let putAPI = SpyPutAPI()
        // No `recordLocalConsent()` call: needsServerSync stays false.
        let consentStore = ConsentStore(defaults: UserDefaults(suiteName: "test-consent-nosync-\(UUID().uuidString)")!)
        XCTAssertFalse(consentStore.needsServerSync, "Precondition: no local consent to sync")
        let consentService = ConsentService(api: putAPI, store: consentStore)
        let store = makeStore(auth: auth, subscriptions: subscriptions, consentService: consentService)

        await waitUntil("Starts signed out") { store.state == .signedOut }

        await auth.signInDemo()

        await waitUntil("Sign-in bootstrap completes") {
            store.state == .signedIn(userId: MockData.userId) && store.profile != nil
        }
        // Give any stray async bootstrap work a moment to settle before the
        // negative assertion.
        try? await Task.sleep(nanoseconds: 100_000_000)
        XCTAssertTrue(putAPI.puts.isEmpty,
                     "No unsynced local consent means bootstrap must not PUT /v1/consent")
    }

    // MARK: - Key-gated bootstrap

    /// Everything the sign-in bootstrap does (seed `users/{uid}`, merge the
    /// onboarding draft, stream the profile) writes or reads ENCRYPTED fields, so
    /// it must not run while the user is still locked out — it would just throw
    /// `keyNotLoaded` and mark the work done. It runs when `KeyGate` reports the
    /// unlock instead.
    @MainActor
    func testBootstrapIsDeferredUntilTheKeyIsUnlocked() async {
        // A device with no key at all, for an account that HAS server wraps →
        // the recovery-code path.
        let dek = SymmetricKey(size: .bits256)
        let transport = MockKeyMigrationTransport()
        try? await transport.uploadWraps(MultiWrappedDEK(
            icloud: WrappedKey.wrapping(dek: dek, under: SymmetricKey(size: .bits256)),
            recovery: RecoveryCode.wrap(dek: dek, code: "TEST-CODE")
        ))
        let keys = UserKeyStore(provider: AlwaysFailingKeyProvider(), secrets: MemorySecretStore())
        let auth = MockAuthService(signedIn: true)
        let store = makeStore(auth: auth, subscriptions: MockSubscriptionService(),
                              keys: keys, transport: transport)

        await waitUntil("Signed in even though the key is locked") {
            store.state == .signedIn(userId: MockData.userId)
        }
        try? await Task.sleep(nanoseconds: 150_000_000)
        XCTAssertNil(store.profile, "No profile stream while the journal is locked")

        // The user enters their recovery code; KeyGate then tells the session.
        await store.keyDidUnlockForTesting(keys: keys, dek: dek)

        await waitUntil("Profile stream starts once the key is available") {
            store.profile != nil
        }
    }

    // MARK: - Onboarding draft must not cross accounts

    @MainActor
    private func makeOnboardingStore() -> OnboardingStore {
        OnboardingStore(defaults: UserDefaults(suiteName: "test-onboarding-\(UUID().uuidString)")!)
    }

    /// The draft and the buffered Soul consent are PRE-AUTH buffers: they belong to
    /// the person who was at the device before anyone signed in. Left behind at
    /// sign-out (e.g. a merge that failed and stayed buffered), they would be
    /// applied to whoever signs in next — stamping one person's name, biography and
    /// public-NFT consent onto a different account.
    @MainActor
    func testSignOutClearsTheBufferedOnboardingDraft() async {
        let auth = MockAuthService(signedIn: false)
        let onboarding = makeOnboardingStore()
        let store = makeStore(auth: auth, subscriptions: MockSubscriptionService(), onboarding: onboarding)

        await waitUntil("Starts signed out") { store.state == .signedOut }
        await auth.signInDemo()
        await waitUntil("Signed in") { store.state == .signedIn(userId: MockData.userId) }

        // A draft still buffered while signed in — what a failed merge leaves behind.
        onboarding.saveDraft(["name": "Priya", "goals": "Ship the thing"])
        onboarding.setPendingSoulConsent(true)

        try? auth.signOut()

        await waitUntil("Sign-out routes to signedOut") { store.state == .signedOut }
        await waitUntil("Sign-out discards the buffered onboarding draft") {
            onboarding.loadDraft().isEmpty
        }
        XCTAssertNil(onboarding.pendingSoulConsent,
                     "Sign-out must discard buffered Soul consent — it is one person's answer")
    }

    /// The draft is written pre-auth and must survive an app kill (the flow is
    /// onboarding → relaunch → sign in). Only a real sign-out discards it, so the
    /// first `nil` emission on a cold launch must leave it alone.
    @MainActor
    func testColdStartWhileSignedOutKeepsTheBufferedDraft() async {
        let auth = MockAuthService(signedIn: false)
        let onboarding = makeOnboardingStore()
        onboarding.saveDraft(["name": "Ada"])
        onboarding.setPendingSoulConsent(true)

        let store = makeStore(auth: auth, subscriptions: MockSubscriptionService(), onboarding: onboarding)

        await waitUntil("Cold start routes to signedOut") { store.state == .signedOut }
        try? await Task.sleep(nanoseconds: 100_000_000)

        XCTAssertEqual(onboarding.loadDraft()["name"], "Ada",
                       "A cold start is not a sign-out — onboarding progress must survive")
        XCTAssertEqual(onboarding.pendingSoulConsent, true)
    }

    /// The reported bug: a draft that a previous account already claimed (its merge
    /// failed and stayed buffered) must never be merged into the next account.
    @MainActor
    func testDraftClaimedByAnotherAccountIsNeverMerged() async {
        let auth = MockAuthService(signedIn: false)
        let onboarding = makeOnboardingStore()
        onboarding.saveDraft(["name": "Priya", "goals": "Someone else's answers"])
        onboarding.claimDraft(for: "a-different-uid")
        // A fresh profile with a blank name: without the guard the draft fills it.
        let profiles = MockProfileRepository(profile: UserProfile(id: MockData.userId))
        let store = makeStore(auth: auth, subscriptions: MockSubscriptionService(),
                              profiles: profiles, onboarding: onboarding)

        await waitUntil("Starts signed out") { store.state == .signedOut }
        await auth.signInDemo()
        await waitUntil("Signed in") { store.state == .signedIn(userId: MockData.userId) }
        try? await Task.sleep(nanoseconds: 150_000_000)

        XCTAssertNil(profiles.lastSaved,
                     "Another account's onboarding answers must never be written to this profile")
        XCTAssertTrue(onboarding.loadDraft().isEmpty,
                      "The foreign draft must be discarded, not left to leak into a later account")
    }

    /// The normal path stays intact: an unclaimed draft still merges into the
    /// account that signs in first.
    @MainActor
    func testUnclaimedDraftStillMergesIntoTheFirstAccount() async {
        let auth = MockAuthService(signedIn: false)
        let onboarding = makeOnboardingStore()
        onboarding.saveDraft(["name": "Ada"])
        let profiles = MockProfileRepository(profile: UserProfile(id: MockData.userId))
        let store = makeStore(auth: auth, subscriptions: MockSubscriptionService(),
                              profiles: profiles, onboarding: onboarding)

        await waitUntil("Starts signed out") { store.state == .signedOut }
        await auth.signInDemo()

        await waitUntil("Onboarding answers reach the profile") {
            profiles.lastSaved?.displayName == "Ada"
        }
        XCTAssertTrue(onboarding.loadDraft().isEmpty, "A merged draft is cleared")
    }
}

/// A device that can't unlock anything — the production `ICloudKeyProvider`
/// behavior when this device holds no iCloud KEK.
private final class AlwaysFailingKeyProvider: KeyProvider {
    func fetchDataKey(userId: String) async throws -> Data {
        throw ICloudKeyProviderError.noICloudKey
    }
}

private extension SessionStore {
    /// Mirrors what `KeyGate` does after `submitRecoveryCode` succeeds: the DEK
    /// is installed, then the deferred bootstrap runs.
    @MainActor
    func keyDidUnlockForTesting(keys: UserKeyStore, dek: SymmetricKey) async {
        keys.install(dek: dek, userId: MockData.userId)
        await keyDidUnlock()
    }
}
