import UIKit
import Photos

enum PhotoSaveResult { case saved, denied, failed }

/// Saves a rendered image into the user's photo library using add-only
/// authorization (`NSPhotoLibraryAddUsageDescription`, already declared).
enum PhotoSaver {
    static func save(_ image: UIImage) async -> PhotoSaveResult {
        let status = await PHPhotoLibrary.requestAuthorization(for: .addOnly)
        guard status == .authorized || status == .limited else { return .denied }
        do {
            try await PHPhotoLibrary.shared().performChanges {
                PHAssetChangeRequest.creationRequestForAsset(from: image)
            }
            return .saved
        } catch {
            return .failed
        }
    }
}
