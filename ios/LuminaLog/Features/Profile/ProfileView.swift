import SwiftUI

/// Profile & Settings (design §9): read-only avatar + name, biography card,
/// grouped settings (Subscription / Sign Out / Delete Account), and the
/// app-version footer.
struct ProfileView: View {

    @StateObject private var viewModel: ProfileViewModel

    // Retained for the paywall and credit store sheets.
    private let subscriptions: SubscriptionService
    private let credits: CreditService

    // Edit flow.
    @State private var showEdit = false

    // Settings flows.
    @State private var showPaywall = false
    @State private var showCredits = false
    @State private var showConfig = false
    @State private var showSignOutDialog = false
    @State private var showDeleteExplainerAlert = false
    @State private var showDeleteFinalAlert = false

    @AppStorage("ll-force-dark") private var forceDark: Bool = false

    // Daily reminder (device-local prefs).
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
        reminders: ReminderCoordinator
    ) {
        self.init(
            viewModel: ProfileViewModel(
                auth: auth,
                profiles: profiles,
                subscriptions: subscriptions,
                credits: credits,
                media: media
            ),
            subscriptions: subscriptions,
            credits: credits,
            reminders: reminders
        )
    }

    /// Internal init for previews/tests that pre-seed the view model.
    init(
        viewModel: ProfileViewModel,
        subscriptions: SubscriptionService,
        credits: CreditService,
        reminders: ReminderCoordinator
    ) {
        _viewModel = StateObject(wrappedValue: viewModel)
        self.subscriptions = subscriptions
        self.credits = credits
        self.reminders = reminders
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: Spacing.l) {
                    profileHeader
                    if let message = viewModel.errorMessage {
                        errorBanner(message)
                    }
                    biographyCard
                    userInfoCard
                    appearanceCard
                    reminderCard
                    settingsCard
                    versionFooter
                }
                .padding(.horizontal, Spacing.m)
                .padding(.top, Spacing.s)
                .padding(.bottom, Spacing.xl)
            }
            .background(Color.appBackground.ignoresSafeArea())
            .navigationTitle("Profile")
            .scrollDismissesKeyboard(.interactively)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Edit") { showEdit = true }
                }
            }
            .navigationDestination(isPresented: $showEdit) {
                ProfileEditView(viewModel: viewModel.makeEditViewModel())
            }
        }
        .task { viewModel.start() }
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
    }

    // MARK: - Profile header

    private var profileHeader: some View {
        VStack(spacing: Spacing.m) {
            avatarImage
                .frame(width: 88, height: 88)
                .clipShape(Circle())

            VStack(spacing: Spacing.xs) {
                Text(viewModel.profile?.displayName ?? "")
                    .font(.system(.title2, design: .serif).weight(.semibold))
                    .foregroundStyle(Color.textPrimary)
                    .multilineTextAlignment(.center)

                if let email = viewModel.profile?.email, !email.isEmpty {
                    Text(email)
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                }
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.top, Spacing.s)
    }

    @ViewBuilder
    private var avatarImage: some View {
        if let url = viewModel.avatarURL {
            AsyncImage(url: url) { phase in
                if case .success(let image) = phase {
                    image
                        .resizable()
                        .scaledToFill()
                } else {
                    initialsPlaceholder
                }
            }
        } else {
            initialsPlaceholder
        }
    }

    private var initialsPlaceholder: some View {
        ZStack {
            Circle()
                .fill(Color.accentWarm.opacity(0.18))
            if viewModel.initials.isEmpty {
                Image(systemName: "person.fill")
                    .font(.system(size: 34, weight: .light))
                    .foregroundStyle(Color.accentWarm)
            } else {
                Text(viewModel.initials)
                    .font(.system(.title, design: .serif).weight(.semibold))
                    .foregroundStyle(Color.accentWarm)
            }
        }
    }

    // MARK: - Biography

    private var biographyCard: some View {
        VStack(alignment: .leading, spacing: Spacing.s) {
            Text("About You")
                .font(.sectionHeader)
                .foregroundStyle(Color.textPrimary)

            let bio = viewModel.profile?.biography ?? ""
            if bio.isEmpty {
                Text("Tell your AI companion about yourself — tap Edit to begin.")
                    .font(.journalBody)
                    .foregroundStyle(Color.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                Text(bio)
                    .font(.journalBody)
                    .foregroundStyle(Color.textPrimary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .padding(Spacing.m)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                .fill(Color.cardBackground)
        )
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

            HStack(spacing: Spacing.m) {
                settingsIcon("sparkles", tint: .accentWarm)
                Text("Dark mode")
                    .font(.uiBody)
                    .foregroundStyle(Color.textPrimary)
                Spacer()
                Toggle("Dark mode", isOn: $forceDark)
                    .tint(Color.accentWarm)
                    .labelsHidden()
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
                        // @AppStorage mirrors the coordinator's persisted flag.
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

    // MARK: - Error + footer

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
        Text("LuminaLog v\(viewModel.appVersion)")
            .font(.captionText)
            .foregroundStyle(Color.textSecondary.opacity(0.8))
            .frame(maxWidth: .infinity)
            .padding(.top, Spacing.s)
    }
}

// MARK: - Previews

#Preview("Default") {
    ProfileView(
        auth: MockAuthService(signedIn: true),
        profiles: MockProfileRepository(),
        subscriptions: MockSubscriptionService(),
        credits: MockCreditService(balance: 45),
        media: MockMediaUploader(),
        reminders: ReminderCoordinator()
    )
}

#Preview("Empty bio") {
    let profiles = MockProfileRepository(profile: UserProfile(id: "preview", displayName: "Demo User", email: "demo@luminalog.com"))
    let subscriptions = MockSubscriptionService()
    let viewModel = ProfileViewModel(
        auth: MockAuthService(signedIn: true),
        profiles: profiles,
        subscriptions: subscriptions,
        credits: MockCreditService(balance: 12),
        media: MockMediaUploader()
    )
    viewModel.start()
    return ProfileView(
        viewModel: viewModel,
        subscriptions: subscriptions,
        credits: MockCreditService(),
        reminders: ReminderCoordinator()
    )
}

#Preview("Pro") {
    ProfileView(
        auth: MockAuthService(signedIn: true),
        profiles: MockProfileRepository(),
        subscriptions: MockSubscriptionService(entitlement: Entitlement(
            isPro: true,
            productId: "luminalog.pro.annual",
            expiresAt: Calendar.current.date(byAdding: .year, value: 1, to: Date())
        )),
        credits: MockCreditService(balance: 120),
        media: MockMediaUploader(),
        reminders: ReminderCoordinator()
    )
}

#Preview("Dark") {
    ProfileView(
        auth: MockAuthService(signedIn: true),
        profiles: MockProfileRepository(),
        subscriptions: MockSubscriptionService(),
        credits: MockCreditService(balance: 0),
        media: MockMediaUploader(),
        reminders: ReminderCoordinator()
    )
    .preferredColorScheme(.dark)
}
