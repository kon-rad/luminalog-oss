import AVFoundation
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

/// Create Journal Entry (design §5): big serif editor with live dictation,
/// optional prompt banner, media capture row, and the save pipeline.
struct CreateEntryView: View {

    @Environment(\.dismiss) private var dismiss

    @StateObject private var viewModel: CreateEntryViewModel
    @StateObject private var recorder = RecordingSession()

    // Local presentation state.
    @State private var isRecorderPresented = false
    @State private var showCloseDialog = false
    @State private var isDiscarding = false
    @State private var showPhotoSourceDialog = false
    @State private var showVideoSourceDialog = false
    @State private var showPhotoCamera = false
    @State private var showVideoCamera = false
    @State private var showPhotoLibrary = false
    @State private var showVideoLibrary = false
    @State private var photoPickerItems: [PhotosPickerItem] = []
    @State private var videoPickerItem: PhotosPickerItem?
    @State private var pendingVideo: VideoAttachment?
    @State private var confirmReplaceRecording = false
    @State private var showUploadPicker = false
    @FocusState private var editorFocused: Bool

    init(request: CreateEntryRequest, services: AppServices) {
        self.init(viewModel: CreateEntryViewModel(
            request: request,
            dependencies: CreateEntryDependencies(services: services)
        ))
    }

    /// Internal init for previews/tests that pre-seed the view model.
    init(viewModel: CreateEntryViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel)
    }

    var body: some View {
        ZStack(alignment: .bottom) {
            Color.appBackground
                .ignoresSafeArea()

            VStack(spacing: 0) {
                header
                if let prompt = viewModel.promptText {
                    promptBanner(prompt)
                }
                if let notice = viewModel.attachmentNotice {
                    noticeBanner(notice)
                }
                editor
            }

            // Bottom recording panel — slides up over the lower third when recording.
            if isRecorderPresented {
                RecordingOverlayView(
                    recorder: recorder,
                    promptText: viewModel.promptText,
                    onStop: stopAndAttach,
                    onResume: { Task { _ = await recorder.resume() } }
                )
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .zIndex(1)
            }
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.85), value: isRecorderPresented)
        .safeAreaInset(edge: .bottom, spacing: 0) {
            bottomBar
        }
        .task {
            viewModel.configureRecording(recorder)
            viewModel.loadResumedDraftIfNeeded()
        }
        .onDisappear {
            if isDiscarding {
                recorder.cancel()                 // explicit discard → drop segments
            } else {
                if recorder.isActive { recorder.pause(reason: .manual) }  // keep for recovery
                viewModel.persistDraftNow()
            }
            viewModel.stopDictation()
        }
        .onChange(of: viewModel.didSave) { _, didSave in
            if didSave { dismiss() }
        }
        .interactiveDismissDisabled(false)   // swipe-down keeps the autosaved draft
        .modifier(CreateEntryPickersModifier(
            showPhotoCamera: $showPhotoCamera,
            showVideoCamera: $showVideoCamera,
            showPhotoLibrary: $showPhotoLibrary,
            showVideoLibrary: $showVideoLibrary,
            photoPickerItems: $photoPickerItems,
            videoPickerItem: $videoPickerItem,
            remainingPhotoSlots: AttachmentSet.maxPhotos - viewModel.attachments.photos.count,
            onPhotosData: { addPickedPhotos($0) },
            onVideoURL: { handlePickedVideo(url: $0) },
            showUploadPicker: $showUploadPicker,
            onPickedFile: { handlePickedFile($0) }
        ))
        .onChange(of: photoPickerItems) { _, items in
            guard !items.isEmpty else { return }
            photoPickerItems = []
            Task { await loadLibraryPhotos(items) }
        }
        .onChange(of: videoPickerItem) { _, item in
            guard let item else { return }
            videoPickerItem = nil
            Task { await loadLibraryVideo(item) }
        }
        .confirmationDialog("Close this entry?", isPresented: $showCloseDialog, titleVisibility: .visible) {
            Button("Keep as Draft") {
                viewModel.persistDraftNow()
                dismiss()
            }
            Button("Discard", role: .destructive) {
                isDiscarding = true
                viewModel.discardDraft()
                dismiss()
            }
            Button("Keep Editing", role: .cancel) {}
        } message: {
            Text("Your draft is saved automatically, keep it on the home screen, or discard it.")
        }
        .confirmationDialog("Add Photos", isPresented: $showPhotoSourceDialog, titleVisibility: .visible) {
            if CameraPicker.isCameraAvailable {
                Button("Take Photo") { showPhotoCamera = true }
            }
            Button("Choose from Library") { showPhotoLibrary = true }
        } message: {
            if !CameraPicker.isCameraAvailable {
                Text("Camera isn't available on this device.")
            }
        }
        .confirmationDialog("Add a Video", isPresented: $showVideoSourceDialog, titleVisibility: .visible) {
            if CameraPicker.isCameraAvailable {
                Button("Record Video") { showVideoCamera = true }
            }
            Button("Choose from Library") { showVideoLibrary = true }
        } message: {
            if !CameraPicker.isCameraAvailable {
                Text("Camera isn't available on this device.")
            }
        }
        .alert("Replace your attachments?", isPresented: replaceVideoAlertBinding) {
            Button("Replace", role: .destructive) {
                if let pendingVideo { viewModel.attachVideo(pendingVideo) }
                pendingVideo = nil
            }
            Button("Cancel", role: .cancel) {
                if let pendingVideo {
                    viewModel.discardUnattachedVideo(pendingVideo)
                }
                pendingVideo = nil
            }
        } message: {
            Text("A video entry replaces attached photos and voice recordings.")
        }
        .alert("Replace the recording?", isPresented: $confirmReplaceRecording) {
            Button("Re-record", role: .destructive) {
                viewModel.removeAudio()
                startRecording()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Your current voice recording will be replaced.")
        }
        .alert("Microphone & Speech Access Needed", isPresented: dictationDeniedBinding) {
            Button("Open Settings") { openSettings() }
            Button("Not Now", role: .cancel) {}
        } message: {
            Text("Enable Microphone and Speech Recognition for Argo in Settings to use dictation.")
        }
        .alert("Microphone Access Needed", isPresented: $recorder.permissionDenied) {
            Button("Open Settings") { openSettings() }
            Button("Not Now", role: .cancel) {}
        } message: {
            Text("Enable Microphone access for Argo in Settings to record voice entries.")
        }
    }

    // MARK: - Header

    private var header: some View {
        ZStack {
            Text("Journal Entry")
                .font(.sectionHeader)
                .foregroundStyle(Color.textPrimary)

            HStack {
                Button {
                    if viewModel.hasUnsavedContent {
                        showCloseDialog = true
                    } else {
                        isDiscarding = true
                        viewModel.discardDraft()   // nothing to keep; prune any empty draft
                        dismiss()
                    }
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 15, weight: .semibold))
                        .foregroundStyle(Color.textSecondary)
                        .frame(width: 38, height: 38)
                        .background(Circle().fill(Color.secondaryBackground))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Cancel")

                Spacer()

                Button {
                    Task {
                        // If Stop was just tapped, the merge may still be running —
                        // await it (and attach the clip) so the save includes the
                        // audio. Usually already done, so this is instant.
                        if await attachPendingRecording() {
                            viewModel.save()
                        }
                    }
                } label: {
                    Text("Save")
                        .font(.uiBody.weight(.semibold))
                        .foregroundStyle(.white)
                        .frame(minWidth: 72, minHeight: 38)
                        .background(
                            Capsule().fill(
                                Color.accentWarm.opacity(saveDisabled ? 0.4 : 1)
                            )
                        )
                }
                .buttonStyle(.plain)
                .disabled(saveDisabled)
                .accessibilityLabel("Save entry")
            }
        }
        .padding(.horizontal, Spacing.m)
        .padding(.vertical, Spacing.s)
    }

    private var saveDisabled: Bool {
        // `isActive` (recording OR paused), not just `isRecording`: a paused
        // recording still has unmerged segments on disk. Saving would delete the
        // draft media dir and lose them — the user must Stop (merge) first.
        !viewModel.canSave || recorder.isActive
    }

    // MARK: - Banners

    /// Serif quote banner for the prompt being answered (it becomes the
    /// entry title on save; the content stays pure).
    private func promptBanner(_ prompt: String) -> some View {
        HStack(alignment: .top, spacing: Spacing.s) {
            Rectangle()
                .fill(Color.accentWarm)
                .frame(width: 3)
            Text("\u{201C}\(prompt)\u{201D}")
                .font(.promptQuoteCompact)
                .foregroundStyle(Color.textPrimary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
        }
        .fixedSize(horizontal: false, vertical: true)
        .padding(Spacing.m)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous)
                .fill(Color.accentWarm.opacity(0.08))
        )
        .padding(.horizontal, Spacing.m)
        .padding(.bottom, Spacing.s)
        .accessibilityLabel("Prompt: \(prompt)")
    }

    private func noticeBanner(_ notice: String) -> some View {
        HStack(spacing: Spacing.s) {
            Image(systemName: "info.circle")
                .foregroundStyle(Color.accentWarm)
            Text(notice)
                .font(.captionText)
                .foregroundStyle(Color.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
            Button {
                viewModel.attachmentNotice = nil
            } label: {
                Image(systemName: "xmark")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.textSecondary)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Dismiss notice")
        }
        .padding(.horizontal, Spacing.m)
        .padding(.vertical, Spacing.s)
        .background(Color.secondaryBackground)
    }

    // MARK: - Editor

    private var editor: some View {
        ZStack(alignment: .topLeading) {
            if viewModel.text.isEmpty {
                Text("Write what's on your mind…")
                    .font(.journalBody)
                    .foregroundStyle(Color.textSecondary.opacity(0.8))
                    .padding(.horizontal, Spacing.m + 5)
                    .padding(.top, Spacing.s + 8)
                    .allowsHitTesting(false)
            }
            TextEditor(text: $viewModel.text)
                .font(.journalBody)
                .foregroundStyle(Color.textPrimary)
                .scrollContentBackground(.hidden)
                .focused($editorFocused)
                .padding(.horizontal, Spacing.m)
                .accessibilityLabel("Journal text")
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Bottom bar (attachments + media row)

    private var bottomBar: some View {
        VStack(spacing: 0) {
            if viewModel.hasVisibleAttachments {
                AttachmentStrip(
                    attachments: viewModel.attachments,
                    pendingAudioDuration: viewModel.pendingRecordingDuration,
                    loadingPhotoIDs: viewModel.loadingPhotoIDs,
                    isLoadingVideo: viewModel.isLoadingVideo,
                    isDisabled: false,
                    onRemovePhoto: { viewModel.removePhoto(id: $0) },
                    onRemoveVideo: { viewModel.removeVideo() },
                    onRemoveAudio: {
                        // Removing the instant chip while its merge is still
                        // running must cancel that merge, or it would re-attach
                        // the clip the user just dismissed.
                        if viewModel.pendingRecordingDuration != nil {
                            recorder.cancel()
                            viewModel.clearPendingRecording()
                        } else {
                            viewModel.removeAudio()
                        }
                    }
                )
                .padding(.bottom, Spacing.s)
            }

            MediaRow(
                isRecording: recorder.isRecording,
                recordingLabel: recorder.elapsedLabel,
                isDisabled: false,
                dictationState: viewModel.dictationState,
                onMic: handleMicTap,
                onPhoto: { showPhotoSourceDialog = true },
                onVideo: { showVideoSourceDialog = true },
                onDictate: { Task { await viewModel.toggleDictation() } },
                onUpload: { showUploadPicker = true }
            )
        }
        .background(Color.appBackground.opacity(0.001)) // keep hit-testing sane
    }

    // MARK: - Capture handlers

    private func handleMicTap() {
        if recorder.isActive {
            stopAndAttach()
            return
        }
        guard viewModel.attachments.canRecordAudio else {
            viewModel.attachmentNotice =
                "Remove photos or video to record a voice entry."
            return
        }
        if viewModel.attachments.audio != nil {
            confirmReplaceRecording = true
            return
        }
        viewModel.stopDictation()
        startRecording()
    }

    /// Starts the recorder and surfaces a non-permission start failure via
    /// the inline notice (permission denials show the Settings alert).
    private func startRecording() {
        Task {
            let started = await recorder.start()
            if started {
                isRecorderPresented = true
            } else if !recorder.permissionDenied {
                viewModel.attachmentNotice = "Recording couldn't start. Please try again."
            }
        }
    }

    /// Finalizes the in-flight recording and dismisses the recorder panel
    /// IMMEDIATELY. The segment merge runs in the background (`finishAndBeginMerge`
    /// returns to `.idle` synchronously), so Save un-grays and the panel slides
    /// away the instant Stop is tapped — no waiting on the export. The merged clip
    /// is attached when it's ready via `attachPendingRecording`. Shared by the
    /// overlay's X and Stop buttons.
    private func stopAndAttach() {
        // Capture the duration BEFORE the merge starts so the chip can show the
        // recorded time instantly, without waiting on the export.
        let pendingDuration = recorder.cumulativeElapsed
        recorder.finishAndBeginMerge()
        isRecorderPresented = false
        if pendingDuration > 0 {
            viewModel.beginPendingRecording(durationSec: pendingDuration)
        }
        Task { await attachPendingRecording() }
    }

    /// Awaits any background merge and attaches the resulting clip. If the merge
    /// failed the recorder returns to `.paused`, so we re-present the panel with a
    /// notice rather than silently dropping the audio. Idempotent: safe to call
    /// from both `stopAndAttach` and the Save handler (they share one merge task).
    /// Returns true when there is nothing left to finalize (ready to save).
    @discardableResult
    private func attachPendingRecording() async -> Bool {
        if let audio = await recorder.awaitPendingMerge() {
            viewModel.attachAudio(audio)   // swaps the instant chip for the real clip
        }
        if recorder.isActive {
            // Merge failed → recorder is `.paused` again; bring the panel back and
            // drop the instant chip (there's no clip to keep).
            viewModel.clearPendingRecording()
            isRecorderPresented = true
            viewModel.attachmentNotice = "Couldn't finish the recording, tap Stop to try again."
            return false
        }
        // No clip attached (e.g. empty recording): make sure the instant chip
        // doesn't linger. (On success `attachAudio` already cleared it.)
        viewModel.clearPendingRecording()
        return true
    }

    /// Stages a spinner per item, then decodes each and resolves it in place.
    private func addPickedPhotos(_ dataItems: [Data]) {
        let ids = viewModel.beginLoadingPhotos(count: dataItems.count)
        guard !ids.isEmpty else { return }
        Task {
            for (index, data) in dataItems.enumerated() {
                let photo = await PhotoAttachment.make(from: data)
                viewModel.resolveLoadingPhoto(id: ids[index], photo: photo)
            }
        }
    }

    private func loadLibraryPhotos(_ items: [PhotosPickerItem]) async {
        let ids = viewModel.beginLoadingPhotos(count: items.count)
        guard !ids.isEmpty else { return }
        var failureCount = 0
        for (index, item) in items.enumerated() {
            if let data = try? await item.loadTransferable(type: Data.self) {
                let photo = await PhotoAttachment.make(from: data)
                viewModel.resolveLoadingPhoto(id: ids[index], photo: photo)
            } else {
                viewModel.dropLoadingPhoto(id: ids[index])
                failureCount += 1
            }
        }
        if failureCount > 0 {
            viewModel.attachmentNotice = failureCount == 1
                ? "1 photo couldn't be added."
                : "\(failureCount) photos couldn't be added."
        }
    }

    private func loadLibraryVideo(_ item: PhotosPickerItem) async {
        viewModel.beginLoadingVideo()
        guard let picked = try? await item.loadTransferable(type: PickedVideo.self) else {
            viewModel.endLoadingVideo()
            viewModel.attachmentNotice = "That video couldn't be loaded."
            return
        }
        handlePickedVideo(url: picked.url)
    }

    private func handlePickedVideo(url: URL) {
        viewModel.beginLoadingVideo()
        Task {
            let video = await VideoAttachment.make(from: url)
            viewModel.endLoadingVideo()
            if viewModel.attachments.videoNeedsReplacementConfirm {
                pendingVideo = video
            } else {
                viewModel.attachVideo(video)
            }
        }
    }

    /// Handles a file chosen via the Upload importer: copies the
    /// security-scoped file into our temp dir, then routes it by kind into the
    /// same attach paths the recorder/camera use. Exclusivity + replace-confirm
    /// rules are enforced by the attach methods themselves.
    private func handlePickedFile(_ result: Result<[URL], Error>) {
        guard case .success(let urls) = result, let url = urls.first else {
            if case .failure = result {
                viewModel.attachmentNotice = "Couldn't add that file."
            }
            return
        }

        let type = try? url.resourceValues(forKeys: [.contentTypeKey]).contentType
        let kind = UploadFileKind.classify(type)
        guard kind != .unsupported else {
            viewModel.attachmentNotice = "That file type isn't supported."
            return
        }

        // Copy while the security scope is held; async work uses the local copy.
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }

        switch kind {
        case .image:
            guard let data = try? Data(contentsOf: url) else {
                viewModel.attachmentNotice = "Couldn't read that image."
                return
            }
            addPickedPhotos([data])

        case .audio, .video:
            let ext = url.pathExtension.isEmpty ? (kind == .audio ? "m4a" : "mov") : url.pathExtension
            let dest = FileManager.default.temporaryDirectory
                .appendingPathComponent("upload-\(UUID().uuidString).\(ext)")
            do {
                try FileManager.default.copyItem(at: url, to: dest)
            } catch {
                viewModel.attachmentNotice = "Couldn't add that file."
                return
            }
            if kind == .audio {
                handlePickedAudioFile(url: dest)
            } else {
                handlePickedVideo(url: dest)   // reuses the replace-confirm flow
            }

        case .unsupported:
            break   // handled above
        }
    }

    /// Builds an `AudioAttachment` from an uploaded audio file (duration via
    /// `AVURLAsset`) and stages it as a voice entry. `attachAudio` drops it with
    /// a notice if photos/video already occupy the entry.
    private func handlePickedAudioFile(url: URL) {
        Task {
            let asset = AVURLAsset(url: url)
            let duration = (try? await asset.load(.duration).seconds) ?? 0
            let audio = AudioAttachment(url: url, durationSec: duration.isFinite ? duration : 0)
            viewModel.attachAudio(audio)
        }
    }

    // MARK: - Alert bindings & helpers

    private var replaceVideoAlertBinding: Binding<Bool> {
        Binding(
            get: { pendingVideo != nil },
            set: { if !$0 { pendingVideo = nil } }
        )
    }

    private var dictationDeniedBinding: Binding<Bool> {
        Binding(
            get: { viewModel.showDictationDeniedAlert },
            set: { viewModel.showDictationDeniedAlert = $0 }
        )
    }

    private func openSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }
}

// MARK: - Picker presentation

/// Groups the four picker presentations so the main body stays readable.
private struct CreateEntryPickersModifier: ViewModifier {

    @Binding var showPhotoCamera: Bool
    @Binding var showVideoCamera: Bool
    @Binding var showPhotoLibrary: Bool
    @Binding var showVideoLibrary: Bool
    @Binding var photoPickerItems: [PhotosPickerItem]
    @Binding var videoPickerItem: PhotosPickerItem?
    let remainingPhotoSlots: Int
    let onPhotosData: ([Data]) -> Void
    let onVideoURL: (URL) -> Void
    @Binding var showUploadPicker: Bool
    let onPickedFile: (Result<[URL], Error>) -> Void

    func body(content: Content) -> some View {
        content
            .fullScreenCover(isPresented: $showPhotoCamera) {
                MultiPhotoCameraView(
                    remainingSlots: remainingPhotoSlots,
                    onComplete: { datas in
                        showPhotoCamera = false
                        onPhotosData(datas)
                    }
                )
                .ignoresSafeArea()
            }
            .fullScreenCover(isPresented: $showVideoCamera) {
                CameraPicker(mode: .video, onVideo: onVideoURL)
                    .ignoresSafeArea()
            }
            .photosPicker(
                isPresented: $showPhotoLibrary,
                selection: $photoPickerItems,
                maxSelectionCount: AttachmentSet.maxPhotos,
                matching: .images
            )
            .photosPicker(
                isPresented: $showVideoLibrary,
                selection: $videoPickerItem,
                matching: .videos
            )
            .fileImporter(
                isPresented: $showUploadPicker,
                allowedContentTypes: UploadFileKind.allowedContentTypes,
                allowsMultipleSelection: false,
                onCompletion: onPickedFile
            )
    }
}

// MARK: - Previews

#Preview("Empty") {
    CreateEntryView(
        request: CreateEntryRequest(),
        services: AppServices.mocks()
    )
}

#Preview("Prompt banner") {
    CreateEntryView(
        request: CreateEntryRequest(promptText: MockData.cannedDailyPrompt),
        services: AppServices.mocks()
    )
}

#Preview("With attachments") {
    CreateEntryView(viewModel: .previewSeeded { viewModel in
        viewModel.text = "A golden-hour walk through the old orchard."
        viewModel.attachments.addPhotos([
            .init(imageData: Data(), thumbnail: .previewSwatch(.systemOrange)),
            .init(imageData: Data(), thumbnail: .previewSwatch(.systemTeal)),
        ])
    })
}

#Preview("Dark, prompt") {
    CreateEntryView(
        request: CreateEntryRequest(promptText: MockData.cannedDailyPrompt),
        services: AppServices.mocks()
    )
    .preferredColorScheme(.dark)
}

// MARK: Preview helpers

extension CreateEntryViewModel {
    /// Builds a mock-backed view model and lets the preview seed state.
    @MainActor
    static func previewSeeded(
        _ seed: (CreateEntryViewModel) -> Void
    ) -> CreateEntryViewModel {
        let viewModel = CreateEntryViewModel(
            request: CreateEntryRequest(),
            dependencies: CreateEntryDependencies(services: AppServices.mocks())
        )
        seed(viewModel)
        return viewModel
    }
}

private extension UIImage {
    /// Solid-color swatch used as a stand-in photo thumbnail in previews.
    static func previewSwatch(_ color: UIColor) -> UIImage {
        UIGraphicsImageRenderer(size: CGSize(width: 64, height: 64)).image { context in
            color.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 64, height: 64))
        }
    }
}
