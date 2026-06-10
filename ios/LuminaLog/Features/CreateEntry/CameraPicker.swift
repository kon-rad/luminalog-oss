import AVFoundation
import SwiftUI
import UIKit
import UniformTypeIdentifiers

/// `UIImagePickerController` wrapper for in-app camera capture — photos or
/// movies. Library selection uses `PhotosPicker` instead; this exists only
/// for the "Take Photo" / "Record Video" paths (design §5 media row).
struct CameraPicker: UIViewControllerRepresentable {

    enum Mode {
        case photo
        case video
    }

    let mode: Mode
    var onImage: (Data) -> Void = { _ in }
    var onVideo: (URL) -> Void = { _ in }

    /// Whether the device has a camera (false on simulators) — callers gray
    /// out / omit the capture options when unavailable.
    static var isCameraAvailable: Bool {
        UIImagePickerController.isSourceTypeAvailable(.camera)
    }

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        switch mode {
        case .photo:
            picker.mediaTypes = [UTType.image.identifier]
        case .video:
            picker.mediaTypes = [UTType.movie.identifier]
            picker.videoQuality = .typeHigh
            picker.cameraCaptureMode = .video
        }
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        private let parent: CameraPicker

        init(_ parent: CameraPicker) {
            self.parent = parent
        }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            defer { picker.dismiss(animated: true) }

            if let image = info[.originalImage] as? UIImage,
               let data = image.jpegData(compressionQuality: 0.85) {
                parent.onImage(data)
            } else if let mediaURL = info[.mediaURL] as? URL {
                // The camera's temp file is deleted once the picker goes
                // away; keep our own copy.
                let copy = FileManager.default.temporaryDirectory
                    .appendingPathComponent("\(UUID().uuidString).\(mediaURL.pathExtension)")
                try? FileManager.default.copyItem(at: mediaURL, to: copy)
                parent.onVideo(copy)
            }
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            picker.dismiss(animated: true)
        }
    }
}

/// `Transferable` for receiving a library-picked video as a local file copy.
struct PickedVideo: Transferable {
    let url: URL

    static var transferRepresentation: some TransferRepresentation {
        FileRepresentation(contentType: .movie) { video in
            SentTransferredFile(video.url)
        } importing: { received in
            let copy = FileManager.default.temporaryDirectory
                .appendingPathComponent("\(UUID().uuidString).\(received.file.pathExtension)")
            try FileManager.default.copyItem(at: received.file, to: copy)
            return PickedVideo(url: copy)
        }
    }
}
