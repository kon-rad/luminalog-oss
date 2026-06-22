import XCTest
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
        subscriptions: MockSubscriptionService
    ) -> SessionStore {
        SessionStore(
            auth: auth,
            keys: UserKeyStore(provider: MockKeyProvider(), secrets: MemorySecretStore()),
            profiles: MockProfileRepository(),
            subscriptions: subscriptions,
            onboarding: OnboardingStore(defaults: UserDefaults(suiteName: "test-session-\(UUID().uuidString)")!)
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
}
