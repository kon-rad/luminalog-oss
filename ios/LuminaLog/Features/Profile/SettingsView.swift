import SwiftUI
import UserNotifications

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
    /// Reopens a draft in the Create flow from the recordings recovery screen.
    private let onResumeDraft: (String) -> Void

    @State private var showProfileDetail = false
    @State private var showLeaderboard = false
    @State private var showPaywall = false
    @State private var showNotManageableAlert = false
    @State private var showCredits = false
    @State private var showConfig = false
    @State private var showRecordings = false
    @State private var showMessageHistory = false
    @State private var showSignOutDialog = false
    @State private var showDeleteExplainerAlert = false
    @State private var showDeleteFinalAlert = false
    /// DEBUG-only: drives the onboarding-replay full-screen cover.
    @State private var showOnboardingPreview = false
    /// DEBUG-only: drives the Hermes Bridge developer panel sheet.
    @State private var showHermesBridge = false
    /// DEBUG-only: true while the "Generate Daily Report" tool is regenerating.
    @State private var isGeneratingReport = false
    /// DEBUG-only: set when report generation fails, shown inline on the row.
    @State private var generateReportFailed = false
    /// DEBUG-only: true while the "Re-index All Entries" server-RAG backfill is running.
    @State private var isReindexing = false
    /// DEBUG-only: live re-index progress / final outcome, shown inline.
    @State private var reindexStatus: String?
    /// DEBUG-only: true while the "Backfill 3 Days of Mirrors" tool is writing.
    @State private var isBackfillingMirrors = false
    /// DEBUG-only: live backfill progress / final outcome, shown inline.
    @State private var backfillMirrorsStatus: String?
    /// DEBUG-only: which of today's 3 Mirror slots the "Send Next Mirror
    /// Notification" tool has already fired this session. In-memory only
    /// (resets on relaunch) since this is manual notification QA, not a
    /// record of anything real.
    @State private var mirrorNotificationsFiredToday: Set<TimeOfDay> = []
    /// Address linked for SIWE sign-in, seeded from `viewModel.profile` and
    /// updated optimistically once `linkWallet()` succeeds.
    @State private var linkedWalletAddress: String?
    /// True while `linkWallet()` is in flight.
    @State private var isLinkingWallet = false
    /// Transient wallet-connect failure, shown as a toast rather than the
    /// persistent `errorBanner` (unlike sign-out/delete failures above, a
    /// dropped wallet round trip is routine enough to not warrant a banner
    /// the user has to dismiss).
    @State private var walletToastMessage: String?
    /// True once this account has an `eoa` wrap on file: seeded from the server
    /// on appear, flipped locally the moment `enrollEOAKeyWrap()` succeeds.
    @State private var eoaWrapEnrolled = false
    /// True while `enrollEOAKeyWrap()` is in flight.
    @State private var isEnrollingEOAWrap = false
    /// Card-local failure text. Kept out of `viewModel.errorMessage` so the
    /// explanation sits next to the button that produced it.
    @State private var eoaWrapError: String?

    @AppStorage(ThemeMode.storageKey) private var themeMode: String = ThemeMode.system.rawValue
    @AppStorage(EncouragementPrefs.enabledKey) private var encouragementEnabled: Bool = EncouragementPrefs.defaultEnabled

    @Environment(\.openURL) private var openURL

    private let reminders: ReminderCoordinator
    /// Owns the daily-encouragement cycle (batch generation + OS permission
    /// request). Optional because `RootView` builds it lazily in a `.task`
    /// once `AppServices` is available; nil only in the brief window before
    /// that task runs, and in previews that don't wire one up.
    private let encouragements: EncouragementCoordinator?
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
        soul: SoulService,
        encouragements: EncouragementCoordinator? = nil,
        onResumeDraft: @escaping (String) -> Void = { _ in }
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
            currentUserId: auth.currentUserId,
            encouragements: encouragements,
            onResumeDraft: onResumeDraft
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
        currentUserId: String? = nil,
        encouragements: EncouragementCoordinator? = nil,
        onResumeDraft: @escaping (String) -> Void = { _ in }
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
        self.encouragements = encouragements
        self.onResumeDraft = onResumeDraft
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
                    if AppConfig.reownProjectId != nil {
                        walletLinkCard
                        // Only once a wallet is actually linked: enrolling a
                        // key-wrap with no wallet to sign it makes no sense.
                        if linkedWalletAddress != nil {
                            eoaKeyWrapCard
                        }
                    }
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
            .navigationDestination(isPresented: $showRecordings) {
                RecordingsRecoveryView(
                    viewModel: RecordingsRecoveryViewModel(
                        inventory: RecordingInventory(drafts: services.drafts,
                                                      uploads: services.uploads),
                        drafts: services.drafts,
                        processor: services.entryProcessor
                    ),
                    onResumeDraft: { draftId in
                        showRecordings = false
                        onResumeDraft(draftId)
                    }
                )
            }
            .navigationDestination(isPresented: $showMessageHistory) {
                DailyMessagesHistoryView(repository: services.encouragements)
            }
        }
        .task { viewModel.start() }
        .task { await soulViewModel.load() }
        // Seeds the "already set up" state of the eoa wrap slot, so a user who
        // enrolled on another device (or in a previous session) isn't told to
        // set it up again. A failure just leaves the card offering enrollment,
        // which is idempotent.
        .task {
            guard let transport = services.eoaWrapTransport else { return }
            // `try?` flattens the optional here, so nil covers both "request
            // failed" and "no eoa wrap on file"; neither should claim enrolled.
            let wrap = try? await transport.fetchEOAWrap()
            eoaWrapEnrolled = wrap != nil
        }
        // Seeds (and re-syncs) the locally-shown linked address from the live
        // `users/{uid}` document, e.g. when a wallet was linked in a prior
        // session or from another device.
        .onChange(of: viewModel.profile?.walletAddress) { _, newValue in
            linkedWalletAddress = newValue
        }
        .toast(message: $walletToastMessage)
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
            "Sign out of Argo?",
            isPresented: $showSignOutDialog,
            titleVisibility: .visible
        ) {
            Button("Sign Out", role: .destructive) { viewModel.signOut() }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Your journal stays safely in your account.")
        }
        .alert("Nothing to manage", isPresented: $showNotManageableAlert) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.notManageableMessage)
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
        .modifier(DeveloperToolsPresentation(
            showOnboardingPreview: $showOnboardingPreview,
            showHermesBridge: $showHermesBridge,
            speech: speech
        ))
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

    /// Custodial wallet for the user's ArgoSoul: the full address (selectable,
    /// scales down rather than truncating) plus BaseScan links to the wallet and,
    /// once minted, the token. Rendered as soon as the wallet is provisioned,
    /// before and independent of minting.
    @ViewBuilder
    private var walletCard: some View {
        if let wallet = soulViewModel.payload?.walletAddress {
            VStack(alignment: .leading, spacing: Spacing.s) {
                Text("Soul Wallet")
                    .font(.sectionHeader)
                    .foregroundStyle(Color.textPrimary)

                // Public / on-chain disclosure (privacy).
                Text("Your Soul is a public NFT on the Base blockchain. It publishes your first name and journaling stats (days journaled, current & longest streak, and total word count) on-chain, where anyone can view them. It never includes your journal entries.")
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

    // MARK: - Sign-In Wallet

    /// Settings entry to link an Ethereum wallet as an additional sign-in
    /// method (spec §5). Distinct from `walletCard` above, which shows the
    /// server-minted LuminaSoul custodial wallet, an unrelated concept.
    private var walletLinkCard: some View {
        WalletLinkCard(linkedAddress: linkedWalletAddress, isWorking: isLinkingWallet) {
            linkWallet()
        }
    }

    /// Links a wallet to the already signed-in account via SIWE. Failures
    /// surface as a toast (`walletToastMessage`), not the persistent
    /// `errorBanner`: a dropped wallet round trip is common enough (app
    /// switching, a slow relay) that it shouldn't leave a banner sitting at
    /// the top of Settings until the user dismisses it.
    private func linkWallet() {
        guard !isLinkingWallet else { return }
        isLinkingWallet = true
        Task {
            defer { isLinkingWallet = false }
            do {
                let address = try await services.auth.linkWallet()
                linkedWalletAddress = address
            } catch AuthServiceError.cancelled {
                // The user dismissed the wallet sheet, not an error.
            } catch {
                walletToastMessage = (error as? AuthServiceError)?.localizedDescription
                    ?? error.localizedDescription
            }
        }
    }

    // MARK: - Unlock with Wallet (eoa key wrap)

    /// Opt-in third wrap slot: a copy of the DEK wrapped under a KEK derived
    /// from this wallet's signature. Purely additive, the iCloud and
    /// recovery-code wraps are untouched by enrolling (or not enrolling) it.
    private var eoaKeyWrapCard: some View {
        EOAKeyWrapCard(
            isEnrolled: eoaWrapEnrolled,
            isWorking: isEnrollingEOAWrap,
            errorMessage: eoaWrapError
        ) {
            enrollEOAKeyWrap()
        }
    }

    /// Wraps the currently-installed DEK under the connected wallet's signature
    /// and uploads it, only after `EOAKeyEnroller`'s own verify gate passes.
    /// Failures land on the card itself rather than the shared error banner.
    private func enrollEOAKeyWrap() {
        guard !isEnrollingEOAWrap else { return }
        // Nil only in preview/mock wiring, where there is nothing to enroll.
        guard let enroller = services.eoaKeyEnroller, let wallet = services.wallet else { return }
        guard let userId = currentUserId, let dek = services.keys.currentDataKey else {
            eoaWrapError = "Your journal isn't unlocked on this device yet."
            return
        }

        isEnrollingEOAWrap = true
        eoaWrapError = nil
        Task {
            defer { isEnrollingEOAWrap = false }
            do {
                // Reuses the app's existing wallet session; only connects when
                // nothing is connected (e.g. the link happened last launch).
                if wallet.connectedAddress == nil {
                    try await wallet.connect()
                }
                try await enroller.enroll(userId: userId, dek: dek)
                eoaWrapEnrolled = true
            } catch WalletConnectError.cancelled {
                // The user dismissed the wallet sheet, not an error.
            } catch EOAKeyEnrollerError.notAnEOA {
                eoaWrapError = EOAKeyEnrollerError.notAnEOA.errorDescription
            } catch KeyEnrollmentError.verificationFailed {
                eoaWrapError = KeyEnrollmentError.verificationFailed.errorDescription
            } catch {
                eoaWrapError = error.localizedDescription
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
            Text("Daily Reminders")
                .font(.sectionHeader)
                .foregroundStyle(Color.textPrimary)

            VStack(spacing: 0) {
                ForEach(Array(ReminderSlot.all.enumerated()), id: \.element.id) { index, slot in
                    if index > 0 { rowDivider }
                    ReminderRowView(
                        slot: slot,
                        reminders: reminders,
                        profile: { viewModel.profile },
                        permissionDenied: $reminderPermissionDenied
                    )
                }
                rowDivider
                encouragementRow
                rowDivider
                messageHistoryRow
            }
            .background(
                RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                    .fill(Color.cardBackground)
            )

            Text(reminderPermissionDenied
                 ? "Enable notifications for Argo in Settings to get reminders and \(EncouragementPrefs.displayName)."
                 : "Reminders only fire on days you haven't reached \(DailyGoal.wordTarget) words yet.")
                .font(.captionText)
                .foregroundStyle(reminderPermissionDenied ? Color.danger : Color.textSecondary)
        }
    }

    /// Toggles Mirror's Echo notifications. Turning it on asks
    /// `EncouragementCoordinator` to request OS notification permission (shared
    /// with the reminders above) and run the cycle immediately; turning it off
    /// cancels the pending slots. `encouragementEnabled` mirrors the
    /// coordinator's own `UserDefaults` flag so the switch reflects the
    /// persisted state instantly, then corrects itself if the OS denies.
    private var encouragementRow: some View {
        HStack(spacing: Spacing.m) {
            settingsIcon("sparkles", tint: .accentWarm)
            VStack(alignment: .leading, spacing: 2) {
                Text(EncouragementPrefs.displayName)
                    .font(.uiBody)
                    .foregroundStyle(Color.textPrimary)
                Text("Three quiet reflections a day, drawn from your week")
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
            }
            Spacer()
            Toggle(EncouragementPrefs.displayName, isOn: encouragementToggleBinding)
                .tint(Color.accentWarm)
                .labelsHidden()
        }
        .padding(Spacing.m)
    }

    private var encouragementToggleBinding: Binding<Bool> {
        Binding(
            get: { encouragementEnabled },
            set: { newValue in
                encouragementEnabled = newValue
                Task {
                    let granted = await encouragements?.setEnabled(newValue, profile: viewModel.profile) ?? newValue
                    encouragementEnabled = granted
                    if newValue { reminderPermissionDenied = !granted }
                }
            }
        )
    }

    /// Pushes to the read-only history of every Mirror Echo already delivered
    /// to this device. Stays visible regardless of the toggle above: turning
    /// the feature off stops new messages, it doesn't erase past ones.
    private var messageHistoryRow: some View {
        Button { showMessageHistory = true } label: {
            HStack(spacing: Spacing.m) {
                settingsIcon("clock", tint: .accentWarm)
                Text("Mirror history")
                    .font(.uiBody)
                    .foregroundStyle(Color.textPrimary)
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.textSecondary.opacity(0.6))
            }
            .padding(Spacing.m)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Settings

    private var settingsCard: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Settings")
                .font(.sectionHeader)
                .foregroundStyle(Color.textPrimary)
                .padding(.bottom, Spacing.s)

            VStack(spacing: 0) {
                recordingsRow
                rowDivider
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
                             url: URL(string: "https://myargoquest.com/privacy")!)
                rowDivider
                legalLinkRow(icon: "doc.text", label: "Terms of Use",
                             url: URL(string: "https://myargoquest.com/terms")!)
                rowDivider
                legalLinkRow(icon: "envelope", label: "Support",
                             url: URL(string: "https://myargoquest.com/support")!)
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
                reindexEntriesRow
                rowDivider
                backfillMirrorsRow
                rowDivider
                sendMirrorNotificationRow
                rowDivider
                hermesBridgeRow
            }
            .background(
                RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                    .fill(Color.cardBackground)
            )
        }
    }

    /// Opens the Hermes Bridge developer panel: pair with and talk to the
    /// `hermes-bridge` gateway running on Konrad's own server, in front of
    /// `run_hermes.sh` and the secondbrain vault (docs/features/hermes-bridge.md).
    private var hermesBridgeRow: some View {
        Button {
            showHermesBridge = true
        } label: {
            HStack(spacing: Spacing.m) {
                settingsIcon("terminal", tint: .accentWarm)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Hermes Bridge")
                        .font(.uiBody)
                        .foregroundStyle(Color.textPrimary)
                    Text("Pair with your Hermes agent runtime")
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
        .accessibilityLabel("Hermes Bridge, pair with your Hermes agent runtime")
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
                         ? "Generation failed, tap to retry"
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
    /// in the Daily Reflections section, stored and rendered identically to any
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

    /// One-tap migration: re-index the ENTIRE journal corpus into the server RAG
    /// index (BGE-M3 embeddings → Chroma). Because entries are zero-knowledge encrypted,
    /// the server can't re-index them itself, so this fetches + decrypts every entry
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
                    Text(reindexStatus ?? "Rebuild the server RAG index from every entry")
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
                        try await index.indexEntry(id: entry.id, text: entry.content, createdAt: entry.createdAt)
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
                    ? "Done, re-indexed \(ok) entr\(ok == 1 ? "y" : "ies")"
                    : "\(ok) ok, \(failed) failed: \(firstError ?? "unknown error") (tap to retry)"
            } catch {
                reindexStatus = "Re-index failed, tap to retry"
            }
        }
    }

    /// Canned per-slot copy shared by the two Mirror dev tools below. Not
    /// AI-generated: it exists purely to exercise storage/notification
    /// plumbing without depending on journal entries or a network round trip.
    private static let devMirrorCopy: [TimeOfDay: String] = [
        .morning: "Notice one thing you're looking forward to today.",
        .afternoon: "Check in: how does your energy compare to this morning?",
        .evening: "What's one moment from today worth remembering?",
    ]

    /// "yyyy-MM-dd" in the device's current timezone, matching the document-id
    /// prefix `EncouragementRepository` reads by.
    private static func mirrorDateKey(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = .current
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    /// Writes 3 past days of fabricated Mirror Echoes (3 slots/day) straight
    /// into this device's own encrypted Mirror history via
    /// `services.encouragements`, so Mirror History has something to show
    /// without waiting on the real daily AI cycle. Reuses the real
    /// `{dateKey}_{timeOfDay}` document ids, so pressing again overwrites
    /// rather than duplicates.
    private var backfillMirrorsRow: some View {
        Button {
            backfillMirrors()
        } label: {
            HStack(spacing: Spacing.m) {
                settingsIcon("clock.arrow.circlepath", tint: .accentWarm)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Backfill 3 Days of Mirrors")
                        .font(.uiBody)
                        .foregroundStyle(Color.textPrimary)
                    Text(backfillMirrorsStatus ?? "Seed the last 3 days into Mirror History")
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                }
                Spacer()
                if isBackfillingMirrors {
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
        .disabled(isBackfillingMirrors)
        .accessibilityLabel("Backfill 3 Days of Mirrors, seed the last 3 days into Mirror History")
    }

    private func backfillMirrors() {
        guard !isBackfillingMirrors else { return }
        isBackfillingMirrors = true
        backfillMirrorsStatus = "Backfilling…"
        Task {
            defer { isBackfillingMirrors = false }
            var calendar = Calendar(identifier: .gregorian)
            calendar.timeZone = .current
            let today = calendar.startOfDay(for: Date())
            var messages: [EncouragementMessage] = []
            for daysAgo in 1...3 {
                guard let dayStart = calendar.date(byAdding: .day, value: -daysAgo, to: today) else { continue }
                let dateKey = Self.mirrorDateKey(dayStart)
                for slot in EncouragementSlot.all {
                    guard let fireDate = calendar.date(
                        bySettingHour: slot.hour, minute: slot.minute, second: 0, of: dayStart
                    ) else { continue }
                    messages.append(EncouragementMessage(
                        id: EncouragementIds.documentId(dateKey: dateKey, timeOfDay: slot.timeOfDay),
                        timeOfDay: slot.timeOfDay,
                        text: Self.devMirrorCopy[slot.timeOfDay] ?? "Take a quiet moment.",
                        createdAt: dayStart,
                        deliveredAt: fireDate
                    ))
                }
            }
            do {
                try await services.encouragements.save(messages)
                backfillMirrorsStatus = "Backfilled \(messages.count) messages across 3 days"
            } catch {
                backfillMirrorsStatus = "Backfill failed, tap to retry"
            }
        }
    }

    /// Fires one immediate local notification per press, walking through
    /// today's 3 Mirror slots in order (morning, afternoon, evening) so
    /// pressing 3 times exercises the same delivery path a real day would,
    /// without waiting for 9 AM/1 PM/4 PM. Uses today's already-generated
    /// Echo for a slot when one exists, else the same canned copy the
    /// backfill tool uses. Fires under a `-dev-preview` identifier, distinct
    /// from the real scheduled `ll-encouragement-N` request for that slot, so
    /// it can never cancel or overwrite a real pending notification.
    private var sendMirrorNotificationRow: some View {
        Button {
            sendNextMirrorNotification()
        } label: {
            HStack(spacing: Spacing.m) {
                settingsIcon("bell.badge", tint: .accentWarm)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Send Next Mirror Notification")
                        .font(.uiBody)
                        .foregroundStyle(Color.textPrimary)
                    Text(mirrorNotificationStatus)
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
        .disabled(mirrorNotificationsFiredToday.count >= EncouragementSlot.all.count)
        .accessibilityLabel("Send Next Mirror Notification, \(mirrorNotificationStatus)")
    }

    private var mirrorNotificationStatus: String {
        let remaining = EncouragementSlot.all.count - mirrorNotificationsFiredToday.count
        return remaining > 0
            ? "\(remaining) of \(EncouragementSlot.all.count) due today left to send"
            : "All 3 sent for today"
    }

    private func sendNextMirrorNotification() {
        guard let slot = EncouragementSlot.all.first(where: { !mirrorNotificationsFiredToday.contains($0.timeOfDay) }) else { return }
        mirrorNotificationsFiredToday.insert(slot.timeOfDay)
        Task {
            let dateKey = Self.mirrorDateKey(Date())
            let today = (try? await services.encouragements.messages(forDateKey: dateKey)) ?? []
            let text = today.first(where: { $0.timeOfDay == slot.timeOfDay })?.text
                ?? Self.devMirrorCopy[slot.timeOfDay]
                ?? "Take a quiet moment."

            let center = UNUserNotificationCenter.current()
            _ = try? await center.requestAuthorization(options: [.alert, .sound, .badge])

            let content = UNMutableNotificationContent()
            content.title = EncouragementPrefs.displayName
            content.body = text
            content.sound = .default
            let request = UNNotificationRequest(
                identifier: "ll-encouragement-dev-preview-\(slot.timeOfDay.rawValue)",
                content: content,
                trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false)
            )
            try? await center.add(request)
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

    /// Recovery surface for capture that has not reached the cloud. Always
    /// present and deliberately quiet: no badge, no count, no banner.
    private var recordingsRow: some View {
        Button {
            showRecordings = true
        } label: {
            HStack(spacing: Spacing.m) {
                settingsIcon("waveform", tint: .accentWarm)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Recordings")
                        .font(.uiBody)
                        .foregroundStyle(Color.textPrimary)
                    Text("Audio and video not yet in the cloud")
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
        .accessibilityLabel("Recordings, audio and video not yet in the cloud")
    }

    private var subscriptionRow: some View {
        Button {
            // Routed by where the subscription is billed (design 2026-08-23,
            // section 3). Free opens the paywall, an App Store subscription
            // opens StoreKit's sheet (raised inside the view model, since only
            // the SDK can present it), and a web-billed one opens RevenueCat's
            // customer portal. The row itself never says which rail it was.
            Task {
                switch await viewModel.manageSubscription() {
                case .paywall: showPaywall = true
                case .portal(let url): openURL(url)
                case .notManageable: showNotManageableAlert = true
                case .appStoreSheet: break
                }
            }
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
            Text("Argo v\(viewModel.appVersion)")
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

#if DEBUG
/// Bundles the DEBUG-only developer-tool sheets into one `ViewModifier` so
/// `SettingsView.body`'s already-long modifier chain gains only a single
/// `.modifier(...)` call instead of two more chained closures. Without this,
/// the added `.sheet` pushed the surrounding chain past the type checker's
/// "unable to type-check this expression in reasonable time" limit.
private struct DeveloperToolsPresentation: ViewModifier {
    @Binding var showOnboardingPreview: Bool
    @Binding var showHermesBridge: Bool
    let speech: SpeechTranscriber?

    func body(content: Content) -> some View {
        content
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
            .sheet(isPresented: $showHermesBridge) {
                HermesBridgeView(viewModel: HermesBridgeViewModel(
                    service: URLSessionHermesBridgeService(),
                    secretStore: KeychainStore()
                ))
            }
    }
}
#endif

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
