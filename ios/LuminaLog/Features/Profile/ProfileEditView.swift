import PhotosUI
import SwiftUI
import UIKit

/// Pushed editor for avatar, display name, and biography. Avatar uploads on
/// pick; name + bio commit together via the "Save" toolbar button.
struct ProfileEditView: View {

    @StateObject private var viewModel: ProfileEditViewModel
    @Environment(\.dismiss) private var dismiss

    @State private var showPhotoSourceDialog = false
    @State private var showCamera = false
    @State private var showLibrary = false
    @State private var photoPickerItem: PhotosPickerItem?

    init(viewModel: ProfileEditViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel)
    }

    var body: some View {
        ScrollView {
            VStack(spacing: Spacing.l) {
                avatarSection
                if let message = viewModel.errorMessage {
                    Text(message)
                        .font(.captionText)
                        .foregroundStyle(Color.danger)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                nameSection
                groupedSections
            }
            .padding(.horizontal, Spacing.m)
            .padding(.top, Spacing.m)
            .padding(.bottom, Spacing.xl)
        }
        .background(Color.appBackground.ignoresSafeArea())
        .navigationTitle("Edit Profile")
        .navigationBarTitleDisplayMode(.inline)
        .scrollDismissesKeyboard(.interactively)
        .task { viewModel.start() }
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    Task {
                        if await viewModel.save() { dismiss() }
                    }
                } label: {
                    if viewModel.isSaving {
                        ProgressView()
                    } else {
                        Text("Save").font(.uiBody.weight(.semibold))
                    }
                }
                .disabled(viewModel.isSaving || !viewModel.isDirty)
            }
        }
        .fullScreenCover(isPresented: $showCamera) {
            CameraPicker(mode: .photo, onImage: { data in
                Task { await viewModel.uploadAvatar(imageData: data) }
            })
            .ignoresSafeArea()
        }
        .photosPicker(isPresented: $showLibrary, selection: $photoPickerItem, matching: .images)
        .onChange(of: photoPickerItem) { _, item in
            guard let item else { return }
            photoPickerItem = nil
            Task { await loadLibraryPhoto(item) }
        }
        .confirmationDialog("Update Profile Photo", isPresented: $showPhotoSourceDialog, titleVisibility: .visible) {
            if CameraPicker.isCameraAvailable {
                Button("Take Photo") { showCamera = true }
            }
            Button("Choose from Library") { showLibrary = true }
        }
    }

    // MARK: - Avatar

    private var avatarSection: some View {
        Button { showPhotoSourceDialog = true } label: {
            ZStack(alignment: .bottomTrailing) {
                avatarImage
                    .frame(width: 88, height: 88)
                    .clipShape(Circle())
                    .overlay {
                        if viewModel.isUploadingPhoto {
                            Circle().fill(.black.opacity(0.35))
                            ProgressView().tint(.white)
                        }
                    }
                Image(systemName: "camera.fill")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 26, height: 26)
                    .background(Circle().fill(Color.accentWarm))
                    .overlay(Circle().strokeBorder(Color.appBackground, lineWidth: 2))
            }
        }
        .buttonStyle(.plain)
        .disabled(viewModel.isUploadingPhoto)
        .accessibilityLabel("Change profile photo")
    }

    @ViewBuilder
    private var avatarImage: some View {
        if let url = viewModel.avatarURL {
            AsyncImage(url: url) { phase in
                if case .success(let image) = phase {
                    image.resizable().scaledToFill()
                } else {
                    initialsPlaceholder
                }
            }
        } else {
            initialsPlaceholder
        }
    }

    private var initialsPlaceholder: some View {
        ZStack {
            Circle().fill(Color.accentWarm.opacity(0.18))
            if viewModel.initials.isEmpty {
                Image(systemName: "person.fill")
                    .font(.system(size: 34, weight: .light))
                    .foregroundStyle(Color.accentWarm)
            } else {
                Text(viewModel.initials)
                    .font(.system(.title, design: .serif).weight(.semibold))
                    .foregroundStyle(Color.accentWarm)
            }
        }
    }

    // MARK: - Name (profile header field)

    private var nameField: ProfileField {
        ProfileFieldCatalog.all.first { $0.isHeader } ?? ProfileFieldCatalog.all[0]
    }

    private var nameSection: some View {
        VStack(alignment: .leading, spacing: Spacing.s) {
            Text("Name")
                .font(.sectionHeader)
                .foregroundStyle(Color.textPrimary)
            TextField("Your name", text: Binding(
                get: { viewModel.value(for: nameField) },
                set: { viewModel.setValue($0, for: nameField) }
            ))
                .font(.uiBody)
                .foregroundStyle(Color.textPrimary)
                .textInputAutocapitalization(.words)
                .padding(Spacing.m)
                .background(
                    RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous)
                        .fill(Color.secondaryBackground.opacity(0.6))
                )
                .accessibilityLabel("Display name")
        }
        .padding(Spacing.m)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                .fill(Color.cardBackground)
        )
    }

    // MARK: - Grouped fields (catalog-driven, with voice dictation)

    private var groupedSections: some View {
        ForEach(ProfileField.Group.allCases, id: \.self) { group in
            VStack(alignment: .leading, spacing: Spacing.m) {
                Text(group.title)
                    .font(.sectionHeader)
                    .foregroundStyle(Color.textPrimary)
                    .frame(maxWidth: .infinity, alignment: .leading)
                ForEach(ProfileFieldCatalog.bodyFields(in: group)) { field in
                    fieldRow(field)
                }
            }
            .padding(Spacing.m)
            .background(
                RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                    .fill(Color.cardBackground)
            )
        }
    }

    @ViewBuilder
    private func fieldRow(_ field: ProfileField) -> some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text(field.title)
                .font(.captionText)
                .foregroundStyle(Color.textSecondary)
            DictationField(
                placeholder: field.title,
                multiline: field.multiline,
                text: Binding(
                    get: { viewModel.value(for: field) },
                    set: { viewModel.setValue($0, for: field) }
                ),
                speech: viewModel.speech
            )
            if field.key == "biography" {
                Text("\(viewModel.bioWordCount) / \(ProfileEditViewModel.bioWordLimit) words")
                    .font(.captionText)
                    .foregroundStyle(
                        viewModel.bioWordCount >= ProfileEditViewModel.bioWordLimit
                            ? Color.accentWarm
                            : Color.textSecondary
                    )
                    .frame(maxWidth: .infinity, alignment: .trailing)
                    .accessibilityLabel("Bio length \(viewModel.bioWordCount) of \(ProfileEditViewModel.bioWordLimit) words")
            }
        }
    }

    // MARK: - Photo loading

    private func loadLibraryPhoto(_ item: PhotosPickerItem) async {
        guard
            let data = try? await item.loadTransferable(type: Data.self),
            let jpegData = ProfileEditView.reencodedJPEG(from: data)
        else {
            viewModel.errorMessage = "That photo couldn't be loaded."
            return
        }
        await viewModel.uploadAvatar(imageData: jpegData)
    }

    static func reencodedJPEG(from data: Data, maxDimension: CGFloat = 512) -> Data? {
        guard let image = UIImage(data: data) else { return nil }
        let longestSide = max(image.size.width, image.size.height)
        guard longestSide > 0 else { return nil }
        let scale = min(1, maxDimension / longestSide)
        let targetSize = CGSize(
            width: (image.size.width * scale).rounded(),
            height: (image.size.height * scale).rounded()
        )
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let rendered = UIGraphicsImageRenderer(size: targetSize, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: targetSize))
        }
        return rendered.jpegData(compressionQuality: 0.85)
    }
}
