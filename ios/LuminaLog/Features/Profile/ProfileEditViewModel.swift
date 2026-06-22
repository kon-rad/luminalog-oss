import Foundation
import OSLog

/// Drives the pushed Profile edit screen: avatar (uploads immediately), display
/// name, and biography (hard-capped at 750 words). Name + bio commit together
/// via `save()`.
@MainActor
final class ProfileEditViewModel: ObservableObject {

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "profile-edit")

    /// Hard maximum for the biography. Input beyond this is truncated.
    static let bioWordLimit = 750

    // MARK: Live profile + drafts

    @Published private(set) var profile: UserProfile?
    /// Catalog-keyed working copy of every field, seeded once from the profile.
    @Published var drafts: [String: String] = [:]

    // MARK: Avatar

    @Published private(set) var avatarURL: URL?
    @Published private(set) var isUploadingPhoto = false

    // MARK: Activity & errors

    @Published private(set) var isSaving = false
    @Published var errorMessage: String?

    // MARK: Dependencies

    private let profiles: ProfileRepository
    private let media: MediaUploader
    /// Exposed so the edit view can attach dictation to each text field.
    let speech: SpeechTranscriber

    private var profileTask: Task<Void, Never>?
    private var hasStarted = false
    private var seeded = false
    private var resolvedPhotoKey: String?

    init(profiles: ProfileRepository, media: MediaUploader, speech: SpeechTranscriber) {
        self.profiles = profiles
        self.media = media
        self.speech = speech
    }

    deinit { profileTask?.cancel() }

    // MARK: - Lifecycle

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
    }

    /// Seeds drafts once from the first emission; later emissions only refresh
    /// `profile`/avatar so a mid-edit draft is never clobbered.
    private func apply(_ newProfile: UserProfile?) {
        profile = newProfile
        guard let newProfile else { return }
        if !seeded {
            for field in ProfileFieldCatalog.all { drafts[field.key] = field.get(newProfile) }
            seeded = true
        }
        resolveAvatar(for: newProfile.photoURL)
    }

    // MARK: - Field access (hard 750-word cap on bio)

    static func wordCount(_ text: String) -> Int {
        text.split(whereSeparator: { $0.isWhitespace }).count
    }

    func value(for field: ProfileField) -> String { drafts[field.key] ?? "" }

    /// Binding setter for any field — truncates the bio to the first 750 words.
    func setValue(_ value: String, for field: ProfileField) {
        if field.key == "biography" {
            let words = value.split(whereSeparator: { $0.isWhitespace })
            drafts[field.key] = words.count > Self.bioWordLimit
                ? words.prefix(Self.bioWordLimit).joined(separator: " ")
                : value
        } else {
            drafts[field.key] = value
        }
    }

    var bioWordCount: Int { Self.wordCount(drafts["biography"] ?? "") }

    // MARK: - Dirty / save

    var isDirty: Bool {
        guard let profile else { return false }
        return ProfileFieldCatalog.all.contains { field in
            let draft = drafts[field.key] ?? ""
            if field.isHeader {
                // Name: an empty draft means "keep existing".
                let trimmed = draft.trimmingCharacters(in: .whitespacesAndNewlines)
                return !trimmed.isEmpty && trimmed != field.get(profile)
            }
            return draft != field.get(profile)
        }
    }

    /// Commits every field in one write. An empty name keeps the stored name.
    /// Returns true on success so the view can pop.
    func save() async -> Bool {
        guard var updated = profile, !isSaving else { return false }
        isSaving = true
        defer { isSaving = false }
        errorMessage = nil

        for field in ProfileFieldCatalog.all {
            let draft = drafts[field.key] ?? ""
            if field.isHeader {
                let trimmed = draft.trimmingCharacters(in: .whitespacesAndNewlines)
                if !trimmed.isEmpty { field.set(&updated, trimmed); drafts[field.key] = trimmed }
                else { drafts[field.key] = field.get(updated) }
            } else {
                field.set(&updated, draft)
            }
        }

        do {
            try await profiles.update(updated)
            return true
        } catch {
            Self.logger.error("Profile edit save failed: \(error.localizedDescription, privacy: .public)")
            errorMessage = "Your changes couldn't be saved. Please try again."
            return false
        }
    }

    // MARK: - Avatar (uploads immediately)

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
            let item = try await media.upload(fileURL: fileURL, kind: .image, journalId: "profile")
            updated.photoURL = URL(string: item.s3Key)
            try await profiles.update(updated)
        } catch {
            Self.logger.error("Avatar upload failed: \(error.localizedDescription, privacy: .public)")
            errorMessage = "Your photo couldn't be updated. Please try again."
        }
    }

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
            // The avatar is stored AES-encrypted, so it must be downloaded and
            // decrypted to a local plaintext file before AsyncImage can render
            // it — `viewURL` would hand raw ciphertext to AsyncImage.
            guard let resolved = try? await self.media.localFileURL(for: key) else { return }
            if self.profile?.photoURL?.absoluteString == key {
                self.resolvedPhotoKey = key
                self.avatarURL = resolved
            }
        }
    }

    /// Uppercased initials for the avatar placeholder ("Demo User" → "DU").
    var initials: String {
        (drafts["name"] ?? "")
            .split(separator: " ")
            .prefix(2)
            .compactMap { $0.first.map(String.init) }
            .joined()
            .uppercased()
    }
}
