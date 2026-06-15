import Foundation

/// Dependency container holding one implementation per service protocol.
/// Built once at launch and injected into the SwiftUI environment.
@MainActor
final class AppServices: ObservableObject {

    let auth: AuthService
    let keys: UserKeyStore
    let journals: JournalRepository
    let profiles: ProfileRepository
    let chats: ChatRepository
    let ai: AIService
    let media: MediaUploader
    let subscriptions: SubscriptionService
    let speech: SpeechTranscriber
    let ocr: OCRService
    let voice: VoiceCallService

    init(
        auth: AuthService,
        keys: UserKeyStore,
        journals: JournalRepository,
        profiles: ProfileRepository,
        chats: ChatRepository,
        ai: AIService,
        media: MediaUploader,
        subscriptions: SubscriptionService,
        speech: SpeechTranscriber,
        ocr: OCRService,
        voice: VoiceCallService
    ) {
        self.auth = auth
        self.keys = keys
        self.journals = journals
        self.profiles = profiles
        self.chats = chats
        self.ai = ai
        self.media = media
        self.subscriptions = subscriptions
        self.speech = speech
        self.ocr = ocr
        self.voice = voice
    }

    /// Production service wiring — always uses Firebase and real backends.
    static func live() -> AppServices {
        let auth = FirebaseAuthService()
        let api = ProxyAPIClient(
            baseURL: AppConfig.proxyBaseURL,
            tokenProvider: FirebaseTokenProvider()
        )
        let keys = UserKeyStore(provider: ProxyKeyProvider(api: api), secrets: KeychainStore())

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
            keys: keys,
            journals: FirestoreJournalRepository(auth: auth, keys: keys),
            profiles: FirestoreProfileRepository(auth: auth, keys: keys),
            chats: FirestoreChatRepository(auth: auth, keys: keys),
            ai: ProxyAIService(api: api),
            media: ProxyMediaUploader(api: api, keys: keys),
            subscriptions: subscriptions,
            speech: AppleSpeechTranscriber(),
            ocr: VisionOCRService(),
            voice: VapiVoiceCallService(api: api)
        )
    }

    /// All-mock wiring — previews and unit tests only.
    static func mocks() -> AppServices {
        let chats = MockChatRepository()
        let keys = UserKeyStore(provider: MockKeyProvider(), secrets: KeychainStore())
        return AppServices(
            auth: MockAuthService(signedIn: false),
            keys: keys,
            journals: MockJournalRepository(),
            profiles: MockProfileRepository(),
            chats: chats,
            ai: MockAIService(),
            media: MockMediaUploader(),
            subscriptions: MockSubscriptionService(),
            // Speech + OCR run fully on-device; real implementations work in
            // previews too. MockSpeechTranscriber/MockOCRService are for unit
            // tests only (deterministic scripted output).
            speech: AppleSpeechTranscriber(),
            ocr: VisionOCRService(),
            voice: MockVoiceCallService(chats: chats)
        )
    }
}
