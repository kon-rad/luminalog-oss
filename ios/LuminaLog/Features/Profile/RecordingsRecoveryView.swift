import AVKit
import SwiftUI

/// Settings > Recordings: every audio and video recording that is still only on
/// this device, with the actions to rescue it. This is the last line of defence
/// for capture that has not reached the cloud, so every route out of here is
/// non-destructive except one explicitly confirmed delete.
struct RecordingsRecoveryView: View {

    @StateObject private var viewModel: RecordingsRecoveryViewModel
    @StateObject private var player = AudioPlayerController()

    /// Reopens a draft in the Create flow (the caller dismisses Settings first).
    let onResumeDraft: (String) -> Void

    @State private var expandedId: String?
    @State private var videoURL: URL?
    @State private var pendingDelete: RecoverableRecording?
    @State private var shareURL: URL?

    init(viewModel: RecordingsRecoveryViewModel, onResumeDraft: @escaping (String) -> Void) {
        _viewModel = StateObject(wrappedValue: viewModel)
        self.onResumeDraft = onResumeDraft
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.l) {
                Text("Audio and video that hasn't reached the cloud yet. Everything here is stored only on this device.")
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)

                if viewModel.items.isEmpty && !viewModel.isLoading {
                    emptyState
                } else {
                    ForEach(viewModel.sections, id: \.title) { section in
                        sectionCard(title: section.title, items: section.items)
                    }
                }
            }
            .padding(.horizontal, Spacing.m)
            .padding(.top, Spacing.s)
            .padding(.bottom, AppTabBar.scrollBottomPadding)
        }
        .background(Color.appBackground.ignoresSafeArea())
        .navigationTitle("Recordings")
        .navigationBarTitleDisplayMode(.inline)
        .task { await viewModel.refresh() }
        .onDisappear { player.teardown() }
        .fullScreenCover(item: $videoURL) { url in
            VideoPlayer(player: AVPlayer(url: url))
                .ignoresSafeArea()
                .overlay(alignment: .topTrailing) {
                    Button("Done") { videoURL = nil }
                        .padding(Spacing.m)
                }
        }
        .sheet(item: $shareURL) { url in
            RecordingShareSheet(url: url)
        }
        .alert(item: $pendingDelete) { item in
            Alert(
                title: Text("Delete this recording?"),
                message: Text("This is the only copy. It has not been uploaded and can't be recovered."),
                primaryButton: .destructive(Text("Delete")) {
                    Task { await viewModel.delete(item) }
                },
                secondaryButton: .cancel(Text("Cancel"))
            )
        }
    }

    private var emptyState: some View {
        VStack(spacing: Spacing.s) {
            Image(systemName: "checkmark.icloud")
                .font(.system(size: 32, weight: .light))
                .foregroundStyle(Color.accentWarm)
            Text("Nothing waiting. Every recording has been saved to the cloud.")
                .font(.uiBody)
                .foregroundStyle(Color.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.xl)
    }

    private func sectionCard(title: String, items: [RecoverableRecording]) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(title)
                .font(.sectionHeader)
                .foregroundStyle(Color.textPrimary)
                .padding(.bottom, Spacing.s)

            VStack(spacing: 0) {
                ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                    if index > 0 { Divider().padding(.leading, Spacing.m) }
                    row(item)
                }
            }
            .background(
                RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                    .fill(Color.cardBackground)
            )
        }
    }

    private func row(_ item: RecoverableRecording) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s) {
            HStack(spacing: Spacing.m) {
                Image(systemName: item.kind == .video ? "video.fill" : "waveform")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Color.accentWarm)
                    .frame(width: 30, height: 30)
                    .background(
                        RoundedRectangle(cornerRadius: CornerRadius.small, style: .continuous)
                            .fill(Color.accentWarm.opacity(0.12))
                    )

                VStack(alignment: .leading, spacing: 2) {
                    Text(item.title)
                        .font(.uiBody)
                        .foregroundStyle(Color.textPrimary)
                        .lineLimit(1)
                    Text(subtitle(item))
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                }

                Spacer()
                statusPill(item.status)
                menu(item)
            }
            .contentShape(Rectangle())
            .onTapGesture { toggleExpanded(item) }

            if expandedId == item.id && item.kind == .audio {
                playerBar
            }
        }
        .padding(Spacing.m)
    }

    private var playerBar: some View {
        HStack(spacing: Spacing.m) {
            Button {
                player.togglePlayPause()
            } label: {
                Image(systemName: player.isPlaying ? "pause.circle.fill" : "play.circle.fill")
                    .font(.system(size: 30))
                    .foregroundStyle(Color.accentWarm)
            }
            .buttonStyle(.plain)
            .accessibilityLabel(player.isPlaying ? "Pause" : "Play")

            Slider(
                value: Binding(
                    get: { player.currentTime },
                    set: { player.setScrubTime($0) }
                ),
                in: 0...max(player.duration, 0.1),
                onEditingChanged: { player.scrubbing($0) }
            )
            .tint(Color.accentWarm)

            Text(Self.durationLabel(player.duration))
                .font(.captionText.monospacedDigit())
                .foregroundStyle(Color.textSecondary)
        }
    }

    private func menu(_ item: RecoverableRecording) -> some View {
        Menu {
            switch item.status {
            case .unsaved:
                Button {
                    onResumeDraft(item.draftId)
                } label: {
                    Label("Open in Composer", systemImage: "square.and.pencil")
                }
            case .uploadFailed:
                Button {
                    Task { await viewModel.retryUpload(item) }
                } label: {
                    Label("Try Upload Again", systemImage: "arrow.clockwise")
                }
            case .needsRepair, .orphaned:
                Button {
                    Task { await viewModel.recoverIntoDraft(item) }
                } label: {
                    Label("Recover into a Draft", systemImage: "arrow.uturn.backward")
                }
            case .awaitingUpload:
                EmptyView()
            }

            Button {
                shareURL = item.fileURL
            } label: {
                Label("Export", systemImage: "square.and.arrow.up")
            }

            // No delete while an upload is in flight: the processor owns that
            // job, and pulling the file out from under it would race.
            if item.status != .awaitingUpload {
                Button(role: .destructive) {
                    pendingDelete = item
                } label: {
                    Label("Delete", systemImage: "trash")
                }
            }
        } label: {
            Image(systemName: "ellipsis.circle")
                .font(.system(size: 17))
                .foregroundStyle(Color.textSecondary)
                .frame(width: 32, height: 32)
                .contentShape(Rectangle())
        }
        .accessibilityLabel("Actions for \(item.title)")
    }

    private func statusPill(_ status: RecoverableRecording.Status) -> some View {
        let (text, tint): (String, Color) = {
            switch status {
            case .unsaved: return ("Unsaved", .textSecondary)
            case .awaitingUpload: return ("Uploading", .accentWarm)
            case .uploadFailed: return ("Failed", .danger)
            case .needsRepair: return ("Needs repair", .danger)
            case .orphaned: return ("Recoverable", .danger)
            }
        }()
        return Text(text)
            .font(.captionText.weight(.semibold))
            .foregroundStyle(tint)
            .padding(.horizontal, Spacing.s)
            .padding(.vertical, 3)
            .background(Capsule().fill(tint.opacity(0.12)))
    }

    private func toggleExpanded(_ item: RecoverableRecording) {
        if item.kind == .video {
            videoURL = item.fileURL
            return
        }
        if expandedId == item.id {
            player.pause()
            expandedId = nil
        } else {
            expandedId = item.id
            player.load(url: item.fileURL, fallbackDuration: item.durationSec)
        }
    }

    private func subtitle(_ item: RecoverableRecording) -> String {
        var parts = [item.createdAt.formatted(date: .abbreviated, time: .shortened)]
        if let duration = item.durationSec, duration > 0 {
            parts.append(Self.durationLabel(duration))
        }
        parts.append(Self.sizeLabel(item.sizeBytes))
        return parts.joined(separator: " · ")
    }

    private static func durationLabel(_ seconds: Double) -> String {
        let total = Int(seconds.rounded())
        return String(format: "%d:%02d", total / 60, total % 60)
    }

    private static func sizeLabel(_ bytes: Int) -> String {
        ByteCountFormatter.string(fromByteCount: Int64(bytes), countStyle: .file)
    }
}

/// `URL` is not `Identifiable`; this makes the share and video sheets bindable.
extension URL: @retroactive Identifiable {
    public var id: String { absoluteString }
}

/// Minimal `UIActivityViewController` bridge so a recording can be exported out
/// of the app entirely. This is the one rescue route that does not depend on the
/// backend at all.
private struct RecordingShareSheet: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [url], applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
