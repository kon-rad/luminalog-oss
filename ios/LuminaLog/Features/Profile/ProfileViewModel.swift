import Foundation
import OSLog

/// Drives the Profile & Settings screen (design §9): live profile with
/// editable name/bio/avatar, the subscription row, and the sign-out /
/// delete-account flows.
@MainActor
final class ProfileViewModel: ObservableObject {

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "profile")

    /// Sentinel `journalId` for media that belongs to the profile rather
    /// than a journal entry (avatar uploads share the journal-media path).
    static let avatarJournalId = "profile"

    // MARK: Live state

    @Published private(set) var profile: UserProfile?
    @Published private(set) var entitlement: Entitlement?
    @Published private(set) var creditBalance: Int = 0

    // MARK: Avatar

    /// Resolved display URL for the avatar (s3Key → presigned/local URL).
    @Published private(set) var avatarURL: URL?
    @Published private(set) var isUploadingPhoto = false

    // MARK: Activity & errors

    @Published private(set) var isDeletingAccount = false
    @Published var errorMessage: String?

    // MARK: Dependencies

    private let auth: AuthService
    let profiles: ProfileRepository
    private let subscriptions: SubscriptionService
    private let credits: CreditService
    private let media: MediaUploader
    private let speech: SpeechTranscriber

    private var profileTask: Task<Void, Never>?
    private var entitlementTask: Task<Void, Never>?
    private var creditsTask: Task<Void, Never>?
    private var hasStarted = false

    /// The photoURL value the current `avatarURL` was resolved from, so
    /// repeat profile emissions don't re-resolve (and a stale resolution
    /// can't overwrite a newer one).
    private var resolvedPhotoKey: String?

    init(
        auth: AuthService,
        profiles: ProfileRepository,
        subscriptions: SubscriptionService,
        credits: CreditService,
        media: MediaUploader,
        speech: SpeechTranscriber
    ) {
        self.auth = auth
        self.profiles = profiles
        self.subscriptions = subscriptions
        self.credits = credits
        self.media = media
        self.speech = speech
    }

    /// Builds the edit-screen view model, sharing this VM's repositories.
    func makeEditViewModel() -> ProfileEditViewModel {
        ProfileEditViewModel(profiles: profiles, media: media, speech: speech)
    }

    deinit {
        profileTask?.cancel()
        entitlementTask?.cancel()
        creditsTask?.cancel()
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

        creditsTask = Task { [weak self] in
            guard let stream = self?.credits.balanceStream() else { return }
            for await balance in stream {
                guard let self, !Task.isCancelled else { return }
                self.creditBalance = balance
            }
        }
    }

    /// Merges a profile emission into local state. Editing lives on the pushed
    /// edit screen (`ProfileEditViewModel`); this VM only displays.
    private func apply(_ newProfile: UserProfile?) {
        profile = newProfile

        guard let newProfile else {
            avatarURL = nil
            resolvedPhotoKey = nil
            return
        }

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
            // resolution never latches — the next emission retries. The avatar
            // is stored AES-encrypted, so it must be downloaded and decrypted to
            // a local plaintext file before AsyncImage can render it.
            guard let resolved = try? await self.media.localFileURL(for: key) else { return }
            // Only publish if the profile still points at this photo.
            if self.profile?.photoURL?.absoluteString == key {
                self.resolvedPhotoKey = key
                self.avatarURL = resolved
            }
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

    // MARK: - Storage & Time

    var storageStats: UserProfile.StorageStats {
        profile?.storageStats ?? UserProfile.StorageStats()
    }

    var formattedTimeInApp: String {
        let total = profile?.totalMinutesInApp ?? 0
        guard total > 0 else { return "0 min" }
        if total < 60 { return "\(total) min" }
        let hours = total / 60
        let minutes = total % 60
        return minutes == 0 ? "\(hours) hr" : "\(hours) hr \(minutes) min"
    }

    // MARK: - Footer

    /// Marketing version from the bundle ("1.0.0").
    var appVersion: String {
        Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "—"
    }
}
