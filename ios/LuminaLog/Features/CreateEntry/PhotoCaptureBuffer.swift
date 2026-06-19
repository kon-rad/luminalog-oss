import Foundation

/// Pure model backing the multi-shot camera: holds the JPEG data captured this
/// session and enforces the remaining-slot cap. No AVFoundation/UIKit so it can
/// be unit-tested. `remainingSlots` at init is
/// `AttachmentSet.maxPhotos - already-staged photos`.
struct PhotoCaptureBuffer {
    private let capacity: Int
    private(set) var captured: [Data] = []

    init(remainingSlots: Int) {
        capacity = max(0, remainingSlots)
    }

    var remainingSlots: Int { max(0, capacity - captured.count) }
    var canCapture: Bool { remainingSlots > 0 }

    /// Appends a captured JPEG, ignoring it when already at capacity.
    mutating func add(_ data: Data) {
        guard canCapture else { return }
        captured.append(data)
    }

    /// Removes the capture at `index` (no-op if out of range).
    mutating func remove(at index: Int) {
        guard captured.indices.contains(index) else { return }
        captured.remove(at: index)
    }
}
