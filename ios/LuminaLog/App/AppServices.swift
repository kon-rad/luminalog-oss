import Foundation

/// Dependency container holding one implementation per service protocol.
/// Built once at launch and injected into the SwiftUI environment.
@MainActor
final class AppServices: ObservableObject {

    let auth: AuthService
    let keys: UserKeyStore
    let journals: JournalRepository
    let profiles: ProfileRepository
    let dailyReports: DailyReportRepository
    let failedReports: FailedReportStore
    let chats: ChatRepository
    let ai: AIService
    let media: MediaUploader
    let subscriptions: SubscriptionService
    let credits: CreditService
    let speech: SpeechTranscriber
    let ocr: OCRService
    let voice: VoiceCallService
    let leaderboard: LeaderboardService
    let soul: SoulService
    /// Proxy client, exposed so views (e.g. the voice-call detail screen) can
    /// reach authed endpoints directly. Optional — mock wiring omits it.
    let api: ProxyAPIClient?
    /// Runs the post-save upload/transcribe pipeline in the background so the
    /// Create screen can dismiss immediately.
    let entryProcessor: EntryProcessor
    /// Shared "safe to interrupt the user" state (milestone gating).
    let activity = AppActivityMonitor()
    /// Durable local store of in-progress drafts (recovered on Home).
    let drafts = DraftStore()
    /// Live background-upload transport, exposed so the app can forward the
    /// system's background-URLSession completion handler to it (Task 6). Nil for
    /// `mocks()` (the mock transport isn't a `BackgroundUploadTransport`).
    let uploadTransport: BackgroundUploadTransport?
    /// One-time zero-knowledge key-migration helper (phase 1d, gated by
    /// `DevFlags.zkMigration` — OFF by default, deleted after the cutover).
    /// Built from `api` + the iCloud-Keychain-backed `SyncedKeychainStore`;
    /// nil when `api` is nil (`mocks()` — the migration path never runs there).
    let keyMigrator: KeyMigrator?
    /// Narrow transport used to detect whether the signed-in user already has
    /// server-side wraps (i.e. migration already ran), independent of running
    /// the migration itself. Nil alongside `keyMigrator`.
    let keyMigrationTransport: KeyMigrationTransport?

    init(
        auth: AuthService,
        keys: UserKeyStore,
        journals: JournalRepository,
        profiles: ProfileRepository,
        dailyReports: DailyReportRepository,
        failedReports: FailedReportStore,
        chats: ChatRepository,
        ai: AIService,
        media: MediaUploader,
        subscriptions: SubscriptionService,
        credits: CreditService,
        speech: SpeechTranscriber,
        ocr: OCRService,
        voice: VoiceCallService,
        leaderboard: LeaderboardService,
        soul: SoulService,
        entryProcessor: EntryProcessor,
        api: ProxyAPIClient? = nil,
        uploadTransport: BackgroundUploadTransport? = nil,
        keyMigrator: KeyMigrator? = nil,
        keyMigrationTransport: KeyMigrationTransport? = nil
    ) {
        self.auth = auth
        self.keys = keys
        self.journals = journals
        self.profiles = profiles
        self.dailyReports = dailyReports
        self.failedReports = failedReports
        self.chats = chats
        self.ai = ai
        self.media = media
        self.subscriptions = subscriptions
        self.credits = credits
        self.speech = speech
        self.ocr = ocr
        self.voice = voice
        self.leaderboard = leaderboard
        self.soul = soul
        self.entryProcessor = entryProcessor
        self.api = api
        self.uploadTransport = uploadTransport
        self.keyMigrator = keyMigrator
        self.keyMigrationTransport = keyMigrationTransport
    }

    /// Production service wiring — always uses Firebase and real backends.
    static func live() -> AppServices {
        let auth = FirebaseAuthService()
        let api = ProxyAPIClient(
            baseURL: AppConfig.proxyBaseURL,
            tokenProvider: FirebaseTokenProvider()
        )
        // Zero-knowledge read path (1d): try the iCloud-key path first (loads the DEK
        // from KEK_icloud + the server's client wraps — works for migrated users),
        // falling back to /bootstrap for un-migrated users. Once every account is
        // migrated + finalized, the fallback + ProxyKeyProvider + /bootstrap are removed
        // and ICloudKeyProvider stands alone.
        let migrationTransport = ProxyKeyMigrationTransport(api: api)
        let keys = UserKeyStore(
            provider: HybridKeyProvider(
                primary: ICloudKeyProvider(iCloudStore: SyncedKeychainStore(), transport: migrationTransport),
                fallback: ProxyKeyProvider(api: api)
            ),
            secrets: KeychainStore()
        )

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

        let baseJournals = FirestoreJournalRepository(auth: auth, keys: keys)
        let profiles = FirestoreProfileRepository(auth: auth, keys: keys)
        let dailyReports = FirestoreDailyReportRepository(auth: auth, keys: keys)
        let failedReports = FailedReportStore(auth: auth)
        let chats = FirestoreChatRepository(auth: auth, keys: keys)

        // Client-side semantic-search index (increment 1c-D / 19b). Always
        // constructed, but only USED when `DevFlags.aiModel1` is ON — with the flag
        // OFF, `ProxyAIService` never queries it and `IndexingJournalRepository`
        // never fires an indexing hook, so behavior is byte-identical to today.
        //
        // Self-activating embedder selection: the moment the distiluse artifact
        // is hosted and the Info.plist keys are filled, `AppConfig` resolves the
        // model + both tokenizer assets to non-nil and we build the real
        // `LazyONNXTextEmbedder` (downloads + verifies on first use, then runs ONNX);
        // otherwise we stay on the deterministic `StubTextEmbedder`. The `model:`
        // identifier is stored beside each vector blob, so switching embedders marks
        // stub-era vectors as stale (they get re-embedded), and the 512-dim is
        // identical across both so no blob is invalidated by dimension.
        // NOTE: this only changes WHICH embedder is constructed — usage stays gated by
        // `DevFlags.aiModel1` (OFF in production), so hosting the model alone changes
        // no behavior.
        let embedder: TextEmbedder
        let embedderModel: String
        if let modelAsset = AppConfig.embeddingModelAsset,
           let tokenizerAsset = AppConfig.embeddingTokenizerAsset,
           let tokenizerConfigAsset = AppConfig.embeddingTokenizerConfigAsset {
            embedder = LazyONNXTextEmbedder(
                modelAsset: modelAsset,
                tokenizerAsset: tokenizerAsset,
                tokenizerConfigAsset: tokenizerConfigAsset
            )
            embedderModel = "distiluse-multilingual-v1"
        } else {
            embedder = StubTextEmbedder()
            embedderModel = "stub-embedder-v1"
        }
        let coordinator = SemanticIndexCoordinator(
            embedder: embedder,
            service: ProxyVectorService(api: api),
            model: embedderModel,
            dek: { [weak keys] in keys?.currentDataKey }
        )
        // Lifecycle hooks: create/edit → index, delete → remove (flag-gated,
        // fire-and-forget). Pure pass-through with the flag OFF.
        let journals = IndexingJournalRepository(base: baseJournals, coordinator: coordinator)

        // Model-1 (zero-knowledge) collaborators are injected so, when
        // `DevFlags.aiModel1` is ON, the AI service can gather PLAINTEXT context
        // (decrypted entries, bio/profile, chat history) on device and rank it with
        // the on-device semantic index. With the flag OFF (production) these are
        // unused and behavior is unchanged.
        let ai = ProxyAIService(
            api: api, journals: journals, profiles: profiles, chats: chats,
            coordinator: coordinator
        )
        let media = ProxyMediaUploader(api: api, keys: keys)
        let ocr = VisionOCRService()

        // Durable upload journal + background-session UploadManager (Tasks 3–5).
        // The AppDelegate/background-events + relaunch-resume hookup is Task 6.
        let uploadJournal = UploadJournal(directory: UploadJournal.defaultDirectory())
        let finalizer = EntryFinalizer(journals: journals, profiles: profiles, ai: ai)
        let transport = BackgroundUploadTransport()
        // Instantiate the background session at launch so it can receive delegate
        // events (incl. the relaunch-delivered completion handler) right away.
        transport.activate()
        let uploadManager = UploadManager(
            journal: uploadJournal,
            transport: transport,
            presign: { [weak media] upload in
                guard let media else { throw MediaUploaderError.noUploadURL }
                let ext = (upload.encryptedPath as NSString).pathExtension
                // Passing the staged `s3Key` re-presigns the SAME object: the server
                // ignores `ext`/`bytes` when an `s3Key` is supplied (it reuses the key
                // verbatim), so the placeholder `"bin"`/`0` here are inert — key
                // stability across re-presigns depends on that server behavior.
                let (_, url) = try await media.presignUpload(
                    s3Key: upload.s3Key, kind: upload.kind, ext: ext.isEmpty ? "bin" : ext,
                    bytes: 0, journalId: upload.journalId)
                return url
            },
            onFinalize: { pending in await finalizer.finalize(pending) }
        )

        // One-time ZK migration collaborators (phase 1d). Reuses `migrationTransport`
        // built above for the read path. Actually running/prompting stays gated behind
        // `DevFlags.zkMigration` (OFF by default) in `LuminaLogApp`.
        let keyMigrator = KeyMigrator(transport: migrationTransport, iCloudStore: SyncedKeychainStore())

        return AppServices(
            auth: auth,
            keys: keys,
            journals: journals,
            profiles: profiles,
            dailyReports: dailyReports,
            failedReports: failedReports,
            chats: chats,
            ai: ai,
            media: media,
            subscriptions: subscriptions,
            credits: credits,
            speech: AppleSpeechTranscriber(),
            ocr: ocr,
            voice: VapiVoiceCallService(api: api, ai: ai),
            leaderboard: ProxyLeaderboardService(api: api),
            soul: ProxySoulService(api: api),
            entryProcessor: BackgroundEntryProcessor(
                dependencies: BackgroundEntryProcessor.Dependencies(
                    journals: journals, profiles: profiles, ai: ai, media: media, ocr: ocr,
                    transcoder: VideoTranscoder(), journal: uploadJournal,
                    uploadManager: uploadManager, finalizer: finalizer
                )
            ),
            api: api,
            uploadTransport: transport,
            keyMigrator: keyMigrator,
            keyMigrationTransport: migrationTransport
        )
    }

    /// All-mock wiring — previews and unit tests only.
    static func mocks() -> AppServices {
        let auth = MockAuthService(signedIn: false)
        let chats = MockChatRepository()
        let keys = UserKeyStore(provider: MockKeyProvider(), secrets: KeychainStore())
        let journals = MockJournalRepository()
        let profiles = MockProfileRepository()
        let dailyReports = MockDailyReportRepository()
        let failedReports = FailedReportStore(auth: auth, directory: FileManager.default.temporaryDirectory)
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
            auth: auth,
            keys: keys,
            journals: journals,
            profiles: profiles,
            dailyReports: dailyReports,
            failedReports: failedReports,
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
            leaderboard: MockLeaderboardService(),
            soul: MockSoulService(),
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
