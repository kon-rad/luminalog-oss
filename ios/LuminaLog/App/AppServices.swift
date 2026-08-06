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
    /// Durable local store of in-progress drafts (recovered on Home). Injected so
    /// the Create flow, Home, the `EntryProcessor`, and the `EntryFinalizer` all
    /// share ONE instance (retry-rebuild reads what Save retained).
    let drafts: DraftStore
    /// Live background-upload transport, exposed so the app can forward the
    /// system's background-URLSession completion handler to it (Task 6). Nil for
    /// `mocks()` (the mock transport isn't a `BackgroundUploadTransport`).
    let uploadTransport: BackgroundUploadTransport?
    /// One-time zero-knowledge key-migration helper (phase 1d, gated by
    /// `DevFlags.zkMigration` — OFF by default, deleted after the cutover).
    /// Built from `api` + the iCloud-Keychain-backed `SyncedKeychainStore`;
    /// nil when `api` is nil (`mocks()` — the migration path never runs there).
    let keyMigrator: ClientKeyEnroller?
    /// Narrow transport used to detect whether the signed-in user already has
    /// server-side wraps (i.e. migration already ran), independent of running
    /// the migration itself. Nil alongside `keyMigrator`.
    let keyMigrationTransport: KeyMigrationTransport?
    /// Resolves the per-user DEK at sign-in — enrolling a brand-new account that
    /// has no key at all, or asking for the recovery code when this device can't
    /// unlock. `KeyGate` renders its state; `SessionStore` waits on it before any
    /// encrypted read/write. See ADR-0114.
    let keyEnrollment: KeyEnrollmentService
    /// App-level observer that reconciles today's daily-goal progress + streak
    /// from the entries created today (self-healing across transcript retries,
    /// edits, and deletes). Started per signed-in user from `LuminaLogApp`.
    let dailyGoalReconciler: DailyGoalReconciler
    /// Re-transcribes voice/video entries whose transcript failed or came back
    /// degenerate, from the durable S3 audio, and refreshes their derived AI.
    /// Run once per signed-in user at launch from `LuminaLogApp`.
    let transcriptBackfiller: TranscriptBackfiller
    /// Headless entry-AI generation (summary/insights/prompts) — the launch sweep
    /// (`sweep()`) and the same instance the finalize pipeline uses to generate at
    /// save. Shared so both paths dedup against one another.
    let entryAIGenerator: EntryAIGenerator
    /// Encrypts + re-uploads webhook-staged voice recordings on next foreground.
    /// Nil when `api` is nil (`mocks()`), like other network-backed helpers.
    let voiceRecordingImporter: VoiceRecordingImporter?

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
        drafts: DraftStore,
        api: ProxyAPIClient? = nil,
        uploadTransport: BackgroundUploadTransport? = nil,
        keyMigrator: ClientKeyEnroller? = nil,
        keyMigrationTransport: KeyMigrationTransport? = nil,
        keyEnrollment: KeyEnrollmentService,
        entryAIGenerator: EntryAIGenerator
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
        self.drafts = drafts
        self.api = api
        self.uploadTransport = uploadTransport
        self.keyMigrator = keyMigrator
        self.keyMigrationTransport = keyMigrationTransport
        self.keyEnrollment = keyEnrollment
        self.entryAIGenerator = entryAIGenerator
        self.dailyGoalReconciler = DailyGoalReconciler(journals: journals, profiles: profiles)
        // Built here (not in the factories) from the injected repositories, mirroring
        // `dailyGoalReconciler`. The recoverer is the same fetch→decrypt→transcribe
        // path the manual Retry uses; `recover`'s `save` handles re-embedding/goal.
        let transcriptRecoverer = TranscriptRecoverer(
            journals: journals, profiles: profiles, ai: ai, media: media)
        self.transcriptBackfiller = TranscriptBackfiller(
            journals: journals, ai: ai, recover: { await transcriptRecoverer.recover($0) })
        self.voiceRecordingImporter = api.map {
            VoiceRecordingImporter(api: $0, media: media, keys: keys, repository: chats)
        }
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

        // Semantic RAG runs entirely SERVER-side (zero-knowledge): the client chunks
        // on-device (`JournalChunker`) and ships plaintext chunks to `/v1/rag/*`, where
        // Morpheus BGE-M3 embeds them; only vectors + metadata persist server-side. No
        // embedding model is ever downloaded to the device.
        let coordinator: SemanticIndexCoordinating = ServerSemanticIndex(rag: RagService(api: api))
        // Lifecycle hooks: create/edit → index, delete → remove (gated on
        // `DevFlags.aiModel1`, fire-and-forget).
        let journals = IndexingJournalRepository(base: baseJournals, coordinator: coordinator)

        // Model-1 (zero-knowledge) collaborators are injected so, when
        // `DevFlags.aiModel1` is ON, the AI service can gather PLAINTEXT context
        // (decrypted entries, bio/profile, chat history) on device and rank it with
        // the on-device semantic index. With the flag OFF (production) these are
        // unused and behavior is unchanged.
        let ai = ProxyAIService(
            api: api, journals: journals, profiles: profiles, chats: chats,
            dailyReports: dailyReports, coordinator: coordinator
        )
        let media = ProxyMediaUploader(api: api, keys: keys)
        let ocr = VisionOCRService()

        // Durable upload journal + background-session UploadManager (Tasks 3–5).
        // The AppDelegate/background-events + relaunch-resume hookup is Task 6.
        let uploadJournal = UploadJournal(directory: UploadJournal.defaultDirectory())
        // Auto-recovers a failed/empty voice transcript from the uploaded S3 audio
        // (the same fetch→decrypt→transcribe path the manual Retry button uses).
        let transcriptRecoverer = TranscriptRecoverer(
            journals: journals, profiles: profiles, ai: ai, media: media)
        // ONE shared draft store across Create/Home/processor/finalizer (retry
        // rebuild reads what Save retained).
        let drafts = DraftStore()
        // Headless entry-AI generation shared by the finalize pipeline (generate at
        // save) and the launch sweep. `UIKitBackgroundActivity` keeps a brief
        // backgrounding from aborting an in-flight generation.
        let entryAIGenerator = EntryAIGenerator(
            journals: journals, ai: ai, backgroundActivity: UIKitBackgroundActivity())
        let finalizer = EntryFinalizer(
            journals: journals, profiles: profiles, ai: ai,
            recoverer: transcriptRecoverer, drafts: drafts, aiGenerator: entryAIGenerator)
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
            onFinalize: { pending in await finalizer.finalize(pending) },
            // When an upload permanently fails (attempt cap hit), flip the entry to
            // `.failed` so it stops lying "Uploading…" and surfaces the Retry button.
            // The durable journal record is retained by UploadManager on this path,
            // so we can rebuild the entry shape from it.
            onPermanentFailure: { [uploadJournal] draftId in
                guard let pending = uploadJournal.entry(draftId: draftId) else { return }
                await finalizer.markFailed(pending)
            }
        )

        // One-time ZK migration collaborators (phase 1d). Reuses `migrationTransport`
        // built above for the read path. Actually running/prompting stays gated behind
        // `DevFlags.zkMigration` (OFF by default) in `LuminaLogApp`.
        let keyMigrator = ClientKeyEnroller(transport: migrationTransport, iCloudStore: SyncedKeychainStore())

        // First-run key enrollment + recovery-code unlock. Shares the enroller and
        // transport above: a brand-new account has neither an iCloud KEK nor server
        // wraps, so without this it could never obtain a DEK and every entry it
        // saved would fail closed, silently (ADR-0114).
        let keyEnrollment = KeyEnrollmentService(
            keys: keys, enroller: keyMigrator, transport: migrationTransport
        )

        // The Soul Constellation is now computed SERVER-side (from the indexed chunk
        // vectors, on `/v1/rag/index`); the Soul UI reads it via `GET /v1/soul`. No
        // on-device rebuild/sync remains.

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
            voice: VapiVoiceCallService(api: api, ai: ai, currentDEK: { [weak keys] in keys?.currentDataKey }),
            leaderboard: ProxyLeaderboardService(api: api),
            soul: ProxySoulService(api: api),
            consentStore: consentStore,
            consentService: consentService,
            entryProcessor: BackgroundEntryProcessor(
                dependencies: BackgroundEntryProcessor.Dependencies(
                    journals: journals, profiles: profiles, ai: ai, media: media, ocr: ocr,
                    transcoder: VideoTranscoder(), journal: uploadJournal,
                    uploadManager: uploadManager, finalizer: finalizer, drafts: drafts
                )
            ),
            drafts: drafts,
            api: api,
            uploadTransport: transport,
            keyMigrator: keyMigrator,
            keyMigrationTransport: migrationTransport,
            keyEnrollment: keyEnrollment,
            entryAIGenerator: entryAIGenerator
        )
    }

    /// One-time server-RAG migration: ship the existing local corpus to the server
    /// index (a no-op after it succeeds once / for a fresh install). Fired once per
    /// signed-in user from `LuminaLogApp`. New entries index themselves via
    /// `IndexingJournalRepository` on save/edit. See `ProxyAIService.warmSemanticIndex`.
    func migrateServerIndexIfNeeded() async {
        await ai.warmSemanticIndex()
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
        let drafts = DraftStore()
        let entryAIGenerator = EntryAIGenerator(journals: journals, ai: ai)
        let finalizer = EntryFinalizer(
            journals: journals, profiles: profiles, ai: ai, drafts: drafts,
            aiGenerator: entryAIGenerator)
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
            consentStore: consentStore,
            consentService: consentService,
            entryProcessor: BackgroundEntryProcessor(
                dependencies: BackgroundEntryProcessor.Dependencies(
                    journals: journals, profiles: profiles, ai: ai, media: media, ocr: ocr,
                    transcoder: VideoTranscoder(), journal: uploadJournal,
                    uploadManager: uploadManager, finalizer: finalizer, drafts: drafts
                )
            ),
            drafts: drafts,
            keyEnrollment: KeyEnrollmentService(
                keys: keys,
                enroller: ClientKeyEnroller(
                    transport: MockKeyMigrationTransport(), iCloudStore: KeychainStore()
                ),
                transport: MockKeyMigrationTransport()
            ),
            entryAIGenerator: entryAIGenerator
        )
    }
}

/// Demo/preview upload transport that reports success without any network I/O.
private final class AlwaysOKTransport: UploadTransport {
    func put(file: URL, to url: URL) async -> Int { 200 }
}

/// Demo/preview consent transport — `mocks()` has no live `ProxyAPIClient` to
/// PUT through, and previews/tests never exercise this path.
private final class NoOpConsentAPI: ConsentAPIPutting {
    func put(path: String, body: some Encodable) async throws {}
}
