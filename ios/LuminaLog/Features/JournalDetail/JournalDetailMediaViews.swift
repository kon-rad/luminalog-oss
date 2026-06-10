import AVKit
import SwiftUI

// Media subviews for the Journal Detail Main tab (design §4): image stack,
// audio player card, and inline video player. Each resolves its display URL
// through `MediaUploader.viewURL(for:)` and degrades to a styled placeholder
// when the media can't be loaded (e.g. demo-mode seed entries have no files).

// MARK: - Image

/// One journal-page photo, resolved via the media uploader. Failures render
/// a styled placeholder frame instead of a broken image. Tapping a loaded
/// photo opens a full-screen zoomable viewer (design §4).
struct EntryImageView: View {

    let item: MediaItem
    let media: MediaUploader

    @State private var url: URL?
    @State private var resolveFailed = false
    @State private var showsViewer = false

    /// Aspect ratio from stored dimensions; portrait-page default otherwise.
    private var aspectRatio: CGFloat {
        guard let width = item.width, let height = item.height, width > 0, height > 0 else {
            return 3.0 / 4.0
        }
        return CGFloat(width) / CGFloat(height)
    }

    var body: some View {
        Group {
            if resolveFailed {
                placeholder
            } else if let url {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFit()
                            .contentShape(Rectangle())
                            .onTapGesture {
                                showsViewer = true
                            }
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
        .fullScreenCover(isPresented: $showsViewer) {
            if let url {
                ImageZoomViewer(url: url)
            }
        }
        .task {
            do {
                url = try await media.viewURL(for: item.s3Key)
            } catch {
                resolveFailed = true
            }
        }
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

/// Audio player card for voice entries: play/pause, scrubber, and
/// elapsed/total time labels. Disabled when the audio can't be loaded.
struct AudioPlayerCard: View {

    let item: MediaItem
    let media: MediaUploader

    @StateObject private var controller = AudioPlayerController()

    private var isUnavailable: Bool {
        controller.loadState == .unavailable
    }

    var body: some View {
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
        .padding(Spacing.m)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                .fill(Color.cardBackground)
        )
        .task {
            let url = try? await media.viewURL(for: item.s3Key)
            controller.load(url: url, fallbackDuration: item.durationSec)
        }
        .onDisappear {
            controller.teardown()
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

    static func timeLabel(_ seconds: Double) -> String {
        let total = max(0, Int(seconds.rounded()))
        return String(format: "%d:%02d", total / 60, total % 60)
    }
}

// MARK: - Video

/// Inline video player in a rounded 16:9 frame, with a graceful placeholder
/// when the URL is missing or the file doesn't exist (demo seeds).
struct VideoPlayerCard: View {

    let item: MediaItem
    let media: MediaUploader

    @State private var player: AVPlayer?
    @State private var isUnavailable = false

    var body: some View {
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
        .task {
            guard player == nil, !isUnavailable else { return }
            guard let url = try? await media.viewURL(for: item.s3Key) else {
                isUnavailable = true
                return
            }
            // Local files that don't exist (demo seeds) get the placeholder
            // instead of a dead black player.
            if url.isFileURL, !FileManager.default.fileExists(atPath: url.path) {
                isUnavailable = true
                return
            }
            player = AVPlayer(url: url)
        }
        .onDisappear {
            player?.pause()
        }
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
