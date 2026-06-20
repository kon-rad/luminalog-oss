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
    /// Proxy client, exposed so views (e.g. the voice-call detail screen) can
    /// reach authed endpoints directly. Optional — mock wiring omits it.
    let api: ProxyAPIClient?
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
        entryProcessor: EntryProcessor,
        api: ProxyAPIClient? = nil
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
        self.api = api
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

        // Durable upload journal + background-session UploadManager (Tasks 3–5).
        // The AppDelegate/background-events + relaunch-resume hookup is Task 6.
        let uploadJournal = UploadJournal(directory: UploadJournal.defaultDirectory())
        let finalizer = EntryFinalizer(journals: journals, profiles: profiles, ai: ai)
        let transport = BackgroundUploadTransport()
        let uploadManager = UploadManager(
            journal: uploadJournal,
            transport: transport,
            presign: { [weak media] upload in
                guard let media else { throw MediaUploaderError.noUploadURL }
                let ext = (upload.encryptedPath as NSString).pathExtension
                let (_, url) = try await media.presignUpload(
                    s3Key: upload.s3Key, kind: upload.kind, ext: ext.isEmpty ? "bin" : ext,
                    bytes: 0, journalId: upload.journalId)
                return url
            },
            onFinalize: { pending in await finalizer.finalize(pending) }
        )

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
                    journals: journals, profiles: profiles, ai: ai, media: media, ocr: ocr,
                    transcoder: VideoTranscoder(), journal: uploadJournal,
                    uploadManager: uploadManager, finalizer: finalizer
                )
            ),
            api: api
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

        // Mock upload pipeline: a transport that always "succeeds" so previews
        // never hit the network. Real wiring lives in `live()`.
        let uploadJournal = UploadJournal(
            directory: FileManager.default.temporaryDirectory
                .appendingPathComponent("MockUploads", isDirectory: true))
        let finalizer = EntryFinalizer(journals: journals, profiles: profiles, ai: ai)
        let uploadManager = UploadManager(
            journal: uploadJournal,
            transport: AlwaysOKTransport(),
            presign: { _ in URL(fileURLWithPath: "/dev/null") },
            onFinalize: { pending in await finalizer.finalize(pending) }
        )

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
                    journals: journals, profiles: profiles, ai: ai, media: media, ocr: ocr,
                    transcoder: VideoTranscoder(), journal: uploadJournal,
                    uploadManager: uploadManager, finalizer: finalizer
                )
            )
        )
    }
}

/// Demo/preview upload transport that reports success without any network I/O.
private final class AlwaysOKTransport: UploadTransport {
    func put(file: URL, to url: URL) async -> Int { 200 }
}
