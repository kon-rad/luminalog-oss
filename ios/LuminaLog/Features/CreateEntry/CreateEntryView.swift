import PhotosUI
import SwiftUI

/// Create Journal Entry (design §5): big serif editor with live dictation,
/// optional prompt banner, media capture row, and the save pipeline.
struct CreateEntryView: View {

    @Environment(\.dismiss) private var dismiss

    @StateObject private var viewModel: CreateEntryViewModel
    @StateObject private var recorder = AudioRecorderController()

    // Local presentation state.
    @State private var showDiscardDialog = false
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
        ZStack {
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
        }
        .safeAreaInset(edge: .bottom, spacing: 0) {
            bottomBar
        }
        .onDisappear {
            viewModel.stopDictation()
            recorder.cancel()
        }
        .onChange(of: viewModel.didSave) { _, didSave in
            if didSave { dismiss() }
        }
        .interactiveDismissDisabled(viewModel.hasUnsavedContent)
        .modifier(CreateEntryPickersModifier(
            showPhotoCamera: $showPhotoCamera,
            showVideoCamera: $showVideoCamera,
            showPhotoLibrary: $showPhotoLibrary,
            showVideoLibrary: $showVideoLibrary,
            photoPickerItems: $photoPickerItems,
            videoPickerItem: $videoPickerItem,
            remainingPhotoSlots: AttachmentSet.maxPhotos - viewModel.attachments.photos.count,
            onPhotosData: { addPickedPhotos($0) },
            onVideoURL: { handlePickedVideo(url: $0) }
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
        .confirmationDialog("Discard this entry?", isPresented: $showDiscardDialog, titleVisibility: .visible) {
            Button("Discard", role: .destructive) {
                viewModel.cleanupTempFiles()
                dismiss()
            }
            Button("Keep Editing", role: .cancel) {}
        } message: {
            Text("Your writing and attachments will be lost.")
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
            Text("Enable Microphone and Speech Recognition for LuminaLog in Settings to use dictation.")
        }
        .alert("Microphone Access Needed", isPresented: $recorder.permissionDenied) {
            Button("Open Settings") { openSettings() }
            Button("Not Now", role: .cancel) {}
        } message: {
            Text("Enable Microphone access for LuminaLog in Settings to record voice entries.")
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
                        showDiscardDialog = true
                    } else {
                        viewModel.cleanupTempFiles()
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
                    viewModel.save()
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
        !viewModel.canSave || recorder.isRecording
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
        }
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
                    loadingPhotoIDs: viewModel.loadingPhotoIDs,
                    isLoadingVideo: viewModel.isLoadingVideo,
                    isDisabled: false,
                    onRemovePhoto: { viewModel.removePhoto(id: $0) },
                    onRemoveVideo: { viewModel.removeVideo() },
                    onRemoveAudio: { viewModel.removeAudio() }
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
                onDictate: { Task { await viewModel.toggleDictation() } }
            )
        }
        .background(Color.appBackground.opacity(0.001)) // keep hit-testing sane
    }

    // MARK: - Capture handlers

    private func handleMicTap() {
        if recorder.isRecording {
            if let audio = recorder.stop() {
                viewModel.attachAudio(audio)
            }
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
            if !started, !recorder.permissionDenied {
                viewModel.attachmentNotice = "Recording couldn't start. Please try again."
            }
        }
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
