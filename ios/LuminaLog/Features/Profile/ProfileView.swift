import SwiftUI

/// Full profile detail screen: avatar, name, email, and all filled profile
/// fields. Pushed from SettingsView; inherits its NavigationStack.
struct ProfileDetailView: View {

    @ObservedObject var viewModel: ProfileViewModel
    @State private var showEdit = false

    var body: some View {
        ScrollView {
            VStack(spacing: Spacing.l) {
                profileHeader
                if let message = viewModel.errorMessage {
                    errorBanner(message)
                }
                detailsCards
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

    // MARK: - Profile details (catalog-driven, only filled fields)

    @ViewBuilder
    private var detailsCards: some View {
        let profile = viewModel.profile
        let hasAny = profile.map { p in
            ProfileFieldCatalog.all.contains { !$0.isHeader && !$0.get(p).isEmpty }
        } ?? false

        if let profile, hasAny {
            ForEach(ProfileField.Group.allCases, id: \.self) { group in
                let filled = ProfileFieldCatalog.bodyFields(in: group)
                    .filter { !$0.get(profile).trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
                if !filled.isEmpty {
                    VStack(alignment: .leading, spacing: Spacing.s) {
                        Text(group.title)
                            .font(.sectionHeader)
                            .foregroundStyle(Color.textPrimary)
                        VStack(alignment: .leading, spacing: Spacing.m) {
                            ForEach(filled) { field in
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(field.title)
                                        .font(.captionText)
                                        .foregroundStyle(Color.textSecondary)
                                    Text(field.get(profile))
                                        .font(.journalBody)
                                        .foregroundStyle(Color.textPrimary)
                                        .frame(maxWidth: .infinity, alignment: .leading)
                                }
                            }
                        }
                        .padding(Spacing.m)
                        .background(
                            RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                                .fill(Color.cardBackground)
                        )
                    }
                }
            }
        } else {
            VStack(alignment: .leading, spacing: Spacing.s) {
                Text("About You")
                    .font(.sectionHeader)
                    .foregroundStyle(Color.textPrimary)
                Text("Tell your AI companion about yourself — tap Edit to begin.")
                    .font(.journalBody)
                    .foregroundStyle(Color.textSecondary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
            .padding(Spacing.m)
            .background(
                RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                    .fill(Color.cardBackground)
            )
        }
    }

    // MARK: - Error banner

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
}

// MARK: - Previews

#Preview("Default") {
    NavigationStack {
        ProfileDetailView(
            viewModel: ProfileViewModel(
                auth: MockAuthService(signedIn: true),
                profiles: MockProfileRepository(),
                subscriptions: MockSubscriptionService(),
                credits: MockCreditService(balance: 45),
                media: MockMediaUploader(),
                speech: AppleSpeechTranscriber()
            )
        )
    }
}

#Preview("Empty bio") {
    let profiles = MockProfileRepository(profile: UserProfile(id: "preview", displayName: "Demo User", email: "demo@luminalog.com"))
    let subscriptions = MockSubscriptionService()
    let viewModel = ProfileViewModel(
        auth: MockAuthService(signedIn: true),
        profiles: profiles,
        subscriptions: subscriptions,
        credits: MockCreditService(balance: 12),
        media: MockMediaUploader(),
        speech: AppleSpeechTranscriber()
    )
    viewModel.start()
    return NavigationStack {
        ProfileDetailView(viewModel: viewModel)
    }
}

#Preview("Dark") {
    NavigationStack {
        ProfileDetailView(
            viewModel: ProfileViewModel(
                auth: MockAuthService(signedIn: true),
                profiles: MockProfileRepository(),
                subscriptions: MockSubscriptionService(),
                credits: MockCreditService(balance: 0),
                media: MockMediaUploader(),
                speech: AppleSpeechTranscriber()
            )
        )
    }
    .preferredColorScheme(.dark)
}
