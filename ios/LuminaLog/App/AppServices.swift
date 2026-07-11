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
    /// Local record of AI-data-sharing consent (App Store 5.1.1/5.1.2) + the
    /// service that mirrors it to `PUT /v1/consent`. Always non-nil — `mocks()`
    /// wires a no-op transport since there's no live `ProxyAPIClient` there.
    let consentStore: ConsentStore
    let consentService: ConsentService
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
    /// On-device anchored soul constellation. Rebuilds automatically after each
    /// entry is indexed (reusing the semantic index's cached vector via a coalesced
    /// `scheduleRebuild()`), and can be rebuilt on demand from the DEBUG developer
    /// tools. Gated by `DevFlags.aiModel1` (the zero-knowledge path, on by default).
    let constellationCoordinator: ConstellationCoordinator
    /// App-level observer that reconciles today's daily-goal progress + streak
    /// from the entries created today (self-healing across transcript retries,
    /// edits, and deletes). Started per signed-in user from `LuminaLogApp`.
    let dailyGoalReconciler: DailyGoalReconciler

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
        consentStore: ConsentStore,
        consentService: ConsentService,
        entryProcessor: EntryProcessor,
        api: ProxyAPIClient? = nil,
        uploadTransport: BackgroundUploadTransport? = nil,
        keyMigrator: KeyMigrator? = nil,
        keyMigrationTransport: KeyMigrationTransport? = nil,
        constellationCoordinator: ConstellationCoordinator
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
        self.consentStore = consentStore
        self.consentService = consentService
        self.entryProcessor = entryProcessor
        self.api = api
        self.uploadTransport = uploadTransport
        self.keyMigrator = keyMigrator
        self.keyMigrationTransport = keyMigrationTransport
        self.constellationCoordinator = constellationCoordinator
        self.dailyGoalReconciler = DailyGoalReconciler(journals: journals, profiles: profiles)
    }

    /// Production service wiring — always uses Firebase and real backends.
    static func live() -> AppServices {
        let auth = FirebaseAuthService()
        let api = ProxyAPIClient(
            baseURL: AppConfig.proxyBaseURL,
            tokenProvider: FirebaseTokenProvider()
        )
        // Zero-knowledge key path: the DEK is loaded ON DEVICE from KEK_icloud (iCloud
        // Keychain) + the server's opaque client wraps (which the server cannot open).
        // There is NO server fallback — the legacy /bootstrap path (which handed the
        // server a DEK) was deleted at the cutover, so the server holds no key, ever.
        // AI-data-sharing consent (App Store 5.1.1/5.1.2): local record + the
        // service that mirrors it to the server so `requireAiConsent` passes.
        let consentStore = ConsentStore()
        let consentService = ConsentService(api: api, store: consentStore)
        // Client-side backstop (Task 7): if an AI call races ahead of the
        // consent sync and the server 403s for a missing consent record,
        // re-sync consent once and retry the request. Weak capture avoids a
        // retain cycle (`consentService.api` already holds `api`).
        api.consentRecovery = { [weak consentService] in try await consentService?.sync() }

        let migrationTransport = ProxyKeyMigrationTransport(api: api)
        let keys = UserKeyStore(
            provider: ICloudKeyProvider(iCloudStore: SyncedKeychainStore(), transport: migrationTransport),
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

        // Anchored soul constellation (on-device, gated by `DevFlags.aiModel1`).
        // Reuses the same embedder already selected above for the semantic index,
        // and the `journals` repository (whichever wraps `baseJournals`) so the
        // rebuild reads the full local corpus. `rebuildAndSync()` is a no-op with
        // the flag off, so this is inert until manually triggered from Settings.
        let constellationCoordinator = ConstellationCoordinator(
            builder: ConstellationBuilder(
                embedder: embedder,
                vectorProvider: { [weak coordinator] id in coordinator?.vector(for: id) }),
            sync: ProxyConstellationSyncService(api: api),
            entriesProvider: { [journals] in
                try await journals.fetchAllEntries().map {
                    (id: $0.id, text: $0.content, wordCount: $0.wordCount, createdAt: $0.createdAt)
                }
            })
        // Living sculpture: after each on-device index, rebuild reusing the
        // just-cached vector (no re-embed). Coalesced; `weak` breaks the
        // repo → coordinator → repo (entriesProvider captures `journals`) cycle.
        journals.onEntryIndexed = { [weak constellationCoordinator] _ in
            constellationCoordinator?.scheduleRebuild()
        }

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
            consentStore: consentStore,
            consentService: consentService,
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
            keyMigrationTransport: migrationTransport,
            constellationCoordinator: constellationCoordinator
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

        // No live `ProxyAPIClient` in mock wiring — mirror consent through a
        // no-op transport so `ConsentGate`/`ConsentService` are always usable.
        let consentStore = ConsentStore()
        let consentService = ConsentService(api: NoOpConsentAPI(), store: consentStore)

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

        // Anchored soul constellation: no live `ProxyAPIClient` in mock wiring, so
        // this is wired with a stub embedder + no-op sync (never exercised by
        // previews/unit tests; real behavior is covered by `live()` + the
        // dedicated ConstellationCoordinatorTests).
        let constellationCoordinator = ConstellationCoordinator(
            builder: ConstellationBuilder(embedder: StubTextEmbedder()),
            sync: NoOpConstellationSyncService(),
            entriesProvider: { [journals] in
                try await journals.fetchAllEntries().map {
                    (id: $0.id, text: $0.content, wordCount: $0.wordCount, createdAt: $0.createdAt)
                }
            })

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
            consentStore: consentStore,
            consentService: consentService,
            entryProcessor: BackgroundEntryProcessor(
                dependencies: BackgroundEntryProcessor.Dependencies(
                    journals: journals, profiles: profiles, ai: ai, media: media, ocr: ocr,
                    transcoder: VideoTranscoder(), journal: uploadJournal,
                    uploadManager: uploadManager, finalizer: finalizer
                )
            ),
            constellationCoordinator: constellationCoordinator
        )
    }
}

/// Demo/preview upload transport that reports success without any network I/O.
private final class AlwaysOKTransport: UploadTransport {
    func put(file: URL, to url: URL) async -> Int { 200 }
}

/// Demo/preview constellation sync that never leaves the device — `mocks()`
/// has no live `ProxyAPIClient` to upload through, and previews/tests never
/// exercise this path.
private final class NoOpConstellationSyncService: ConstellationSyncing {
    func upload(points: [ConstellationPoint]) async throws {}
}

/// Demo/preview consent transport — `mocks()` has no live `ProxyAPIClient` to
/// PUT through, and previews/tests never exercise this path.
private final class NoOpConsentAPI: ConsentAPIPutting {
    func put(path: String, body: some Encodable) async throws {}
}
