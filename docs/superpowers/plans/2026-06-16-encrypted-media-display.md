# Encrypted Media Display & Thumbnails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decrypt journal media on display so photos/videos/audio actually render, generate on-device thumbnails for images, show the thumbnail first then the full image, support full-screen photo viewing, and add download buttons to photos and videos.

**Architecture:** The app is E2EE — media is encrypted with `MediaCipher` ("LLM1" AES-GCM chunk format) before upload, so S3 holds ciphertext. Add a testable `MediaContentCache` actor that downloads ciphertext, decrypts (or passes plaintext through via magic-byte detection for demo/legacy files), caches the plaintext in `Caches/media/`, and returns a local file URL. Expose it through a new `MediaUploader.localFileURL(for:)` method so the existing prop-drilled `MediaUploader` dependency stays unchanged — display views just call `localFileURL` instead of `viewURL`. Generate encrypted thumbnails on image upload and store their key in the already-existing `MediaItem.thumbnailS3Key`.

**Tech Stack:** Swift / SwiftUI, CryptoKit (AES-GCM, SHA256), ImageIO (thumbnail downscale), AVKit, XcodeGen (`project.yml`), XCTest.

**Test command (run from `ios/`):**
```
xcodebuild test -project LuminaLog.xcodeproj -scheme LuminaLog \
  -destination 'platform=iOS Simulator,name=iPhone 16' \
  -only-testing LuminaLogTests
```
**Regenerate project after adding files (run from `ios/`):** `xcodegen generate`

---

## File Structure

- **Create** `ios/LuminaLog/Core/Media/MediaContentCache.swift` — actor: download → magic-detect → decrypt/passthrough → cache → local file URL; in-flight dedup; purge.
- **Create** `ios/LuminaLogTests/MediaContentCacheTests.swift` — unit tests for decrypt, passthrough, dedup, purge.
- **Modify** `ios/LuminaLog/Core/Media/MediaUploader.swift` — add `localFileURL(for:)` to protocol.
- **Modify** `ios/LuminaLog/Core/Media/ProxyMediaUploader.swift` — implement `localFileURL`; own a `MediaContentCache`; generate + upload encrypted thumbnail on image upload; add `thumbnailData` helper.
- **Modify** `ios/LuminaLog/Core/Mocks/MockMediaUploader.swift` — implement `localFileURL` (plaintext local file passthrough).
- **Modify** `ios/LuminaLogTests/...` add `ProxyMediaUploaderThumbnailTests.swift` — test `thumbnailData` downscale.
- **Modify** `ios/LuminaLog/Shared/Components/EntryRow.swift` — `EntryThumbnailView` uses `localFileURL`.
- **Modify** `ios/LuminaLog/Features/JournalDetail/JournalDetailMediaViews.swift` — `EntryImageView` (thumb-first + download), `VideoPlayerCard` (decrypted file + download), `AudioPlayerCard` (decrypted file + fixed download).
- **Modify** `ios/LuminaLog/Core/Auth/SessionStore.swift` — purge media cache on sign-out.

No server, Firestore, or DI-threading changes. `MediaItem.thumbnailS3Key` already exists.

---

### Task 1: MediaContentCache (decrypt + cache + passthrough + dedup + purge)

**Files:**
- Create: `ios/LuminaLog/Core/Media/MediaContentCache.swift`
- Test: `ios/LuminaLogTests/MediaContentCacheTests.swift`

- [ ] **Step 1: Write the failing tests**

```swift
// ios/LuminaLogTests/MediaContentCacheTests.swift
import XCTest
import CryptoKit
@testable import LuminaLog

final class MediaContentCacheTests: XCTestCase {

    private var tmpDir: URL!

    override func setUpWithError() throws {
        tmpDir = FileManager.default.temporaryDirectory
            .appendingPathComponent("mcc-tests-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: tmpDir, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: tmpDir)
    }

    /// Writes `plaintext`, encrypts it with `key`, returns the ciphertext file URL.
    private func makeCiphertextFile(_ plaintext: Data, key: SymmetricKey) throws -> URL {
        let plain = tmpDir.appendingPathComponent("plain-\(UUID().uuidString).bin")
        try plaintext.write(to: plain)
        let cipher = tmpDir.appendingPathComponent("cipher-\(UUID().uuidString).bin")
        try MediaCipher(key: key).encryptFile(at: plain, to: cipher)
        return cipher
    }

    private func makeCache(serving source: URL) -> MediaContentCache {
        let cacheDir = tmpDir.appendingPathComponent("cache", isDirectory: true)
        return MediaContentCache(directory: cacheDir) { _ in
            // Simulate a download by copying the served file to a fresh temp file.
            let dest = self.tmpDir.appendingPathComponent("dl-\(UUID().uuidString)")
            try FileManager.default.copyItem(at: source, to: dest)
            return dest
        }
    }

    func testDecryptsCiphertextToPlaintextFile() async throws {
        let key = SymmetricKey(size: .bits256)
        let plaintext = Data("hello journal photo bytes".utf8)
        let cipher = try makeCiphertextFile(plaintext, key: key)
        let cache = makeCache(serving: cipher)

        let url = try await cache.fileURL(
            for: "users/u1/journals/j1/image-abc.jpg",
            from: URL(string: "https://example.com/x")!,
            key: key
        )

        XCTAssertEqual(try Data(contentsOf: url), plaintext)
        XCTAssertEqual(url.pathExtension, "jpg")
    }

    func testPassesPlaintextThroughWhenNoMagic() async throws {
        // Demo/legacy files are not "LLM1" — return them as-is even with a key.
        let key = SymmetricKey(size: .bits256)
        let plaintext = Data("raw plaintext, no magic".utf8)
        let plain = tmpDir.appendingPathComponent("raw.jpg")
        try plaintext.write(to: plain)
        let cache = makeCache(serving: plain)

        let url = try await cache.fileURL(
            for: "users/u1/journals/j1/image-def.jpg",
            from: URL(string: "https://example.com/x")!,
            key: key
        )

        XCTAssertEqual(try Data(contentsOf: url), plaintext)
    }

    func testReturnsCachedFileOnSecondCall() async throws {
        let key = SymmetricKey(size: .bits256)
        let cipher = try makeCiphertextFile(Data("cached".utf8), key: key)
        let cache = makeCache(serving: cipher)
        let s3Key = "users/u1/journals/j1/image-ghi.jpg"

        let first = try await cache.fileURL(for: s3Key, from: URL(string: "https://x")!, key: key)
        let second = try await cache.fileURL(for: s3Key, from: URL(string: "https://x")!, key: key)

        XCTAssertEqual(first, second)
    }

    func testPurgeRemovesCachedFiles() async throws {
        let key = SymmetricKey(size: .bits256)
        let cipher = try makeCiphertextFile(Data("purge me".utf8), key: key)
        let cache = makeCache(serving: cipher)
        let url = try await cache.fileURL(for: "users/u1/journals/j1/image-x.jpg",
                                          from: URL(string: "https://x")!, key: key)
        XCTAssertTrue(FileManager.default.fileExists(atPath: url.path))

        await cache.purge()
        XCTAssertFalse(FileManager.default.fileExists(atPath: url.path))
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run the test command above with `-only-testing LuminaLogTests/MediaContentCacheTests`.
Expected: FAIL to compile — `MediaContentCache` is undefined.

- [ ] **Step 3: Write the implementation**

```swift
// ios/LuminaLog/Core/Media/MediaContentCache.swift
import Foundation
import CryptoKit

/// Downloads encrypted media, decrypts it (or passes plaintext through for
/// demo-mode / pre-encryption files), and caches the plaintext on disk so the
/// image/video/audio views can read a local file URL. Lives off the main actor
/// so large-file decryption never blocks the UI.
///
/// Decrypted plaintext is cached in `Caches/media/` keyed by a hash of the
/// s3Key; `purge()` clears it on sign-out so plaintext never outlives a session.
actor MediaContentCache {

    /// Downloads a remote URL to a temp file. Injectable for tests.
    typealias Fetch = @Sendable (URL) async throws -> URL

    private let directory: URL
    private let fetch: Fetch
    private var inFlight: [String: Task<URL, Error>] = [:]

    /// Default shared cache directory (`Caches/media/`).
    static var defaultDirectory: URL {
        let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
        return caches.appendingPathComponent("media", isDirectory: true)
    }

    init(directory: URL = MediaContentCache.defaultDirectory, fetch: @escaping Fetch = MediaContentCache.urlSessionFetch) {
        self.directory = directory
        self.fetch = fetch
    }

    /// Default fetch: stream the remote URL to a temp file via URLSession.
    static let urlSessionFetch: Fetch = { url in
        let (tmp, _) = try await URLSession.shared.download(from: url)
        // download() deletes `tmp` when the call returns; move it somewhere stable.
        let dest = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try FileManager.default.moveItem(at: tmp, to: dest)
        return dest
    }

    /// Resolve a local plaintext file for `s3Key`, downloading from `remoteURL`
    /// and decrypting with `key` if needed. Concurrent calls for the same key
    /// share one download/decrypt.
    func fileURL(for s3Key: String, from remoteURL: URL, key: SymmetricKey?) async throws -> URL {
        let dest = cacheURL(for: s3Key)
        if FileManager.default.fileExists(atPath: dest.path) { return dest }

        if let existing = inFlight[s3Key] { return try await existing.value }

        let task = Task<URL, Error> { [fetch, directory] in
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            let downloaded = try await fetch(remoteURL)
            defer { try? FileManager.default.removeItem(at: downloaded) }

            // Write to a temp sibling first, then atomically move into place so a
            // partial decrypt never looks like a valid cache hit.
            let staging = directory.appendingPathComponent("staging-\(UUID().uuidString)")
            if try Self.hasMagic(downloaded), let key {
                try MediaCipher(key: key).decryptFile(at: downloaded, to: staging)
            } else {
                try FileManager.default.copyItem(at: downloaded, to: staging)
            }
            if FileManager.default.fileExists(atPath: dest.path) {
                try FileManager.default.removeItem(at: dest)
            }
            try FileManager.default.moveItem(at: staging, to: dest)
            return dest
        }
        inFlight[s3Key] = task
        defer { inFlight[s3Key] = nil }
        return try await task.value
    }

    /// Remove all cached plaintext. Call on sign-out.
    func purge() {
        try? FileManager.default.removeItem(at: directory)
    }

    // MARK: - Helpers

    /// Cache filename: sha256(s3Key) keeps the full image's extension so the
    /// share sheet and AVPlayer infer the right type.
    private func cacheURL(for s3Key: String) -> URL {
        let digest = SHA256.hash(data: Data(s3Key.utf8))
        let name = digest.map { String(format: "%02x", $0) }.joined()
        let ext = (s3Key as NSString).pathExtension
        let base = directory.appendingPathComponent(name)
        return ext.isEmpty ? base : base.appendingPathExtension(ext)
    }

    /// True if the file begins with the `MediaCipher` "LLM1" magic.
    private static func hasMagic(_ url: URL) throws -> Bool {
        let handle = try FileHandle(forReadingFrom: url)
        defer { try? handle.close() }
        return handle.readData(ofLength: MediaCipher.magic.count) == MediaCipher.magic
    }
}
```

- [ ] **Step 4: Regenerate project and run tests to verify they pass**

Run `xcodegen generate` (from `ios/`), then the test command with `-only-testing LuminaLogTests/MediaContentCacheTests`.
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add ios/LuminaLog/Core/Media/MediaContentCache.swift ios/LuminaLogTests/MediaContentCacheTests.swift ios/LuminaLog.xcodeproj
git commit -m "feat: add MediaContentCache for decrypting media on display"
```

---

### Task 2: Add `localFileURL(for:)` to MediaUploader + implementations

**Files:**
- Modify: `ios/LuminaLog/Core/Media/MediaUploader.swift`
- Modify: `ios/LuminaLog/Core/Media/ProxyMediaUploader.swift`
- Modify: `ios/LuminaLog/Core/Mocks/MockMediaUploader.swift`

- [ ] **Step 1: Add the protocol method**

In `MediaUploader.swift`, add inside the protocol after `viewURL`:

```swift
    /// Resolve a **decrypted** local file URL for displaying/playing a stored
    /// media item. Downloads ciphertext, decrypts, and caches the plaintext.
    func localFileURL(for s3Key: String) async throws -> URL
```

- [ ] **Step 2: Implement in ProxyMediaUploader**

In `ProxyMediaUploader.swift`, add a stored cache and the method. Add property near `viewURLCache`:

```swift
    /// Decrypts + caches media for display (off the main actor).
    private let contentCache = MediaContentCache()
```

Add after `viewURL(for:)`:

```swift
    func localFileURL(for s3Key: String) async throws -> URL {
        let remote = try await viewURL(for: s3Key)
        return try await contentCache.fileURL(for: s3Key, from: remote, key: keys.currentDataKey)
    }

    /// Clears decrypted plaintext from disk (call on sign-out).
    func purgeContentCache() async {
        await contentCache.purge()
    }
```

- [ ] **Step 3: Implement in MockMediaUploader**

In `MockMediaUploader.swift`, add (demo files are already plaintext local files):

```swift
    func localFileURL(for s3Key: String) async throws -> URL {
        // Demo media is stored as plaintext local files; no decryption needed.
        try await viewURL(for: s3Key)
    }
```

- [ ] **Step 4: Build to verify it compiles**

Run the full test command (build phase must succeed; all existing tests still pass).
Expected: BUILD SUCCEEDED, existing tests PASS.

- [ ] **Step 5: Commit**

```bash
git add ios/LuminaLog/Core/Media/MediaUploader.swift ios/LuminaLog/Core/Media/ProxyMediaUploader.swift ios/LuminaLog/Core/Mocks/MockMediaUploader.swift
git commit -m "feat: add MediaUploader.localFileURL for decrypted display"
```

---

### Task 3: Generate encrypted thumbnails on image upload

**Files:**
- Modify: `ios/LuminaLog/Core/Media/ProxyMediaUploader.swift`
- Test: `ios/LuminaLogTests/ProxyMediaUploaderThumbnailTests.swift`

- [ ] **Step 1: Write the failing test for the downscale helper**

```swift
// ios/LuminaLogTests/ProxyMediaUploaderThumbnailTests.swift
import XCTest
import UIKit
@testable import LuminaLog

final class ProxyMediaUploaderThumbnailTests: XCTestCase {

    private func writeJPEG(width: Int, height: Int) throws -> URL {
        let size = CGSize(width: width, height: height)
        let renderer = UIGraphicsImageRenderer(size: size)
        let image = renderer.image { ctx in
            UIColor.systemTeal.setFill()
            ctx.fill(CGRect(origin: .zero, size: size))
        }
        let data = try XCTUnwrap(image.jpegData(compressionQuality: 0.9))
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("thumb-src-\(UUID().uuidString).jpg")
        try data.write(to: url)
        return url
    }

    func testThumbnailRespectsMaxEdge() throws {
        let src = try writeJPEG(width: 2000, height: 1000)
        defer { try? FileManager.default.removeItem(at: src) }

        let data = try XCTUnwrap(ProxyMediaUploader.thumbnailData(from: src, maxEdge: 400))
        let image = try XCTUnwrap(UIImage(data: data))
        let maxSide = max(image.size.width * image.scale, image.size.height * image.scale)
        XCTAssertLessThanOrEqual(maxSide, 400, "longest edge should be downscaled to <= maxEdge")
        XCTAssertGreaterThan(maxSide, 0)
    }

    func testThumbnailReturnsNilForNonImage() throws {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("not-an-image-\(UUID().uuidString).bin")
        try Data("not an image".utf8).write(to: url)
        defer { try? FileManager.default.removeItem(at: url) }

        XCTAssertNil(ProxyMediaUploader.thumbnailData(from: url, maxEdge: 400))
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run with `-only-testing LuminaLogTests/ProxyMediaUploaderThumbnailTests`.
Expected: FAIL to compile — `ProxyMediaUploader.thumbnailData` is undefined.

- [ ] **Step 3: Implement the downscale helper**

In `ProxyMediaUploader.swift`, add `import ImageIO` at the top, and add this static helper (near `mediaItem`):

```swift
    /// Downscaled JPEG thumbnail (longest edge ≤ `maxEdge`) for an image file,
    /// or nil if the file isn't a decodable image. Uses ImageIO so the full
    /// image never fully decompresses into memory.
    static func thumbnailData(from fileURL: URL, maxEdge: CGFloat) -> Data? {
        guard let source = CGImageSourceCreateWithURL(fileURL as CFURL, nil) else { return nil }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxEdge,
        ]
        guard let cgThumb = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else {
            return nil
        }
        return UIImage(cgImage: cgThumb).jpegData(compressionQuality: 0.8)
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run `xcodegen generate`, then the test command with `-only-testing LuminaLogTests/ProxyMediaUploaderThumbnailTests`.
Expected: PASS (2 tests).

- [ ] **Step 5: Wire thumbnail generation into `upload`**

In `ProxyMediaUploader.upload`, after computing `encryptedURL`/`byteCount`/`ext`/`contentType` for the full file and BEFORE the `api.post`, build an optional encrypted thumbnail and request both upload URLs together. Replace the single-file request block with:

```swift
        // For images, also produce a small encrypted thumbnail uploaded as a
        // second object. ~400 px longest edge is retina-crisp at list/detail sizes.
        var thumbEncryptedURL: URL?
        if kind == .image, let thumbData = Self.thumbnailData(from: fileURL, maxEdge: 400) {
            let thumbPlain = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".jpg")
            let thumbEnc = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
            try thumbData.write(to: thumbPlain)
            defer { try? FileManager.default.removeItem(at: thumbPlain) }
            try cipher.encryptFile(at: thumbPlain, to: thumbEnc)
            thumbEncryptedURL = thumbEnc
        }
        defer { if let t = thumbEncryptedURL { try? FileManager.default.removeItem(at: t) } }

        var requestFiles: [UploadURLsRequest.File] = [
            .init(kind: kind.rawValue, ext: ext, contentType: contentType, bytes: byteCount, journalId: journalId)
        ]
        if let thumbEncryptedURL {
            let thumbBytes = ((try? FileManager.default.attributesOfItem(atPath: thumbEncryptedURL.path))?[.size] as? NSNumber)?.intValue ?? 0
            requestFiles.append(
                .init(kind: MediaKind.image.rawValue, ext: "jpg", contentType: contentType, bytes: thumbBytes, journalId: journalId)
            )
        }

        let response: UploadURLsResponse = try await api.post(
            path: "/v1/media/upload-urls",
            body: UploadURLsRequest(files: requestFiles)
        )
        guard let presigned = response.files.first else {
            throw MediaUploaderError.noUploadURL
        }
```

Then, after the existing full-file PUT upload succeeds, upload the thumbnail (if any) and pass its key to `mediaItem`. Replace the final `return` block with:

```swift
        // Upload the thumbnail object if we have one (index 1 in the response).
        var thumbnailS3Key: String?
        if let thumbEncryptedURL, response.files.count > 1 {
            let thumbPresigned = response.files[1]
            var thumbRequest = URLRequest(url: thumbPresigned.uploadUrl)
            thumbRequest.httpMethod = "PUT"
            thumbRequest.setValue(contentType, forHTTPHeaderField: "Content-Type")
            let (_, thumbResponse) = try await session.upload(for: thumbRequest, fromFile: thumbEncryptedURL)
            if let http = thumbResponse as? HTTPURLResponse, (200..<300).contains(http.statusCode) {
                thumbnailS3Key = thumbPresigned.s3Key
            }
        }

        return await Self.mediaItem(s3Key: presigned.s3Key, kind: kind, fileURL: fileURL, thumbnailS3Key: thumbnailS3Key)
```

Update the `mediaItem` signature to accept and set the key:

```swift
    static func mediaItem(s3Key: String, kind: MediaKind, fileURL: URL, thumbnailS3Key: String? = nil) async -> MediaItem {
        var item = MediaItem(s3Key: s3Key, kind: kind, thumbnailS3Key: thumbnailS3Key)
```

- [ ] **Step 6: Build to verify it compiles and tests pass**

Run the full test command.
Expected: BUILD SUCCEEDED, all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add ios/LuminaLog/Core/Media/ProxyMediaUploader.swift ios/LuminaLogTests/ProxyMediaUploaderThumbnailTests.swift ios/LuminaLog.xcodeproj
git commit -m "feat: generate encrypted image thumbnails on upload"
```

---

### Task 4: List thumbnail (EntryThumbnailView) uses decrypted file

**Files:**
- Modify: `ios/LuminaLog/Shared/Components/EntryRow.swift`

- [ ] **Step 1: Switch resolution to `localFileURL`**

In `EntryThumbnailView.body`'s `.task`, change:

```swift
        .task {
            url = try? await media.viewURL(for: s3Key)
        }
```
to:
```swift
        .task {
            url = try? await media.localFileURL(for: s3Key)
        }
```

- [ ] **Step 2: Build to verify it compiles**

Run the full test command. Expected: BUILD SUCCEEDED, tests PASS.

- [ ] **Step 3: Commit**

```bash
git add ios/LuminaLog/Shared/Components/EntryRow.swift
git commit -m "fix: decrypt list thumbnails before display"
```

---

### Task 5: EntryImageView — thumbnail-first, full image, download button

**Files:**
- Modify: `ios/LuminaLog/Features/JournalDetail/JournalDetailMediaViews.swift`

- [ ] **Step 1: Replace `EntryImageView` with the thumbnail-first version**

Replace the entire `struct EntryImageView` (lines ~15–103) with:

```swift
struct EntryImageView: View {

    let item: MediaItem
    let media: MediaUploader

    /// Full-resolution decrypted image (drives the inline view once ready and
    /// the full-screen viewer).
    @State private var fullURL: URL?
    /// Low-res decrypted thumbnail shown first while the full image loads.
    @State private var thumbURL: URL?
    @State private var resolveFailed = false
    @State private var showsViewer = false
    // Download/share state.
    @State private var isDownloading = false
    @State private var shareURL: URL?
    @State private var showShareSheet = false

    private var aspectRatio: CGFloat {
        guard let width = item.width, let height = item.height, width > 0, height > 0 else {
            return 3.0 / 4.0
        }
        return CGFloat(width) / CGFloat(height)
    }

    /// Best image to show inline right now: full if ready, else thumbnail.
    private var displayURL: URL? { fullURL ?? thumbURL }

    var body: some View {
        VStack(alignment: .trailing, spacing: Spacing.xs) {
            imageContent
            if displayURL != nil { downloadButton }
        }
        .fullScreenCover(isPresented: $showsViewer) {
            if let fullURL { ImageZoomViewer(url: fullURL) }
        }
        .sheet(isPresented: $showShareSheet) {
            if let shareURL { AudioShareSheet(url: shareURL) }
        }
        .task {
            // Thumbnail first (fast), then full. Legacy images have no thumb key.
            if let thumbKey = item.thumbnailS3Key {
                thumbURL = try? await media.localFileURL(for: thumbKey)
            }
            do {
                fullURL = try await media.localFileURL(for: item.s3Key)
            } catch {
                if thumbURL == nil { resolveFailed = true }
            }
        }
    }

    @ViewBuilder
    private var imageContent: some View {
        Group {
            if resolveFailed {
                placeholder
            } else if let displayURL {
                AsyncImage(url: displayURL) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFit()
                            .contentShape(Rectangle())
                            .onTapGesture { if fullURL != nil { showsViewer = true } }
                            .accessibilityLabel("Journal photo")
                            .accessibilityHint("Opens the photo full screen")
                            .accessibilityAddTraits(.isButton)
                    case .failure:
                        placeholder
                    case .empty:
                        loadingFrame
                    @unknown default:
                        placeholder
                    }
                }
            } else {
                loadingFrame
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous))
    }

    private var downloadButton: some View {
        Button {
            guard !isDownloading, let fullURL else { return }
            isDownloading = true
            shareURL = fullURL          // already a decrypted local file
            isDownloading = false
            showShareSheet = true
        } label: {
            Image(systemName: "arrow.down.circle")
                .font(.system(size: 22))
                .foregroundStyle(fullURL == nil ? Color.textSecondary.opacity(0.4) : Color.accentWarm)
        }
        .buttonStyle(.plain)
        .disabled(fullURL == nil || isDownloading)
        .accessibilityLabel("Download photo")
    }

    private var loadingFrame: some View {
        RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
            .fill(Color.secondaryBackground)
            .aspectRatio(aspectRatio, contentMode: .fit)
            .overlay { ProgressView().tint(Color.accentWarm) }
    }

    private var placeholder: some View {
        RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
            .fill(Color.secondaryBackground)
            .aspectRatio(aspectRatio, contentMode: .fit)
            .overlay {
                VStack(spacing: Spacing.s) {
                    Image(systemName: "photo")
                        .font(.system(size: 36, weight: .light))
                        .foregroundStyle(Color.textSecondary)
                    Text("Photo unavailable")
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                }
            }
            .accessibilityLabel("Photo unavailable")
    }
}
```

Note: `AudioShareSheet` (already defined later in this file) is reused for the photo/video share sheets.

- [ ] **Step 2: Build to verify it compiles**

Run the full test command. Expected: BUILD SUCCEEDED, tests PASS.

- [ ] **Step 3: Commit**

```bash
git add ios/LuminaLog/Features/JournalDetail/JournalDetailMediaViews.swift
git commit -m "feat: load photo thumbnail first, decrypt full image, add download"
```

---

### Task 6: VideoPlayerCard — decrypted file + download button

**Files:**
- Modify: `ios/LuminaLog/Features/JournalDetail/JournalDetailMediaViews.swift`

- [ ] **Step 1: Replace `VideoPlayerCard` body with decrypted-file version**

Replace `struct VideoPlayerCard` with:

```swift
struct VideoPlayerCard: View {

    let item: MediaItem
    let media: MediaUploader

    @State private var player: AVPlayer?
    @State private var fileURL: URL?
    @State private var isUnavailable = false
    @State private var showShareSheet = false

    var body: some View {
        VStack(alignment: .trailing, spacing: Spacing.xs) {
            videoContent
            if fileURL != nil { downloadButton }
        }
        .sheet(isPresented: $showShareSheet) {
            if let fileURL { AudioShareSheet(url: fileURL) }
        }
        .task {
            guard player == nil, !isUnavailable else { return }
            guard let url = try? await media.localFileURL(for: item.s3Key) else {
                isUnavailable = true
                return
            }
            if url.isFileURL, !FileManager.default.fileExists(atPath: url.path) {
                isUnavailable = true
                return
            }
            fileURL = url
            player = AVPlayer(url: url)
        }
        .onDisappear { player?.pause() }
    }

    @ViewBuilder
    private var videoContent: some View {
        Group {
            if let player {
                VideoPlayer(player: player)
            } else if isUnavailable {
                placeholder
            } else {
                Rectangle()
                    .fill(Color.secondaryBackground)
                    .overlay { ProgressView().tint(Color.accentWarm) }
            }
        }
        .aspectRatio(16.0 / 9.0, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous))
    }

    private var downloadButton: some View {
        Button {
            if fileURL != nil { showShareSheet = true }
        } label: {
            Image(systemName: "arrow.down.circle")
                .font(.system(size: 22))
                .foregroundStyle(Color.accentWarm)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Download video")
    }

    private var placeholder: some View {
        Rectangle()
            .fill(Color.secondaryBackground)
            .overlay {
                VStack(spacing: Spacing.s) {
                    Image(systemName: "video.slash")
                        .font(.system(size: 36, weight: .light))
                        .foregroundStyle(Color.textSecondary)
                    Text("Video unavailable")
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                }
            }
            .accessibilityLabel("Video unavailable")
    }
}
```

- [ ] **Step 2: Build to verify it compiles**

Run the full test command. Expected: BUILD SUCCEEDED, tests PASS.

- [ ] **Step 3: Commit**

```bash
git add ios/LuminaLog/Features/JournalDetail/JournalDetailMediaViews.swift
git commit -m "feat: decrypt video before playback, add download button"
```

---

### Task 7: AudioPlayerCard — decrypted file + correct download

**Files:**
- Modify: `ios/LuminaLog/Features/JournalDetail/JournalDetailMediaViews.swift`

- [ ] **Step 1: Resolve the decrypted file for the player**

In `AudioPlayerCard.body`'s `.task`, change:
```swift
            let url = try? await media.viewURL(for: item.s3Key)
```
to:
```swift
            let url = try? await media.localFileURL(for: item.s3Key)
```

- [ ] **Step 2: Simplify the download to share the decrypted file**

Replace `downloadAndShare()` and `cleanupShareFile()` with a single share of the already-decrypted local file, and remove the now-unused `shareURLIsTemp`. Replace the body of `downloadAndShare`:

```swift
    private func downloadAndShare() async {
        guard let url = resolvedURL else { return }
        // resolvedURL is a decrypted local file from MediaContentCache.
        shareURL = url
        showShareSheet = true
    }
```

Remove the `shareURLIsTemp` state property and the `onDismiss: cleanupShareFile` argument on the share sheet (change to `.sheet(isPresented: $showShareSheet)`), and delete the `cleanupShareFile` function. Do NOT delete the temp file on dismiss — it is the shared cache file.

- [ ] **Step 3: Build to verify it compiles**

Run the full test command. Expected: BUILD SUCCEEDED, tests PASS.

- [ ] **Step 4: Commit**

```bash
git add ios/LuminaLog/Features/JournalDetail/JournalDetailMediaViews.swift
git commit -m "fix: play and share decrypted audio"
```

---

### Task 8: Purge decrypted cache on sign-out

**Files:**
- Modify: `ios/LuminaLog/Core/Auth/SessionStore.swift`

- [ ] **Step 1: Purge the shared media cache when a user signs out**

In `SessionStore.handleAuthChange`, in the `else` (signed-out) branch, after `if let previousUid { keys.signOut(userId: previousUid) }`, add:

```swift
            // Decrypted plaintext must not outlive the session.
            Task.detached { await MediaContentCache().purge() }
```

(`MediaContentCache()` defaults to the shared `Caches/media/` directory, so this clears the same files `ProxyMediaUploader` wrote.)

- [ ] **Step 2: Build to verify it compiles**

Run the full test command. Expected: BUILD SUCCEEDED, tests PASS.

- [ ] **Step 3: Commit**

```bash
git add ios/LuminaLog/Core/Auth/SessionStore.swift
git commit -m "feat: clear decrypted media cache on sign-out"
```

---

### Task 9: Full verification

- [ ] **Step 1: Run the entire test suite**

Run the full test command (no `-only-testing` filter beyond `LuminaLogTests`).
Expected: BUILD SUCCEEDED, all tests PASS (existing + 6 new).

- [ ] **Step 2: Manual smoke (simulator)**

Build & run the app; open an entry with a photo (thumbnail appears then sharpens; tap → full-screen zoom; download button shares the image), a video (plays; download shares it), and a voice entry (plays; download shares the audio).

- [ ] **Step 3: Final commit if any fixups were needed**

```bash
git add -A && git commit -m "test: verify encrypted media display end-to-end"
```
