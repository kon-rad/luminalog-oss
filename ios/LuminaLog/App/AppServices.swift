import Foundation

/// Dependency container holding one implementation per service protocol.
/// Built once at launch and injected into the SwiftUI environment.
final class AppServices: ObservableObject {

    let auth: AuthService
    let journals: JournalRepository
    let profiles: ProfileRepository
    let chats: ChatRepository
    let ai: AIService
    let media: MediaUploader
    let subscriptions: SubscriptionService

    init(
        auth: AuthService,
        journals: JournalRepository,
        profiles: ProfileRepository,
        chats: ChatRepository,
        ai: AIService,
        media: MediaUploader,
        subscriptions: SubscriptionService
    ) {
        self.auth = auth
        self.journals = journals
        self.profiles = profiles
        self.chats = chats
        self.ai = ai
        self.media = media
        self.subscriptions = subscriptions
    }

    /// Production wiring when Firebase is configured; full mock wiring in
    /// demo mode (no GoogleService-Info.plist).
    static func live() -> AppServices {
        guard AppConfig.isFirebaseConfigured else { return mocks() }

        let auth = FirebaseAuthService()
        let api = ProxyAPIClient(
            baseURL: AppConfig.proxyBaseURL,
            tokenProvider: FirebaseTokenProvider()
        )

        let subscriptions: SubscriptionService
        if let key = AppConfig.revenueCatAPIKey {
            subscriptions = RevenueCatSubscriptionService(
                apiKey: key,
                appUserId: auth.currentUserId
            )
        } else {
            subscriptions = MockSubscriptionService()
        }

        return AppServices(
            auth: auth,
            journals: FirestoreJournalRepository(auth: auth),
            profiles: FirestoreProfileRepository(auth: auth),
            chats: FirestoreChatRepository(auth: auth),
            ai: ProxyAIService(api: api),
            media: ProxyMediaUploader(api: api),
            subscriptions: subscriptions
        )
    }

    /// All-mock wiring — demo mode, previews, and tests.
    static func mocks() -> AppServices {
        AppServices(
            auth: MockAuthService(),
            journals: MockJournalRepository(),
            profiles: MockProfileRepository(),
            chats: MockChatRepository(),
            ai: MockAIService(),
            media: MockMediaUploader(),
            subscriptions: MockSubscriptionService()
        )
    }
}
