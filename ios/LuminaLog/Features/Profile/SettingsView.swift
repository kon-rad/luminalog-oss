import SwiftUI

/// Settings screen (bottom-nav tab): compact profile card at the top navigates
/// to the full ProfileDetailView; below that, all settings sections live here.
struct SettingsView: View {

    @StateObject private var viewModel: ProfileViewModel
    /// Backs the Soul Wallet card (custodial wallet address + BaseScan links).
    @StateObject private var soulViewModel: SoulViewModel
    /// Only used by the DEBUG-only "Rebuild Soul Constellation" developer tool.
    @EnvironmentObject private var services: AppServices

    private let subscriptions: SubscriptionService
    private let credits: CreditService
    /// Only needed by the DEBUG-only onboarding replay; nil in the testing init.
    private let speech: SpeechTranscriber?
    private let leaderboard: LeaderboardService
    private let currentUserId: String?
    /// Only used by the DEBUG-only "Generate Daily Report" developer tool.
    private let ai: AIService

    @State private var showProfileDetail = false
    @State private var showLeaderboard = false
    @State private var showPaywall = false
    @State private var showCredits = false
    @State private var showConfig = false
    @State private var showSignOutDialog = false
    @State private var showDeleteExplainerAlert = false
    @State private var showDeleteFinalAlert = false
    /// DEBUG-only: drives the onboarding-replay full-screen cover.
    @State private var showOnboardingPreview = false
    /// DEBUG-only: true while the "Generate Daily Report" tool is regenerating.
    @State private var isGeneratingReport = false
    /// DEBUG-only: set when report generation fails, shown inline on the row.
    @State private var generateReportFailed = false
    /// DEBUG-only: true while the "Rebuild Soul Constellation" tool is running.
    @State private var isRebuildingConstellation = false
    /// DEBUG-only: last rebuild outcome ("N stars uploaded" / failure), shown inline.
    @State private var rebuildConstellationStatus: String?
    /// DEBUG-only: true while the "Re-index All Entries" server-RAG backfill is running.
    @State private var isReindexing = false
    /// DEBUG-only: live re-index progress / final outcome, shown inline.
    @State private var reindexStatus: String?

    @AppStorage(ThemeMode.storageKey) private var themeMode: String = ThemeMode.system.rawValue

    @Environment(\.openURL) private var openURL

    private let reminders: ReminderCoordinator
    @AppStorage(ReminderPrefs.enabledKey) private var reminderEnabled: Bool = false
    @AppStorage(ReminderPrefs.hourKey) private var reminderHour: Int = ReminderPrefs.defaultHour
    @AppStorage(ReminderPrefs.minuteKey) private var reminderMinute: Int = ReminderPrefs.defaultMinute
    @State private var reminderPermissionDenied = false

    init(
        auth: AuthService,
        profiles: ProfileRepository,
        subscriptions: SubscriptionService,
        credits: CreditService,
        media: MediaUploader,
        speech: SpeechTranscriber,
        reminders: ReminderCoordinator,
        leaderboard: LeaderboardService,
        ai: AIService,
        soul: SoulService
    ) {
        self.init(
            viewModel: ProfileViewModel(
                auth: auth,
                profiles: profiles,
                subscriptions: subscriptions,
                credits: credits,
                media: media,
                speech: speech
            ),
            subscriptions: subscriptions,
            credits: credits,
            reminders: reminders,
            speech: speech,
            leaderboard: leaderboard,
            ai: ai,
            soul: soul,
            currentUserId: auth.currentUserId
        )
    }

    init(
        viewModel: ProfileViewModel,
        subscriptions: SubscriptionService,
        credits: CreditService,
        reminders: ReminderCoordinator,
        speech: SpeechTranscriber? = nil,
        leaderboard: LeaderboardService = MockLeaderboardService(),
        ai: AIService,
        soul: SoulService = MockSoulService(),
        currentUserId: String? = nil
    ) {
        _viewModel = StateObject(wrappedValue: viewModel)
        _soulViewModel = StateObject(wrappedValue: SoulViewModel(service: soul))
        self.subscriptions = subscriptions
        self.credits = credits
        self.reminders = reminders
        self.speech = speech
        self.leaderboard = leaderboard
        self.ai = ai
        self.currentUserId = currentUserId
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Spacing.l) {
                    profileCard
                    leaderboardRow
                    if let message = viewModel.errorMessage {
                        errorBanner(message)
                    }
                    userInfoCard
                    walletCard
                    appearanceCard
                    reminderCard
                    settingsCard
                    legalCard
                    #if DEBUG
                    if DevFlags.devMode {
                        developerCard
                    }
                    #endif
                    versionFooter
                }
                .padding(.horizontal, Spacing.m)
                .padding(.top, Spacing.s)
                .padding(.bottom, AppTabBar.scrollBottomPadding)
            }
            .background(Color.appBackground.ignoresSafeArea())
            .navigationTitle("Settings")
            .scrollDismissesKeyboard(.interactively)
            .navigationDestination(isPresented: $showProfileDetail) {
                ProfileDetailView(viewModel: viewModel)
            }
            .navigationDestination(isPresented: $showLeaderboard) {
                LeaderboardView(service: leaderboard, currentUserId: currentUserId)
            }
        }
        .task { viewModel.start() }
        .task { await soulViewModel.load() }
        .sheet(isPresented: $showPaywall) {
            SubscriptionPaywall()
        }
        .sheet(isPresented: $showCredits) {
            CreditsView(credits: credits)
        }
        .sheet(isPresented: $showConfig) {
            if let profile = viewModel.profile {
                NavigationStack {
                    ConfigSettingsView(profile: profile, profiles: viewModel.profiles)
                }
            }
        }
        .confirmationDialog(
            "Sign out of LuminaLog?",
            isPresented: $showSignOutDialog,
            titleVisibility: .visible
        ) {
            Button("Sign Out", role: .destructive) { viewModel.signOut() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Your journal stays safely in your account.")
        }
        .alert("Delete your account?", isPresented: $showDeleteExplainerAlert) {
            Button("Continue", role: .destructive) { showDeleteFinalAlert = true }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This permanently deletes your account, every journal entry, all photos, videos and recordings, your chats, and your AI companion's memory. This cannot be undone.")
        }
        .alert("Are you absolutely sure?", isPresented: $showDeleteFinalAlert) {
            Button("Delete Everything", role: .destructive) {
                Task { await viewModel.deleteAccount() }
            }
            Button("Keep My Account", role: .cancel) {}
        } message: {
            Text("There's no way to recover your journal after this.")
        }
        #if DEBUG
        .fullScreenCover(isPresented: $showOnboardingPreview) {
            // Replay the full onboarding sequence against an isolated UserDefaults
            // suite so the dev preview never touches the user's real onboarding
            // completion flag or buffered draft. onComplete/onDismiss both dismiss.
            OnboardingView(
                store: OnboardingStore(
                    defaults: UserDefaults(suiteName: "ll-dev-onboarding-preview") ?? .standard
                ),
                speech: speech ?? AppleSpeechTranscriber(),
                onComplete: { showOnboardingPreview = false },
                onDismiss: { showOnboardingPreview = false }
            )
        }
        #endif
    }

    // MARK: - Profile card

    private var profileCard: some View {
        Button { showProfileDetail = true } label: {
            HStack(spacing: Spacing.m) {
                profileAvatar
                    .frame(width: 60, height: 60)
                    .clipShape(Circle())

                VStack(alignment: .leading, spacing: Spacing.xs) {
                    Text(viewModel.profile?.displayName ?? "")
                        .font(.system(.headline, design: .serif))
                        .foregroundStyle(Color.textPrimary)

                    if let firstLine = firstLineOfBio {
                        Text(firstLine)
                            .font(.captionText)
                            .foregroundStyle(Color.textSecondary)
                            .lineLimit(1)
                            .truncationMode(.tail)
                    }
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.textSecondary.opacity(0.6))
            }
            .padding(Spacing.m)
            .background(
                RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                    .fill(Color.cardBackground)
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Profile, \(viewModel.profile?.displayName ?? "")")
        .accessibilityHint("Opens your full profile")
    }

    // MARK: - Leaderboard row

    private var leaderboardRow: some View {
        Button { showLeaderboard = true } label: {
            HStack(spacing: Spacing.m) {
                Image(systemName: "trophy.fill")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Color.accentWarm)
                    .frame(width: 30, height: 30)
                    .background(
                        RoundedRectangle(cornerRadius: CornerRadius.small, style: .continuous)
                            .fill(Color.accentWarm.opacity(0.12))
                    )
                VStack(alignment: .leading, spacing: 2) {
                    Text("Leaderboard")
                        .font(.uiBody)
                        .foregroundStyle(Color.textPrimary)
                    Text("Streaks & words")
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.textSecondary.opacity(0.6))
            }
            .padding(Spacing.m)
            .background(
                RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                    .fill(Color.cardBackground)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Leaderboard")
        .accessibilityHint("Opens the streaks and words leaderboard")
    }

    @ViewBuilder
    private var profileAvatar: some View {
        if let url = viewModel.avatarURL {
            AsyncImage(url: url) { phase in
                if case .success(let image) = phase {
                    image
                        .resizable()
                        .scaledToFill()
                } else {
                    avatarPlaceholder
                }
            }
        } else {
            avatarPlaceholder
        }
    }

    private var avatarPlaceholder: some View {
        ZStack {
            Circle()
                .fill(Color.accentWarm.opacity(0.18))
            if viewModel.initials.isEmpty {
                Image(systemName: "person.fill")
                    .font(.system(size: 24, weight: .light))
                    .foregroundStyle(Color.accentWarm)
            } else {
                Text(viewModel.initials)
                    .font(.system(.title2, design: .serif).weight(.semibold))
                    .foregroundStyle(Color.accentWarm)
            }
        }
    }

    private var firstLineOfBio: String? {
        guard let bio = viewModel.profile?.biography, !bio.isEmpty else { return nil }
        return bio.components(separatedBy: .newlines)
            .first(where: { !$0.trimmingCharacters(in: .whitespaces).isEmpty })
    }

    // MARK: - User Information

    private var userInfoCard: some View {
        VStack(alignment: .leading, spacing: Spacing.s) {
            Text("User Information")
                .font(.sectionHeader)
                .foregroundStyle(Color.textPrimary)

            VStack(spacing: 0) {
                storageRow(icon: "photo", label: "Images",
                           count: viewModel.storageStats.imageCount,
                           bytes: viewModel.storageStats.imageBytes,
                           tint: Color.accentWarm)
                rowDivider
                storageRow(icon: "video", label: "Videos",
                           count: viewModel.storageStats.videoCount,
                           bytes: viewModel.storageStats.videoBytes,
                           tint: Color.tintVoice)
                rowDivider
                storageRow(icon: "waveform", label: "Audio",
                           count: viewModel.storageStats.audioCount,
                           bytes: viewModel.storageStats.audioBytes,
                           tint: Color.textSecondary)
                rowDivider
                HStack(spacing: Spacing.m) {
                    settingsIcon("clock", tint: .textSecondary)
                    Text("Time in app")
                        .font(.uiBody)
                        .foregroundStyle(Color.textPrimary)
                    Spacer()
                    Text(viewModel.formattedTimeInApp)
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                }
                .padding(Spacing.m)
            }
            .background(
                RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                    .fill(Color.cardBackground)
            )
        }
    }

    // MARK: - Soul Wallet

    /// Custodial wallet for the user's LuminaSoul: the full address (selectable,
    /// scales down rather than truncating) plus BaseScan links to the wallet and,
    /// once minted, the token. Rendered as soon as the wallet is provisioned —
    /// before and independent of minting.
    @ViewBuilder
    private var walletCard: some View {
        if let wallet = soulViewModel.payload?.walletAddress {
            VStack(alignment: .leading, spacing: Spacing.s) {
                Text("Soul Wallet")
                    .font(.sectionHeader)
                    .foregroundStyle(Color.textPrimary)

                // Public / on-chain disclosure (privacy).
                Text("Your Soul is a public NFT on the Base blockchain. It publishes your first name and journaling stats — days journaled, current & longest streak, and total word count — on-chain, where anyone can view them. It never includes your journal entries.")
                    .font(.footnote)
                    .foregroundStyle(Color.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)

                VStack(spacing: 0) {
                    VStack(alignment: .leading, spacing: Spacing.xs) {
                        HStack(spacing: Spacing.m) {
                            settingsIcon("wallet.pass", tint: .accentWarm)
                            Text("Wallet Address")
                                .font(.uiBody)
                                .foregroundStyle(Color.textPrimary)
                            Spacer()
                        }
                        Text(wallet)
                            .font(.system(size: 12, weight: .medium, design: .monospaced))
                            .foregroundStyle(Color.textSecondary)
                            .lineLimit(1)
                            .minimumScaleFactor(0.5)
                            .textSelection(.enabled)
                            .padding(.leading, Spacing.m + 30 + Spacing.m)
                    }
                    .padding(Spacing.m)

                    if let url = soulViewModel.payload?.walletExplorerURL {
                        rowDivider
                        legalLinkRow(icon: "safari", label: "View Wallet on BaseScan", url: url)
                    }
                    if let url = soulViewModel.payload?.nft?.explorerURL {
                        rowDivider
                        legalLinkRow(icon: "seal", label: "View NFT on BaseScan", url: url)
                    }
                }
                .background(
                    RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                        .fill(Color.cardBackground)
                )
            }
        }
    }

    private func storageRow(icon: String, label: String, count: Int, bytes: Int, tint: Color) -> some View {
        HStack(spacing: Spacing.m) {
            settingsIcon(icon, tint: tint)
            Text(label)
                .font(.uiBody)
                .foregroundStyle(Color.textPrimary)
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(ByteCountFormatter.string(fromByteCount: Int64(bytes), countStyle: .file))
                    .font(.captionText)
                    .foregroundStyle(Color.textPrimary)
                Text("\(count) file\(count == 1 ? "" : "s")")
                    .font(.system(size: 11))
                    .foregroundStyle(Color.textSecondary)
            }
        }
        .padding(Spacing.m)
    }

    // MARK: - Appearance

    private var appearanceCard: some View {
        VStack(alignment: .leading, spacing: Spacing.s) {
            Text("Appearance")
                .font(.sectionHeader)
                .foregroundStyle(Color.textPrimary)

            VStack(alignment: .leading, spacing: Spacing.s) {
                HStack(spacing: Spacing.m) {
                    settingsIcon("circle.lefthalf.filled", tint: .accentWarm)
                    Text("Theme")
                        .font(.uiBody)
                        .foregroundStyle(Color.textPrimary)
                    Spacer()
                }

                Picker("Theme", selection: $themeMode) {
                    ForEach(ThemeMode.allCases) { mode in
                        Text(mode.label).tag(mode.rawValue)
                    }
                }
                .pickerStyle(.segmented)
                .accessibilityLabel("App theme")
            }
            .padding(Spacing.m)
            .background(
                RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                    .fill(Color.cardBackground)
            )
        }
    }

    // MARK: - Daily reminder

    private var reminderCard: some View {
        VStack(alignment: .leading, spacing: Spacing.s) {
            Text("Daily Reminder")
                .font(.sectionHeader)
                .foregroundStyle(Color.textPrimary)

            VStack(spacing: 0) {
                HStack(spacing: Spacing.m) {
                    settingsIcon("bell.badge", tint: .accentWarm)
                    Text("Daily reminder")
                        .font(.uiBody)
                        .foregroundStyle(Color.textPrimary)
                    Spacer()
                    Toggle("Daily reminder", isOn: reminderToggleBinding)
                        .tint(Color.accentWarm)
                        .labelsHidden()
                }
                .padding(Spacing.m)

                if reminderEnabled {
                    rowDivider
                    HStack(spacing: Spacing.m) {
                        settingsIcon("clock", tint: .textSecondary)
                        Text("Time")
                            .font(.uiBody)
                            .foregroundStyle(Color.textPrimary)
                        Spacer()
                        DatePicker(
                            "Reminder time",
                            selection: reminderTimeBinding,
                            displayedComponents: .hourAndMinute
                        )
                        .labelsHidden()
                    }
                    .padding(Spacing.m)
                }
            }
            .background(
                RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                    .fill(Color.cardBackground)
            )

            Text(reminderPermissionDenied
                 ? "Enable notifications for LuminaLog in Settings to get reminders."
                 : "Goal: \(DailyGoal.wordTarget) words ≈ 3 handwritten pages.")
                .font(.captionText)
                .foregroundStyle(reminderPermissionDenied ? Color.danger : Color.textSecondary)
        }
    }

    private var reminderToggleBinding: Binding<Bool> {
        Binding(
            get: { reminderEnabled },
            set: { newValue in
                if newValue {
                    Task {
                        let granted = await reminders.enableReminders(profile: viewModel.profile)
                        reminderPermissionDenied = !granted
                        reminderEnabled = granted
                    }
                } else {
                    reminderPermissionDenied = false
                    Task { await reminders.disableReminders() }
                }
            }
        )
    }

    private var reminderTimeBinding: Binding<Date> {
        Binding(
            get: {
                Calendar.current.date(
                    bySettingHour: reminderHour, minute: reminderMinute, second: 0, of: Date()
                ) ?? Date()
            },
            set: { newDate in
                let comps = Calendar.current.dateComponents([.hour, .minute], from: newDate)
                reminderHour = comps.hour ?? ReminderPrefs.defaultHour
                reminderMinute = comps.minute ?? ReminderPrefs.defaultMinute
                Task { await reminders.refresh(profile: viewModel.profile) }
            }
        )
    }

    // MARK: - Settings

    private var settingsCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Settings")
                .font(.sectionHeader)
                .foregroundStyle(Color.textPrimary)
                .padding(.bottom, Spacing.s)

            VStack(spacing: 0) {
                subscriptionRow
                rowDivider
                aiConfigRow
                rowDivider
                voiceCreditsRow
                rowDivider
                signOutRow
                rowDivider
                deleteAccountRow
            }
            .background(
                RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                    .fill(Color.cardBackground)
            )
        }
    }

    // MARK: - Legal

    private var legalCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Legal")
                .font(.sectionHeader)
                .foregroundStyle(Color.textPrimary)
                .padding(.bottom, Spacing.s)

            VStack(spacing: 0) {
                legalLinkRow(icon: "lock.shield", label: "Privacy Policy",
                             url: URL(string: "https://luminalog.com/privacy")!)
                rowDivider
                legalLinkRow(icon: "doc.text", label: "Terms of Use",
                             url: URL(string: "https://luminalog.com/terms")!)
                rowDivider
                legalLinkRow(icon: "envelope", label: "Support",
                             url: URL(string: "https://luminalog.com/support")!)
            }
            .background(
                RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                    .fill(Color.cardBackground)
            )
        }
    }

    private func legalLinkRow(icon: String, label: String, url: URL) -> some View {
        Button { openURL(url) } label: {
            HStack(spacing: Spacing.m) {
                settingsIcon(icon, tint: .textSecondary)
                Text(label)
                    .font(.uiBody)
                    .foregroundStyle(Color.textPrimary)
                Spacer()
                Image(systemName: "arrow.up.right")
                    .font(.system(size: 12, weight: .medium))
                    .foregroundStyle(Color.textSecondary.opacity(0.6))
            }
            .padding(Spacing.m)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
        .accessibilityHint("Opens in Safari")
    }

    #if DEBUG
    // MARK: - Developer (DEBUG-only, gated by DevFlags.devMode)

    /// Dev-only tools surfaced inside Settings. Compiled out of release builds
    /// and additionally hidden at runtime unless `DevFlags.devMode` is set.
    private var developerCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Developer")
                .font(.sectionHeader)
                .foregroundStyle(Color.textPrimary)
                .padding(.bottom, Spacing.s)

            VStack(spacing: 0) {
                showOnboardingRow
                rowDivider
                generateReportRow
                rowDivider
                rebuildConstellationRow
                rowDivider
                reindexEntriesRow
            }
            .background(
                RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                    .fill(Color.cardBackground)
            )
        }
    }

    /// Generates a *fresh* report for the current day from the latest data and
    /// appends it as a new card in Home's Daily Reflections section. Each press
    /// adds another independently-previewable card (it never overwrites the
    /// previous one), so the feature can be exercised on demand.
    private var generateReportRow: some View {
        Button {
            generateDailyReport()
        } label: {
            HStack(spacing: Spacing.m) {
                settingsIcon("sparkles.rectangle.stack", tint: .accentWarm)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Generate Daily Report")
                        .font(.uiBody)
                        .foregroundStyle(Color.textPrimary)
                    Text(generateReportFailed
                         ? "Generation failed — tap to retry"
                         : "Append a fresh insights card to Home")
                        .font(.captionText)
                        .foregroundStyle(generateReportFailed ? Color.danger : Color.textSecondary)
                }
                Spacer()
                if isGeneratingReport {
                    ProgressView()
                        .tint(Color.accentWarm)
                } else {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.textSecondary.opacity(0.6))
                }
            }
            .padding(Spacing.m)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isGeneratingReport)
        .accessibilityLabel("Generate Daily Report, append a fresh insights card to Home")
    }

    /// Force-generates a fresh report for today via the same `ai.generateDailyReport`
    /// the milestone flow uses, which saves a new document to Firestore. Posts
    /// `.dailyReportGenerated` so Home reloads its feed and the new card appears
    /// in the Daily Reflections section — stored and rendered identically to any
    /// other daily report.
    private func generateDailyReport() {
        guard !isGeneratingReport else { return }
        isGeneratingReport = true
        generateReportFailed = false
        Task {
            defer { isGeneratingReport = false }
            do {
                _ = try await ai.generateDailyReport(date: nil, force: true)
                NotificationCenter.default.post(name: .dailyReportGenerated, object: nil)
            } catch {
                generateReportFailed = true
            }
        }
    }

    /// One-shot rebuild of the anchored soul constellation from the full local
    /// journal corpus, gated by `DevFlags.aiModel1` (`rebuildAndSync()` is a
    /// no-op with the flag off). This is the one-time rewrite for the existing
    /// account once the flag is flipped on.
    private var rebuildConstellationRow: some View {
        Button {
            rebuildConstellation()
        } label: {
            HStack(spacing: Spacing.m) {
                settingsIcon("sparkles.square.filled.on.square", tint: .accentWarm)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Rebuild Soul Constellation")
                        .font(.uiBody)
                        .foregroundStyle(Color.textPrimary)
                    Text(rebuildConstellationStatus ?? "Re-derive stars from the local corpus (requires DevFlags.aiModel1)")
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                }
                Spacer()
                if isRebuildingConstellation {
                    ProgressView()
                        .tint(Color.accentWarm)
                } else {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.textSecondary.opacity(0.6))
                }
            }
            .padding(Spacing.m)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isRebuildingConstellation)
        .accessibilityLabel("Rebuild Soul Constellation, re-derive stars from the local corpus")
    }

    /// Runs `ConstellationCoordinator.rebuildAndSync()` (no-op unless
    /// `DevFlags.aiModel1` is on) and surfaces the resulting star count inline.
    private func rebuildConstellation() {
        guard !isRebuildingConstellation else { return }
        isRebuildingConstellation = true
        rebuildConstellationStatus = nil
        Task {
            defer { isRebuildingConstellation = false }
            do {
                let count = try await services.constellationCoordinator.rebuildAndSync()
                rebuildConstellationStatus = DevFlags.aiModel1
                    ? "Uploaded \(count) star\(count == 1 ? "" : "s")"
                    : "No-op — DevFlags.aiModel1 is off"
            } catch {
                rebuildConstellationStatus = "Rebuild failed — tap to retry"
            }
        }
    }

    /// One-tap migration: re-index the ENTIRE journal corpus into the server RAG
    /// index (Morpheus BGE-M3 → Chroma). Because entries are zero-knowledge encrypted,
    /// the server can't re-index them itself — this fetches + decrypts every entry
    /// on-device, chunks it (`JournalChunker`), and sends the chunks to
    /// `PUT /v1/rag/index` via `ServerSemanticIndex`. Sequential to respect provider
    /// rate limits; surfaces live N/total progress inline.
    private var reindexEntriesRow: some View {
        Button {
            reindexAllEntries()
        } label: {
            HStack(spacing: Spacing.m) {
                settingsIcon("arrow.triangle.2.circlepath", tint: .accentWarm)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Re-index All Entries")
                        .font(.uiBody)
                        .foregroundStyle(Color.textPrimary)
                    Text(reindexStatus ?? "Rebuild the server RAG index from every entry (Morpheus embeddings)")
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                }
                Spacer()
                if isReindexing {
                    ProgressView()
                        .tint(Color.accentWarm)
                } else {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(Color.textSecondary.opacity(0.6))
                }
            }
            .padding(Spacing.m)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(isReindexing)
        .accessibilityLabel("Re-index all entries into the server RAG index")
    }

    /// Fetches + decrypts the full corpus on-device and (re)indexes each entry into
    /// the server RAG via `ServerSemanticIndex` (built from the live `ProxyAPIClient`).
    /// Per-entry failures are counted and reported rather than aborting the migration.
    private func reindexAllEntries() {
        guard !isReindexing else { return }
        guard let api = services.api else {
            reindexStatus = "No API client available"
            return
        }
        isReindexing = true
        reindexStatus = "Loading entries…"
        Task {
            defer { isReindexing = false }
            do {
                let entries = try await services.journals.fetchAllEntries()
                if entries.isEmpty {
                    reindexStatus = "No entries to index"
                    return
                }
                let index = ServerSemanticIndex(rag: RagService(api: api))
                var done = 0
                var failed = 0
                var firstError: String?
                for entry in entries {
                    do {
                        try await index.indexEntry(id: entry.id, text: entry.content)
                    } catch {
                        failed += 1
                        if firstError == nil { firstError = error.localizedDescription }
                    }
                    done += 1
                    reindexStatus = "Re-indexing \(done)/\(entries.count)…"
                        + (failed > 0 ? " (\(failed) failed)" : "")
                }
                let ok = entries.count - failed
                reindexStatus = failed == 0
                    ? "Done — re-indexed \(ok) entr\(ok == 1 ? "y" : "ies")"
                    : "\(ok) ok, \(failed) failed — \(firstError ?? "unknown error") (tap to retry)"
            } catch {
                reindexStatus = "Re-index failed — tap to retry"
            }
        }
    }

    private var showOnboardingRow: some View {
        Button {
            showOnboardingPreview = true
        } label: {
            HStack(spacing: Spacing.m) {
                settingsIcon("arrow.counterclockwise", tint: .accentWarm)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Show Onboarding")
                        .font(.uiBody)
                        .foregroundStyle(Color.textPrimary)
                    Text("Replay the full onboarding sequence")
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.textSecondary.opacity(0.6))
            }
            .padding(Spacing.m)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Show Onboarding, replay the full onboarding sequence")
    }
    #endif

    private var subscriptionRow: some View {
        Button {
            showPaywall = true
        } label: {
            HStack(spacing: Spacing.m) {
                settingsIcon("sparkles", tint: .accentWarm)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Subscription")
                        .font(.uiBody)
                        .foregroundStyle(Color.textPrimary)
                    Text(viewModel.subscriptionLabel)
                        .font(.captionText)
                        .foregroundStyle(viewModel.isPro ? Color.accentWarm : Color.textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.textSecondary.opacity(0.6))
            }
            .padding(Spacing.m)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Subscription, \(viewModel.subscriptionLabel)")
    }

    private var aiConfigRow: some View {
        Button {
            showConfig = true
        } label: {
            HStack(spacing: Spacing.m) {
                settingsIcon("slider.horizontal.3", tint: .accentWarm)
                VStack(alignment: .leading, spacing: 2) {
                    Text("AI Summary Config")
                        .font(.uiBody)
                        .foregroundStyle(Color.textPrimary)
                    Text("Length & system prompt")
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.textSecondary.opacity(0.6))
            }
            .padding(Spacing.m)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("AI Summary Config, length and system prompt")
    }

    private var voiceCreditsRow: some View {
        Button {
            showCredits = true
        } label: {
            HStack(spacing: Spacing.m) {
                settingsIcon("phone.and.waveform.fill", tint: .tintVoice)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Voice Credits")
                        .font(.uiBody)
                        .foregroundStyle(Color.textPrimary)
                    Text("Buy minutes for voice conversations")
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                }
                Spacer()
                Text("\(viewModel.creditBalance) credits")
                    .font(.captionText.weight(.medium))
                    .foregroundStyle(Color.textSecondary)
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.textSecondary.opacity(0.5))
            }
            .padding(.horizontal, Spacing.m)
            .frame(minHeight: 56)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Voice Credits, \(viewModel.creditBalance) credits, buy minutes for voice conversations")
    }

    private var signOutRow: some View {
        Button {
            showSignOutDialog = true
        } label: {
            HStack(spacing: Spacing.m) {
                settingsIcon("rectangle.portrait.and.arrow.right", tint: .textSecondary)
                Text("Sign Out")
                    .font(.uiBody)
                    .foregroundStyle(Color.textPrimary)
                Spacer()
            }
            .padding(Spacing.m)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private var deleteAccountRow: some View {
        Button {
            showDeleteExplainerAlert = true
        } label: {
            HStack(spacing: Spacing.m) {
                settingsIcon("trash", tint: .danger)
                Text("Delete Account")
                    .font(.uiBody)
                    .foregroundStyle(Color.danger)
                Spacer()
                if viewModel.isDeletingAccount {
                    ProgressView()
                        .tint(Color.danger)
                }
            }
            .padding(Spacing.m)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(viewModel.isDeletingAccount)
        .accessibilityLabel("Delete account")
        .accessibilityHint("Permanently deletes your account and all journal data")
    }

    // MARK: - Helpers

    private func settingsIcon(_ systemName: String, tint: Color) -> some View {
        Image(systemName: systemName)
            .font(.system(size: 15, weight: .medium))
            .foregroundStyle(tint)
            .frame(width: 30, height: 30)
            .background(
                RoundedRectangle(cornerRadius: CornerRadius.small, style: .continuous)
                    .fill(tint.opacity(0.12))
            )
    }

    private var rowDivider: some View {
        Divider()
            .padding(.leading, Spacing.m + 30 + Spacing.m)
    }

    private func errorBanner(_ message: String) -> some View {
        HStack(spacing: Spacing.s) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Color.danger)
            Text(message)
                .font(.captionText)
                .foregroundStyle(Color.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button {
                viewModel.errorMessage = nil
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.textSecondary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Dismiss error")
        }
        .padding(Spacing.m)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous)
                .fill(Color.danger.opacity(0.1))
        )
    }

    private var versionFooter: some View {
        VStack(spacing: 2) {
            Text("LuminaLog v\(viewModel.appVersion)")
                .font(.captionText)
                .foregroundStyle(Color.textSecondary.opacity(0.8))
            Text(viewModel.gitCommit)
                .font(.captionText)
                .foregroundStyle(Color.textSecondary.opacity(0.45))
                .fontDesign(.monospaced)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, Spacing.s)
    }
}

// MARK: - Previews

#Preview("Default") {
    SettingsView(
        auth: MockAuthService(signedIn: true),
        profiles: MockProfileRepository(),
        subscriptions: MockSubscriptionService(),
        credits: MockCreditService(balance: 45),
        media: MockMediaUploader(),
        speech: AppleSpeechTranscriber(),
        reminders: ReminderCoordinator(),
        leaderboard: MockLeaderboardService(),
        ai: MockAIService(),
        soul: MockSoulService()
    )
    .environmentObject(AppServices.mocks())
}

#Preview("Pro") {
    SettingsView(
        auth: MockAuthService(signedIn: true),
        profiles: MockProfileRepository(),
        subscriptions: MockSubscriptionService(entitlement: Entitlement(
            isPro: true,
            productId: "com.luminalog.pro.yearly",
            expiresAt: Calendar.current.date(byAdding: .year, value: 1, to: Date())
        )),
        credits: MockCreditService(balance: 120),
        media: MockMediaUploader(),
        speech: AppleSpeechTranscriber(),
        reminders: ReminderCoordinator(),
        leaderboard: MockLeaderboardService(),
        ai: MockAIService(),
        soul: MockSoulService()
    )
    .environmentObject(AppServices.mocks())
}

#Preview("Dark") {
    SettingsView(
        auth: MockAuthService(signedIn: true),
        profiles: MockProfileRepository(),
        subscriptions: MockSubscriptionService(),
        credits: MockCreditService(balance: 0),
        media: MockMediaUploader(),
        speech: AppleSpeechTranscriber(),
        reminders: ReminderCoordinator(),
        leaderboard: MockLeaderboardService(),
        ai: MockAIService(),
        soul: MockSoulService()
    )
    .environmentObject(AppServices.mocks())
    .preferredColorScheme(.dark)
}
