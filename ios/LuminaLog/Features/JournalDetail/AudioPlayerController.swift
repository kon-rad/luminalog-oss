import AVFoundation
import Foundation

/// Thin `AVPlayer` wrapper for the voice-entry audio card (design §4):
/// play/pause, periodic time updates for the scrubber, seek, and a graceful
/// `unavailable` state when the URL is missing or fails to load.
@MainActor
final class AudioPlayerController: ObservableObject {

    enum LoadState: Equatable {
        case loading
        case ready
        case unavailable
    }

    @Published private(set) var loadState: LoadState = .loading
    @Published private(set) var isPlaying = false
    @Published private(set) var currentTime: Double = 0
    @Published private(set) var duration: Double = 0

    private var player: AVPlayer?
    private var timeObserver: Any?
    private var statusObservation: NSKeyValueObservation?
    private var endObserver: NSObjectProtocol?
    private var isScrubbing = false

    deinit {
        if let timeObserver {
            player?.removeTimeObserver(timeObserver)
        }
        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
        }
    }

    // MARK: - Loading

    /// Loads the player. `fallbackDuration` (the stored `durationSec`) seeds
    /// the total label before — or instead of — the asset reporting one.
    func load(url: URL?, fallbackDuration: Double?) {
        if let fallbackDuration, fallbackDuration > 0 {
            duration = fallbackDuration
        }
        guard let url else {
            loadState = .unavailable
            return
        }
        // Local files that don't exist (e.g. demo-mode seed entries) fail
        // fast instead of waiting on AVPlayerItem.
        if url.isFileURL, !FileManager.default.fileExists(atPath: url.path) {
            loadState = .unavailable
            return
        }

        let item = AVPlayerItem(url: url)
        let player = AVPlayer(playerItem: item)
        self.player = player

        statusObservation = item.observe(\.status, options: [.initial, .new]) { [weak self] item, _ in
            let status = item.status
            let assetDuration = item.duration.seconds
            Task { @MainActor [weak self] in
                guard let self else { return }
                switch status {
                case .readyToPlay:
                    self.loadState = .ready
                    if assetDuration.isFinite, assetDuration > 0 {
                        self.duration = assetDuration
                    }
                case .failed:
                    self.loadState = .unavailable
                    self.isPlaying = false
                default:
                    break
                }
            }
        }

        let interval = CMTime(seconds: 0.25, preferredTimescale: 600)
        timeObserver = player.addPeriodicTimeObserver(forInterval: interval, queue: .main) { [weak self] time in
            MainActor.assumeIsolated {
                guard let self, !self.isScrubbing else { return }
                let seconds = time.seconds
                guard seconds.isFinite else { return }
                self.currentTime = self.duration > 0 ? min(seconds, self.duration) : seconds
            }
        }

        endObserver = NotificationCenter.default.addObserver(
            forName: AVPlayerItem.didPlayToEndTimeNotification,
            object: item,
            queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated {
                guard let self else { return }
                self.isPlaying = false
                self.currentTime = 0
                self.player?.seek(to: .zero)
            }
        }
    }

    // MARK: - Controls

    func togglePlayPause() {
        guard loadState == .ready, let player else { return }
        if isPlaying {
            player.pause()
            isPlaying = false
        } else {
            try? AVAudioSession.sharedInstance().setCategory(.playback)
            try? AVAudioSession.sharedInstance().setActive(true)
            player.play()
            isPlaying = true
        }
    }

    func pause() {
        player?.pause()
        isPlaying = false
    }

    /// Scrubber drag in progress (Slider value changes).
    func setScrubTime(_ seconds: Double) {
        currentTime = seconds
        if !isScrubbing {
            seek(to: seconds)
        }
    }

    /// Scrubber drag began/ended (Slider `onEditingChanged`).
    func scrubbing(_ active: Bool) {
        isScrubbing = active
        if !active {
            seek(to: currentTime)
        }
    }

    private func seek(to seconds: Double) {
        guard let player else { return }
        let time = CMTime(seconds: seconds, preferredTimescale: 600)
        player.seek(to: time, toleranceBefore: .zero, toleranceAfter: .zero)
    }
}
