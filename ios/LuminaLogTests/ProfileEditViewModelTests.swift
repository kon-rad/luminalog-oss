import XCTest
@testable import LuminaLog

final class ProfileEditViewModelTests: XCTestCase {

    @MainActor
    private final class SpyProfileRepository: ProfileRepository {
        struct UpdateError: Error {}
        private(set) var updates: [UserProfile] = []
        var shouldFailUpdate = false
        private var stored: UserProfile?
        private var continuations: [UUID: AsyncStream<UserProfile?>.Continuation] = [:]

        init(profile: UserProfile? = MockData.profile) { stored = profile }

        func profile() -> AsyncStream<UserProfile?> {
            AsyncStream { continuation in
                let key = UUID()
                continuations[key] = continuation
                continuation.onTermination = { [weak self] _ in
                    Task { @MainActor in self?.continuations[key] = nil }
                }
                continuation.yield(stored)
            }
        }

        func update(_ profile: UserProfile) async throws {
            if shouldFailUpdate { throw UpdateError() }
            updates.append(profile)
            stored = profile
            for continuation in continuations.values { continuation.yield(stored) }
        }

        func ensureUserDocument(displayName: String?, email: String?, photoURL: URL?) async throws -> Bool { false }
        func mergeOnboardingDraft(_ draft: [String: String], overwriteExisting: Bool) async throws {
            guard let current = stored,
                  let updated = applyingOnboardingDraft(draft, to: current, overwriteExisting: overwriteExisting) else { return }
            try await update(updated)
        }
        func recordEntrySaved(wordCountDelta: Int, on date: Date) async throws {}
        func recordMediaUploaded(kind: MediaKind, bytes: Int) async throws {}
        func recordTimeSpent(minutes: Int) async throws {}
    }

    @MainActor
    private final class SpyMediaUploader: MediaUploader {
        struct UploadError: Error {}
        private(set) var uploads: [(kind: MediaKind, journalId: String)] = []
        private(set) var viewURLKeys: [String] = []
        private(set) var localFileURLKeys: [String] = []
        var shouldFail = false
        var s3Key = "profile/avatar-1.jpg"

        func upload(fileURL: URL, kind: MediaKind, journalId: String) async throws -> MediaItem {
            if shouldFail { throw UploadError() }
            uploads.append((kind, journalId))
            return MediaItem(s3Key: s3Key, kind: kind)
        }
        func prepareUpload(fileURL: URL, kind: MediaKind, journalId: String) async throws -> PreparedUpload {
            PreparedUpload(encryptedFileURL: fileURL, s3Key: s3Key, mediaItem: MediaItem(s3Key: s3Key, kind: kind))
        }
        func presignUpload(s3Key: String?, kind: MediaKind, ext: String, bytes: Int, journalId: String) async throws -> (s3Key: String, url: URL) {
            (s3Key ?? self.s3Key, URL(fileURLWithPath: "/dev/null"))
        }
        func viewURL(for s3Key: String) async throws -> URL { viewURLKeys.append(s3Key); return URL(fileURLWithPath: "/ciphertext/\(s3Key)") }
        func localFileURL(for s3Key: String) async throws -> URL { localFileURLKeys.append(s3Key); return URL(fileURLWithPath: "/decrypted/\(s3Key)") }
    }

    private var bioField: ProfileField { ProfileFieldCatalog.all.first { $0.key == "biography" }! }
    private var nameField: ProfileField { ProfileFieldCatalog.all.first { $0.key == "name" }! }

    @MainActor
    private func makeStarted(profile: UserProfile? = MockData.profile) async -> (ProfileEditViewModel, SpyProfileRepository, SpyMediaUploader) {
        let profiles = SpyProfileRepository(profile: profile)
        let media = SpyMediaUploader()
        let vm = ProfileEditViewModel(profiles: profiles, media: media, speech: MockSpeechTranscriber())
        vm.start()
        let deadline = Date().addingTimeInterval(2)
        while vm.profile == nil && Date() < deadline {
            try? await Task.sleep(nanoseconds: 10_000_000)
        }
        XCTAssertNotNil(vm.profile, "Profile stream should seed the edit VM")
        return (vm, profiles, media)
    }

    // MARK: - 750-word hard cap

    @MainActor
    func testSetBioTruncatesBeyond750Words() async {
        let (vm, _, _) = await makeStarted()
        let longBio = Array(repeating: "word", count: 900).joined(separator: " ")
        vm.setValue(longBio, for: bioField)
        XCTAssertEqual(ProfileEditViewModel.wordCount(vm.value(for: bioField)), 750)
        XCTAssertEqual(vm.bioWordCount, 750)
    }

    @MainActor
    func testSetBioKeepsInputUnder750Words() async {
        let (vm, _, _) = await makeStarted()
        vm.setValue("a short bio", for: bioField)
        XCTAssertEqual(vm.value(for: bioField), "a short bio")
        XCTAssertEqual(vm.bioWordCount, 3)
    }

    // MARK: - Save commits all fields together

    @MainActor
    func testSaveWritesNameAndBioInOneUpdate() async {
        let (vm, profiles, _) = await makeStarted()
        vm.setValue("  New Name  ", for: nameField)
        vm.setValue("A brand new bio.", for: bioField)
        let ok = await vm.save()
        XCTAssertTrue(ok)
        XCTAssertEqual(profiles.updates.count, 1)
        XCTAssertEqual(profiles.updates.last?.displayName, "New Name")
        XCTAssertEqual(profiles.updates.last?.biography, "A brand new bio.")
    }

    @MainActor
    func testSaveWritesDetailFields() async {
        let (vm, profiles, _) = await makeStarted()
        let goalsField = ProfileFieldCatalog.all.first { $0.key == "goals" }!
        vm.setValue("Run a marathon", for: goalsField)
        _ = await vm.save()
        XCTAssertEqual(profiles.updates.last?.details.goals, "Run a marathon")
    }

    @MainActor
    func testSaveWithEmptyNameKeepsStoredName() async {
        let (vm, profiles, _) = await makeStarted()
        vm.setValue("   ", for: nameField)
        vm.setValue("Bio only.", for: bioField)
        _ = await vm.save()
        XCTAssertEqual(profiles.updates.last?.displayName, MockData.profile.displayName)
        XCTAssertEqual(profiles.updates.last?.biography, "Bio only.")
    }

    @MainActor
    func testSaveFailureSurfacesError() async {
        let (vm, profiles, _) = await makeStarted()
        profiles.shouldFailUpdate = true
        vm.setValue("changed", for: bioField)
        let ok = await vm.save()
        XCTAssertFalse(ok)
        XCTAssertNotNil(vm.errorMessage)
    }

    // MARK: - Avatar uploads immediately

    @MainActor
    func testUploadAvatarPersistsS3Key() async {
        let (vm, profiles, media) = await makeStarted()
        media.s3Key = "profile/avatar-42.jpg"
        await vm.uploadAvatar(imageData: Data("jpeg".utf8))
        XCTAssertEqual(media.uploads.first?.journalId, "profile")
        XCTAssertEqual(profiles.updates.last?.photoURL?.absoluteString, "profile/avatar-42.jpg")
    }

    /// The avatar is uploaded as AES-encrypted ciphertext, so display must go
    /// through `localFileURL` (download + decrypt), never `viewURL` (which
    /// hands raw ciphertext to AsyncImage and renders nothing).
    @MainActor
    func testUploadedAvatarResolvesViaDecryptingPath() async {
        let (vm, _, media) = await makeStarted()
        media.s3Key = "users/u/journals/profile/image-1.jpg"
        await vm.uploadAvatar(imageData: Data("jpeg".utf8))

        let deadline = Date().addingTimeInterval(2)
        while vm.avatarURL == nil && Date() < deadline {
            try? await Task.sleep(nanoseconds: 10_000_000)
        }

        XCTAssertEqual(media.localFileURLKeys, ["users/u/journals/profile/image-1.jpg"],
                       "Encrypted avatar must be resolved through localFileURL (download + decrypt)")
        XCTAssertTrue(media.viewURLKeys.isEmpty,
                      "Avatar ciphertext must not be handed to AsyncImage via viewURL")
        XCTAssertEqual(vm.avatarURL?.path, "/decrypted/users/u/journals/profile/image-1.jpg")
    }

    // MARK: - Dirty tracking

    @MainActor
    func testIsDirtyTracksNameAndBio() async {
        let (vm, _, _) = await makeStarted()
        XCTAssertFalse(vm.isDirty)
        vm.setValue("different bio", for: bioField)
        XCTAssertTrue(vm.isDirty)
    }
}
