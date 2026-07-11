import AVKit
import SwiftUI
import UIKit

// Media subviews for the Journal Detail Main tab (design §4): image stack,
// audio player card, and inline video player. Each resolves a decrypted local
// file through `MediaUploader.localFileURL(for:)` and degrades to a styled
// placeholder when the media can't be loaded (e.g. demo-mode seed entries).

// MARK: - Image

/// One journal-page photo, resolved via the media uploader. Failures render
/// a styled placeholder frame instead of a broken image. Tapping a loaded
/// photo opens a full-screen zoomable viewer (design §4).
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
    @State private var shareURL: URL?
    @State private var showShareSheet = false

    /// Aspect ratio from stored dimensions; portrait-page default otherwise.
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
            if let shareURL { MediaShareSheet(url: shareURL) }
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
            guard let fullURL else { return }
            shareURL = fullURL          // already a decrypted local file
            showShareSheet = true
        } label: {
            Image(systemName: "arrow.down.circle")
                .font(.system(size: 22))
                .foregroundStyle(fullURL == nil ? Color.textSecondary.opacity(0.4) : Color.accentWarm)
        }
        .buttonStyle(.plain)
        .disabled(fullURL == nil)
        .accessibilityLabel("Download photo")
    }

    private var loadingFrame: some View {
        RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
            .fill(Color.secondaryBackground)
            .aspectRatio(aspectRatio, contentMode: .fit)
            .overlay {
                ProgressView()
                    .tint(Color.accentWarm)
            }
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

// MARK: - Audio

/// Audio player card for voice entries: play/pause, scrubber, elapsed/total
/// time labels, and a download button that shares the audio file.
struct AudioPlayerCard: View {

    let item: MediaItem
    let media: MediaUploader

    @StateObject private var controller = AudioPlayerController()
    /// Resolved URL for the player and the download action.
    @State private var resolvedURL: URL?
    /// Non-nil while the download is in progress.
    @State private var isDownloading = false
    /// Drives the share sheet. Item-based (not `isPresented` + a separate URL) so the
    /// sheet can NEVER present before the URL is set — that race rendered a blank sheet.
    @State private var shareItem: ShareItem?

    private var isUnavailable: Bool {
        controller.loadState == .unavailable
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s) {
            HStack(spacing: Spacing.m) {
                playButton

                VStack(alignment: .leading, spacing: Spacing.xs) {
                    Slider(
                        value: Binding(
                            get: { controller.currentTime },
                            set: { controller.setScrubTime($0) }
                        ),
                        in: 0...max(controller.duration, 0.01),
                        onEditingChanged: { controller.scrubbing($0) }
                    )
                    .tint(Color.accentWarm)
                    .disabled(isUnavailable)

                    HStack {
                        Text(Self.timeLabel(controller.currentTime))
                        Spacer()
                        if isUnavailable {
                            Text("Audio unavailable")
                        }
                        Spacer()
                        Text(Self.timeLabel(controller.duration))
                    }
                    .font(.captionText.monospacedDigit())
                    .foregroundStyle(Color.textSecondary)
                }
            }

            // Download sits at the bottom-right, under the duration label.
            HStack(spacing: 0) {
                Spacer()
                downloadButton
            }
        }
        .padding(Spacing.m)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                .fill(Color.cardBackground)
        )
        .task {
            let url = try? await media.localFileURL(for: item.s3Key)
            resolvedURL = url
            controller.load(url: url, fallbackDuration: item.durationSec)
        }
        .onDisappear {
            controller.teardown()
        }
        .sheet(item: $shareItem) { item in
            MediaShareSheet(url: item.url)
        }
    }

    private var playButton: some View {
        Button {
            controller.togglePlayPause()
        } label: {
            Image(systemName: controller.isPlaying ? "pause.fill" : "play.fill")
                .font(.system(size: 18, weight: .semibold))
                .foregroundStyle(.white)
                .frame(width: 48, height: 48)
                .background(
                    Circle().fill(isUnavailable ? Color.textSecondary.opacity(0.4) : Color.accentWarm)
                )
        }
        .buttonStyle(.plain)
        .disabled(isUnavailable)
        .accessibilityLabel(controller.isPlaying ? "Pause" : "Play")
    }

    private var downloadButton: some View {
        Button {
            guard !isDownloading else { return }
            Task { await downloadAndShare() }
        } label: {
            if isDownloading {
                ProgressView()
                    .controlSize(.small)
                    .tint(Color.accentWarm)
                    .frame(width: 28, height: 28)
            } else {
                Image(systemName: "arrow.down.circle")
                    .font(.system(size: 22))
                    .foregroundStyle(resolvedURL == nil || isUnavailable
                        ? Color.textSecondary.opacity(0.4)
                        : Color.accentWarm)
            }
        }
        .buttonStyle(.plain)
        .disabled(resolvedURL == nil || isUnavailable || isDownloading)
        .accessibilityLabel("Download audio")
    }

    private func downloadAndShare() async {
        guard let url = resolvedURL else { return }
        // resolvedURL is a decrypted local file from MediaContentCache. Setting the
        // item presents the sheet atomically with its URL (no blank-sheet race).
        shareItem = ShareItem(url: url)
    }

    static func timeLabel(_ seconds: Double) -> String {
        let total = max(0, Int(seconds.rounded()))
        return String(format: "%d:%02d", total / 60, total % 60)
    }
}

// MARK: - Share sheet wrapper

/// Shared share-sheet wrapper for downloading decrypted photo/video/audio.
/// Identifiable wrapper so a decrypted file URL can drive `.sheet(item:)` — presenting
/// the share sheet and its URL together, never a blank sheet from a nil-URL race.
private struct ShareItem: Identifiable {
    let id = UUID()
    let url: URL
}

private struct MediaShareSheet: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [url], applicationActivities: nil)
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

// MARK: - Video

/// Inline video player in a rounded 16:9 frame, with a graceful placeholder
/// when the URL is missing or the file doesn't exist (demo seeds).
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
            if let fileURL { MediaShareSheet(url: fileURL) }
        }
        .task {
            guard player == nil, !isUnavailable else { return }
            guard let url = try? await media.localFileURL(for: item.s3Key) else {
                isUnavailable = true
                return
            }
            // Local files that don't exist (demo seeds) get the placeholder
            // instead of a dead black player.
            if url.isFileURL, !FileManager.default.fileExists(atPath: url.path) {
                isUnavailable = true
                return
            }
            fileURL = url
            player = AVPlayer(url: url)
        }
        .onDisappear {
            player?.pause()
        }
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
                    .overlay {
                        ProgressView()
                            .tint(Color.accentWarm)
                    }
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

// MARK: - Previews

#Preview("Audio + Video placeholders") {
    ZStack {
        Color.appBackground.ignoresSafeArea()
        ScrollView {
            VStack(spacing: Spacing.m) {
                AudioPlayerCard(
                    item: MediaItem(s3Key: "demo/voice-02.m4a", kind: .audio, durationSec: 94),
                    media: MockMediaUploader()
                )
                VideoPlayerCard(
                    item: MediaItem(s3Key: "demo/lake-06.mp4", kind: .video, durationSec: 73),
                    media: MockMediaUploader()
                )
                EntryImageView(
                    item: MediaItem(s3Key: "demo/recipe-04.jpg", kind: .image, width: 3024, height: 4032),
                    media: MockMediaUploader()
                )
            }
            .padding()
        }
    }
}
