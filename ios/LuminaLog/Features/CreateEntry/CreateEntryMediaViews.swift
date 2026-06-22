import SwiftUI

// MARK: - Attachment strip

/// Horizontal strip of staged attachments with remove (×) controls:
/// photo thumbnails, the video poster, and the voice-memo chip.
struct AttachmentStrip: View {

    let attachments: AttachmentSet
    /// One id per photo still being fetched/decoded — rendered as a spinner.
    let loadingPhotoIDs: [UUID]
    /// Whether a picked video is still loading (shows a spinner tile).
    let isLoadingVideo: Bool
    let isDisabled: Bool
    let onRemovePhoto: (UUID) -> Void
    let onRemoveVideo: () -> Void
    let onRemoveAudio: () -> Void

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: Spacing.s) {
                ForEach(attachments.photos) { photo in
                    thumbnail(image: photo.thumbnail, systemFallback: "photo") {
                        onRemovePhoto(photo.id)
                    }
                    .accessibilityLabel("Attached photo")
                }

                ForEach(loadingPhotoIDs, id: \.self) { _ in
                    placeholderTile()
                        .accessibilityLabel("Loading photo")
                }

                if let video = attachments.video {
                    thumbnail(
                        image: video.thumbnail,
                        systemFallback: "video",
                        badge: video.durationSec.map(Self.durationLabel),
                        playBadge: true
                    ) {
                        onRemoveVideo()
                    }
                    .accessibilityLabel("Attached video")
                }

                if isLoadingVideo {
                    placeholderTile()
                        .accessibilityLabel("Loading video")
                }

                if let audio = attachments.audio {
                    audioChip(audio)
                }
            }
            .padding(.horizontal, Spacing.m)
            .padding(.top, Spacing.s)
        }
    }

    // MARK: Pieces

    /// Gray 64×64 tile with a spinner, shown while a picked item loads.
    private func placeholderTile() -> some View {
        RoundedRectangle(cornerRadius: CornerRadius.small, style: .continuous)
            .fill(Color.secondaryBackground)
            .frame(width: 64, height: 64)
            .overlay {
                ProgressView()
                    .controlSize(.small)
                    .tint(Color.textSecondary)
            }
    }

    private func thumbnail(
        image: UIImage?,
        systemFallback: String,
        badge: String? = nil,
        playBadge: Bool = false,
        onRemove: @escaping () -> Void
    ) -> some View {
        ZStack(alignment: .topTrailing) {
            Group {
                if let image {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                } else {
                    Image(systemName: systemFallback)
                        .font(.system(size: 22, weight: .light))
                        .foregroundStyle(Color.textSecondary)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .background(Color.secondaryBackground)
                }
            }
            .frame(width: 64, height: 64)
            .clipShape(RoundedRectangle(cornerRadius: CornerRadius.small, style: .continuous))
            .overlay(alignment: .bottomLeading) {
                if playBadge {
                    HStack(spacing: 2) {
                        Image(systemName: "play.fill")
                            .font(.system(size: 8))
                        if let badge {
                            Text(badge).font(.system(size: 9, weight: .semibold))
                        }
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 5)
                    .padding(.vertical, 2)
                    .background(Capsule().fill(.black.opacity(0.6)))
                    .padding(4)
                }
            }

            removeButton(action: onRemove)
        }
    }

    private func audioChip(_ audio: AudioAttachment) -> some View {
        ZStack(alignment: .topTrailing) {
            HStack(spacing: Spacing.s) {
                Image(systemName: "waveform")
                    .foregroundStyle(Color.tintVoice)
                Text(Self.durationLabel(audio.durationSec))
                    .font(.captionText.weight(.semibold))
                    .foregroundStyle(Color.textPrimary)
            }
            .padding(.horizontal, Spacing.m)
            .frame(height: 64)
            .background(
                RoundedRectangle(cornerRadius: CornerRadius.small, style: .continuous)
                    .fill(Color.tintVoice.opacity(0.12))
            )

            removeButton(action: onRemoveAudio)
        }
        .accessibilityLabel("Voice recording, \(Self.durationLabel(audio.durationSec))")
    }

    private func removeButton(action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: "xmark.circle.fill")
                .font(.system(size: 18))
                .symbolRenderingMode(.palette)
                .foregroundStyle(.white, .black.opacity(0.65))
        }
        .buttonStyle(.plain)
        .disabled(isDisabled)
        .offset(x: 6, y: -6)
        .accessibilityLabel("Remove attachment")
    }

    static func durationLabel(_ seconds: Double) -> String {
        let total = Int(seconds.rounded())
        return String(format: "%d:%02d", total / 60, total % 60)
    }
}

// MARK: - Media row

/// The fixed capture row at the bottom of the Create view (design §5.5):
/// voice recording, photo, video, and dictation buttons.
struct MediaRow: View {

    let isRecording: Bool
    let recordingLabel: String
    let isDisabled: Bool
    let dictationState: CreateEntryViewModel.DictationState
    let onMic: () -> Void
    let onPhoto: () -> Void
    let onVideo: () -> Void
    let onDictate: () -> Void

    var body: some View {
        HStack(spacing: Spacing.l) {
            // Mic — turns into an elapsed-time + stop control while recording.
            Button(action: onMic) {
                if isRecording {
                    HStack(spacing: Spacing.s) {
                        Image(systemName: "stop.fill")
                        Text(recordingLabel)
                            .monospacedDigit()
                    }
                    .font(.uiBody.weight(.semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, Spacing.m)
                    .padding(.vertical, Spacing.s)
                    .background(Capsule().fill(Color.red))
                } else {
                    mediaIcon("mic.fill", label: "Record")
                }
            }
            .buttonStyle(.plain)
            .accessibilityLabel(isRecording ? "Stop recording" : "Record voice entry")
            .accessibilityValue(isRecording ? recordingLabel : "")

            if !isRecording {
                Button(action: onPhoto) {
                    mediaIcon("photo.on.rectangle", label: "Photo")
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Add photos")

                Button(action: onVideo) {
                    mediaIcon("video.fill", label: "Video")
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Add a video")

                let isListening = dictationState == .listening
                Button(action: onDictate) {
                    VStack(spacing: Spacing.xs) {
                        Image(systemName: "waveform")
                            .font(.system(size: 20, weight: .medium))
                            .foregroundStyle(isListening ? Color.red : Color.accentWarm)
                            .frame(height: 24)
                        Text(isListening ? "Stop" : "Dictate")
                            .font(.captionText)
                            .foregroundStyle(isListening ? Color.red : Color.textSecondary)
                    }
                    .frame(width: 64)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(isListening ? "Stop dictation" : "Start dictation")
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.s + 2)
        .background(Color.secondaryBackground)
        .disabled(isDisabled)
        .opacity(isDisabled ? 0.5 : 1)
    }

    private func mediaIcon(_ systemName: String, label: String) -> some View {
        VStack(spacing: Spacing.xs) {
            Image(systemName: systemName)
                .font(.system(size: 20, weight: .medium))
                .foregroundStyle(Color.accentWarm)
                .frame(height: 24)
            Text(label)
                .font(.captionText)
                .foregroundStyle(Color.textSecondary)
        }
        .frame(width: 64)
    }
}
