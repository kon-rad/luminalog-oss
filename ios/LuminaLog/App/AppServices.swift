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
    let credits: CreditService
    let speech: SpeechTranscriber
    let ocr: OCRService
    let voice: VoiceCallService
    /// Runs the post-save upload/transcribe pipeline in the background so the
    /// Create screen can dismiss immediately.
    let entryProcessor: EntryProcessor

    init(
        auth: AuthService,
        keys: UserKeyStore,
        journals: JournalRepository,
        profiles: ProfileRepository,
        chats: ChatRepository,
        ai: AIService,
        media: MediaUploader,
        subscriptions: SubscriptionService,
        credits: CreditService,
        speech: SpeechTranscriber,
        ocr: OCRService,
        voice: VoiceCallService,
        entryProcessor: EntryProcessor
    ) {
        self.auth = auth
        self.keys = keys
        self.journals = journals
        self.profiles = profiles
        self.chats = chats
        self.ai = ai
        self.media = media
        self.subscriptions = subscriptions
        self.credits = credits
        self.speech = speech
        self.ocr = ocr
        self.voice = voice
        self.entryProcessor = entryProcessor
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
        let credits: CreditService
        if let key = AppConfig.revenueCatAPIKey {
            subscriptions = RevenueCatSubscriptionService(
                apiKey: key,
                appUserId: auth.currentUserId
            )
            credits = RevenueCatCreditService(auth: auth)
        } else {
            subscriptions = MockSubscriptionService()
            credits = MockCreditService()
        }

        let journals = FirestoreJournalRepository(auth: auth, keys: keys)
        let profiles = FirestoreProfileRepository(auth: auth, keys: keys)
        let ai = ProxyAIService(api: api)
        let media = ProxyMediaUploader(api: api, keys: keys)
        let ocr = VisionOCRService()

        return AppServices(
            auth: auth,
            keys: keys,
            journals: journals,
            profiles: profiles,
            chats: FirestoreChatRepository(auth: auth, keys: keys),
            ai: ai,
            media: media,
            subscriptions: subscriptions,
            credits: credits,
            speech: AppleSpeechTranscriber(),
            ocr: ocr,
            voice: VapiVoiceCallService(api: api),
            entryProcessor: BackgroundEntryProcessor(
                dependencies: BackgroundEntryProcessor.Dependencies(
                    journals: journals, profiles: profiles, ai: ai, media: media, ocr: ocr
                )
            )
        )
    }

    /// All-mock wiring — previews and unit tests only.
    static func mocks() -> AppServices {
        let chats = MockChatRepository()
        let keys = UserKeyStore(provider: MockKeyProvider(), secrets: KeychainStore())
        let journals = MockJournalRepository()
        let profiles = MockProfileRepository()
        let ai = MockAIService()
        let media = MockMediaUploader()
        let ocr = VisionOCRService()
        return AppServices(
            auth: MockAuthService(signedIn: false),
            keys: keys,
            journals: journals,
            profiles: profiles,
            chats: chats,
            ai: ai,
            media: media,
            subscriptions: MockSubscriptionService(),
            credits: MockCreditService(),
            // Speech + OCR run fully on-device; real implementations work in
            // previews too. MockSpeechTranscriber/MockOCRService are for unit
            // tests only (deterministic scripted output).
            speech: AppleSpeechTranscriber(),
            ocr: ocr,
            voice: MockVoiceCallService(chats: chats),
            entryProcessor: BackgroundEntryProcessor(
                dependencies: BackgroundEntryProcessor.Dependencies(
                    journals: journals, profiles: profiles, ai: ai, media: media, ocr: ocr
                )
            )
        )
    }
}
