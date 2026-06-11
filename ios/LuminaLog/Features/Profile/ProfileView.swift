import PhotosUI
import SwiftUI

/// Profile & Settings (design §9): avatar + editable name, biography card,
/// grouped settings (Subscription / Sign Out / Delete Account), and the
/// app-version footer.
struct ProfileView: View {

    @StateObject private var viewModel: ProfileViewModel

    // Retained for the paywall sheet's own view model.
    private let subscriptions: SubscriptionService

    // Photo flow.
    @State private var showPhotoSourceDialog = false
    @State private var showCamera = false
    @State private var showLibrary = false
    @State private var photoPickerItem: PhotosPickerItem?

    // Settings flows.
    @State private var showPaywall = false
    @State private var showSignOutDialog = false
    @State private var showDeleteExplainerAlert = false
    @State private var showDeleteFinalAlert = false

    @FocusState private var nameFocused: Bool

    init(
        auth: AuthService,
        profiles: ProfileRepository,
        subscriptions: SubscriptionService,
        media: MediaUploader
    ) {
        self.init(
            viewModel: ProfileViewModel(
                auth: auth,
                profiles: profiles,
                subscriptions: subscriptions,
                media: media
            ),
            subscriptions: subscriptions
        )
    }

    /// Internal init for previews/tests that pre-seed the view model.
    init(viewModel: ProfileViewModel, subscriptions: SubscriptionService) {
        _viewModel = StateObject(wrappedValue: viewModel)
        self.subscriptions = subscriptions
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
        }
        .task { viewModel.start() }
        .sheet(isPresented: $showPaywall) {
            PaywallView(subscriptions: subscriptions)
        }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker(mode: .photo, onImage: { data in
                Task { await viewModel.uploadAvatar(imageData: data) }
            })
            .ignoresSafeArea()
        }
        .photosPicker(isPresented: $showLibrary, selection: $photoPickerItem, matching: .images)
        .onChange(of: photoPickerItem) { _, item in
            guard let item else { return }
            photoPickerItem = nil
            Task { await loadLibraryPhoto(item) }
        }
        .confirmationDialog(
            "Update Profile Photo",
            isPresented: $showPhotoSourceDialog,
            titleVisibility: .visible
        ) {
            if CameraPicker.isCameraAvailable {
                Button("Take Photo") { showCamera = true }
            }
            Button("Choose from Library") { showLibrary = true }
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
            avatarButton

            VStack(spacing: Spacing.xs) {
                TextField("Your name", text: $viewModel.displayNameDraft)
                    .font(.system(.title2, design: .serif).weight(.semibold))
                    .foregroundStyle(Color.textPrimary)
                    .multilineTextAlignment(.center)
                    .textInputAutocapitalization(.words)
                    .submitLabel(.done)
                    .focused($nameFocused)
                    .onSubmit {
                        Task { await viewModel.saveDisplayName() }
                    }
                    .onChange(of: nameFocused) { _, focused in
                        // Save when focus leaves the field, not just on ⏎.
                        if !focused {
                            Task { await viewModel.saveDisplayName() }
                        }
                    }
                    .accessibilityLabel("Display name")

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

    private var avatarButton: some View {
        Button {
            showPhotoSourceDialog = true
        } label: {
            ZStack(alignment: .bottomTrailing) {
                avatarImage
                    .frame(width: 88, height: 88)
                    .clipShape(Circle())
                    .overlay {
                        if viewModel.isUploadingPhoto {
                            Circle()
                                .fill(.black.opacity(0.35))
                            ProgressView()
                                .tint(.white)
                        }
                    }

                // Change-photo affordance.
                Image(systemName: "camera.fill")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 26, height: 26)
                    .background(Circle().fill(Color.accentWarm))
                    .overlay(Circle().strokeBorder(Color.appBackground, lineWidth: 2))
            }
        }
        .buttonStyle(.plain)
        .disabled(viewModel.isUploadingPhoto)
        .accessibilityLabel("Change profile photo")
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

            Text("Your bio helps your AI companion know you better")
                .font(.captionText)
                .foregroundStyle(Color.textSecondary)

            TextEditor(text: $viewModel.bioDraft)
                .font(.journalBody)
                .foregroundStyle(Color.textPrimary)
                .scrollContentBackground(.hidden)
                .frame(minHeight: 120)
                .padding(Spacing.s)
                .background(
                    RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous)
                        .fill(Color.secondaryBackground.opacity(0.6))
                )
                .accessibilityLabel("Biography")

            HStack {
                Text("\(viewModel.bioDraft.count) / \(ProfileViewModel.bioSoftLimit)")
                    .font(.captionText)
                    .foregroundStyle(
                        viewModel.bioDraft.count > ProfileViewModel.bioSoftLimit
                            ? Color.accentWarm
                            : Color.textSecondary
                    )
                    .accessibilityLabel("Bio length \(viewModel.bioDraft.count) of \(ProfileViewModel.bioSoftLimit) characters")

                Spacer()

                if viewModel.isBioDirty || viewModel.isSavingBio {
                    Button {
                        Task { await viewModel.saveBio() }
                    } label: {
                        Group {
                            if viewModel.isSavingBio {
                                ProgressView()
                                    .tint(.white)
                            } else {
                                Text("Save")
                                    .font(.uiBody.weight(.semibold))
                            }
                        }
                        .foregroundStyle(.white)
                        .frame(minWidth: 64, minHeight: 32)
                        .background(Capsule().fill(Color.accentWarm))
                    }
                    .buttonStyle(.plain)
                    .disabled(viewModel.isSavingBio)
                    .accessibilityLabel(viewModel.isSavingBio ? "Saving bio" : "Save bio")
                }
            }
        }
        .padding(Spacing.m)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                .fill(Color.cardBackground)
        )
        .animation(.easeInOut(duration: 0.15), value: viewModel.isBioDirty)
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

    // MARK: - Photo loading

    private func loadLibraryPhoto(_ item: PhotosPickerItem) async {
        guard let data = try? await item.loadTransferable(type: Data.self) else {
            viewModel.errorMessage = "That photo couldn't be loaded."
            return
        }
        await viewModel.uploadAvatar(imageData: data)
    }
}

// MARK: - Previews

#Preview("Default") {
    ProfileView(
        auth: MockAuthService(signedIn: true),
        profiles: MockProfileRepository(),
        subscriptions: MockSubscriptionService(),
        media: MockMediaUploader()
    )
}

#Preview("Editing bio") {
    let profiles = MockProfileRepository()
    let subscriptions = MockSubscriptionService()
    let viewModel = ProfileViewModel(
        auth: MockAuthService(signedIn: true),
        profiles: profiles,
        subscriptions: subscriptions,
        media: MockMediaUploader()
    )
    viewModel.start()
    viewModel.bioDraft = "I'm rewriting my bio right now — a little longer, a little truer."
    return ProfileView(viewModel: viewModel, subscriptions: subscriptions)
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
        media: MockMediaUploader()
    )
}

#Preview("Dark") {
    ProfileView(
        auth: MockAuthService(signedIn: true),
        profiles: MockProfileRepository(),
        subscriptions: MockSubscriptionService(),
        media: MockMediaUploader()
    )
    .preferredColorScheme(.dark)
}
