import Foundation
import OSLog

/// Drives the Profile & Settings screen (design §9): live profile with
/// editable name/bio/avatar, the subscription row, and the sign-out /
/// delete-account flows.
@MainActor
final class ProfileViewModel: ObservableObject {

    private static let logger = Logger(subsystem: "com.luminalog.app", category: "profile")

    /// Soft biography length guide — the counter turns amber past this, but
    /// nothing is truncated or blocked.
    static let bioSoftLimit = 500

    /// Sentinel `journalId` for media that belongs to the profile rather
    /// than a journal entry (avatar uploads share the journal-media path).
    static let avatarJournalId = "profile"

    // MARK: Live state

    @Published private(set) var profile: UserProfile?
    @Published private(set) var entitlement: Entitlement?

    // MARK: Editable drafts

    @Published var displayNameDraft = ""
    @Published var bioDraft = ""

    // MARK: Avatar

    /// Resolved display URL for the avatar (s3Key → presigned/local URL).
    @Published private(set) var avatarURL: URL?
    @Published private(set) var isUploadingPhoto = false

    // MARK: Activity & errors

    @Published private(set) var isSavingName = false
    @Published private(set) var isSavingBio = false
    @Published private(set) var isDeletingAccount = false
    @Published var errorMessage: String?

    // MARK: Dependencies

    private let auth: AuthService
    private let profiles: ProfileRepository
    private let subscriptions: SubscriptionService
    private let media: MediaUploader

    private var profileTask: Task<Void, Never>?
    private var entitlementTask: Task<Void, Never>?
    private var hasStarted = false

    /// The photoURL value the current `avatarURL` was resolved from, so
    /// repeat profile emissions don't re-resolve (and a stale resolution
    /// can't overwrite a newer one).
    private var resolvedPhotoKey: String?

    /// The stored values the drafts were last synced from — a draft is only
    /// refreshed by a profile emission while it still matches these (i.e. the
    /// user isn't mid-edit).
    private var lastAppliedName: String?
    private var lastAppliedBio: String?

    init(
        auth: AuthService,
        profiles: ProfileRepository,
        subscriptions: SubscriptionService,
        media: MediaUploader
    ) {
        self.auth = auth
        self.profiles = profiles
        self.subscriptions = subscriptions
        self.media = media
    }

    deinit {
        profileTask?.cancel()
        entitlementTask?.cancel()
    }

    // MARK: - Lifecycle

    /// Starts the profile + entitlement streams. Idempotent — Profile stays
    /// mounted across tab switches.
    func start() {
        guard !hasStarted else { return }
        hasStarted = true

        profileTask = Task { [weak self] in
            guard let stream = self?.profiles.profile() else { return }
            for await profile in stream {
                guard let self, !Task.isCancelled else { return }
                self.apply(profile)
            }
        }

        entitlementTask = Task { [weak self] in
            guard let stream = self?.subscriptions.entitlementStream() else { return }
            for await entitlement in stream {
                guard let self, !Task.isCancelled else { return }
                self.entitlement = entitlement
            }
        }
    }

    /// Merges a profile emission into local state without clobbering drafts
    /// the user is mid-edit on: a draft is refreshed only while it still
    /// matches the last stored value it was synced from.
    private func apply(_ newProfile: UserProfile?) {
        profile = newProfile

        guard let newProfile else {
            displayNameDraft = ""
            bioDraft = ""
            lastAppliedName = nil
            lastAppliedBio = nil
            avatarURL = nil
            resolvedPhotoKey = nil
            return
        }

        if displayNameDraft == (lastAppliedName ?? "") {
            displayNameDraft = newProfile.displayName
        }
        lastAppliedName = newProfile.displayName

        if bioDraft == (lastAppliedBio ?? "") {
            bioDraft = newProfile.biography
        }
        lastAppliedBio = newProfile.biography

        resolveAvatar(for: newProfile.photoURL)
    }

    // MARK: - Avatar

    /// Resolves `photoURL` into something AsyncImage can load. Journal-media
    /// style s3Keys go through the uploader; absolute web URLs (e.g. a
    /// provider photo seeded at first sign-in) are used directly.
    private func resolveAvatar(for photoURL: URL?) {
        guard let photoURL else {
            avatarURL = nil
            resolvedPhotoKey = nil
            return
        }
        let key = photoURL.absoluteString
        guard key != resolvedPhotoKey else { return }

        if photoURL.scheme == "http" || photoURL.scheme == "https" {
            resolvedPhotoKey = key
            avatarURL = photoURL
            return
        }
        Task { [weak self] in
            guard let self else { return }
            // `resolvedPhotoKey` is only set on success, so a failed
            // resolution never latches — the next emission retries.
            guard let resolved = try? await self.media.viewURL(for: key) else { return }
            // Only publish if the profile still points at this photo.
            if self.profile?.photoURL?.absoluteString == key {
                self.resolvedPhotoKey = key
                self.avatarURL = resolved
            }
        }
    }

    /// Uploads a new avatar photo and persists its s3Key as the profile's
    /// photoURL — same storage convention as journal media.
    func uploadAvatar(imageData: Data) async {
        guard var updated = profile, !isUploadingPhoto else { return }
        isUploadingPhoto = true
        defer { isUploadingPhoto = false }
        errorMessage = nil

        let fileURL = FileManager.default.temporaryDirectory
            .appendingPathComponent("avatar-\(UUID().uuidString).jpg")
        defer { try? FileManager.default.removeItem(at: fileURL) }

        do {
            try imageData.write(to: fileURL)
            let item = try await media.upload(fileURL: fileURL, kind: .image, journalId: Self.avatarJournalId)
            updated.photoURL = URL(string: item.s3Key)
            try await profiles.update(updated)
        } catch {
            Self.logger.error("Avatar upload failed: \(error.localizedDescription, privacy: .public)")
            errorMessage = "Your photo couldn't be updated. Please try again."
        }
    }

    /// Uppercased initials for the avatar placeholder ("Demo User" → "DU").
    /// Empty when there's no name yet — the view falls back to a symbol.
    var initials: String {
        (profile?.displayName ?? "")
            .split(separator: " ")
            .prefix(2)
            .compactMap { $0.first.map(String.init) }
            .joined()
            .uppercased()
    }

    // MARK: - Display name

    /// Saves the edited display name on submit. Empty input reverts to the
    /// stored name; an unchanged name doesn't hit the repository.
    ///
    /// `isSavingName` guards the double-fire from `.onSubmit` + focus-loss
    /// (pressing ⏎ also resigns focus) so only one repository write happens.
    func saveDisplayName() async {
        guard var updated = profile, !isSavingName else { return }
        isSavingName = true
        defer { isSavingName = false }
        let trimmed = displayNameDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            displayNameDraft = updated.displayName
            return
        }
        guard trimmed != updated.displayName else {
            displayNameDraft = trimmed
            return
        }
        displayNameDraft = trimmed
        updated.displayName = trimmed
        do {
            try await profiles.update(updated)
        } catch {
            Self.logger.error("Display name save failed: \(error.localizedDescription, privacy: .public)")
            errorMessage = "Your name couldn't be saved. Please try again."
        }
    }

    // MARK: - Biography

    var isBioDirty: Bool {
        guard let profile else { return false }
        return bioDraft != profile.biography
    }

    /// Persists the edited bio. No-op while clean — the Save button only
    /// appears when dirty, and tests assert the repository isn't touched.
    func saveBio() async {
        guard var updated = profile, isBioDirty, !isSavingBio else { return }
        isSavingBio = true
        defer { isSavingBio = false }
        errorMessage = nil

        updated.biography = bioDraft
        do {
            try await profiles.update(updated)
        } catch {
            Self.logger.error("Bio save failed: \(error.localizedDescription, privacy: .public)")
            errorMessage = "Your bio couldn't be saved. Please try again."
        }
    }

    // MARK: - Subscription

    /// The Subscription row's value text — "Free plan" or the pro renewal.
    var subscriptionLabel: String {
        guard let entitlement, entitlement.isPro else { return "Free plan" }
        if let expiresAt = entitlement.expiresAt {
            return "Pro — renews \(expiresAt.formatted(date: .abbreviated, time: .omitted))"
        }
        return "Pro"
    }

    var isPro: Bool {
        entitlement?.isPro == true
    }

    // MARK: - Sign out / delete

    func signOut() {
        do {
            try auth.signOut()
        } catch {
            Self.logger.error("Sign out failed: \(error.localizedDescription, privacy: .public)")
            errorMessage = "Sign out didn't work. Please try again."
        }
    }

    func deleteAccount() async {
        guard !isDeletingAccount else { return }
        isDeletingAccount = true
        defer { isDeletingAccount = false }
        errorMessage = nil
        do {
            try await auth.deleteAccount()
        } catch {
            Self.logger.error("Account deletion failed: \(error.localizedDescription, privacy: .public)")
            errorMessage = "Your account couldn't be deleted. Please try again or contact support."
        }
    }

    // MARK: - Footer

    /// Marketing version from the bundle ("1.0.0").
    var appVersion: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "—"
    }
}
