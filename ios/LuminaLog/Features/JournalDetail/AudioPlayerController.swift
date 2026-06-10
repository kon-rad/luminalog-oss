import AVFoundation
import Foundation

/// Thin `AVPlayer` wrapper for the voice-entry audio card (design §4):
/// play/pause, periodic time updates for the scrubber, seek, and a graceful
/// `unavailable` state when the URL is missing or fails to load.
///
/// `isPlaying` is derived from KVO on `player.timeControlStatus` (a single
/// source of truth), so system-initiated pauses — interruptions, headphones
/// unplugged, end of playback — keep the UI in sync automatically. The
/// shared audio session is activated on play only and deactivated (with
/// `.notifyOthersOnDeactivation`) on pause, end, and teardown.
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
    private var timeControlObservation: NSKeyValueObservation?
    private var endObserver: NSObjectProtocol?
    private var interruptionObserver: NSObjectProtocol?
    private var routeChangeObserver: NSObjectProtocol?
    private var isScrubbing = false

    deinit {
        // Best-effort cleanup only — the real teardown path is the view's
        // `.onDisappear` calling `teardown()`. (Swift 5: stored-property
        // access from deinit is permitted on a @MainActor class.)
        if let timeObserver {
            player?.removeTimeObserver(timeObserver)
        }
        statusObservation?.invalidate()
        timeControlObservation?.invalidate()
        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
        }
        if let interruptionObserver {
            NotificationCenter.default.removeObserver(interruptionObserver)
        }
        if let routeChangeObserver {
            NotificationCenter.default.removeObserver(routeChangeObserver)
        }
    }

    // MARK: - Loading

    /// Loads the player. `fallbackDuration` (the stored `durationSec`) seeds
    /// the total label before — or instead of — the asset reporting one.
    /// Idempotent: reloading tears down the previous player and observers.
    func load(url: URL?, fallbackDuration: Double?) {
        teardown()
        loadState = .loading
        currentTime = 0

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
                default:
                    break
                }
            }
        }

        // Single source of truth for `isPlaying`: the player's own state.
        timeControlObservation = player.observe(\.timeControlStatus, options: [.initial, .new]) { [weak self] player, _ in
            let playing = player.timeControlStatus != .paused
            Task { @MainActor [weak self] in
                guard let self, self.isPlaying != playing else { return }
                self.isPlaying = playing
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
                self.currentTime = 0
                self.player?.seek(to: .zero)
                self.deactivateSession()
            }
        }

        // Phone call / Siri / another app taking the session: pause and let
        // the timeControlStatus observation sync `isPlaying`.
        interruptionObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: AVAudioSession.sharedInstance(),
            queue: .main
        ) { [weak self] notification in
            guard
                let raw = notification.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                AVAudioSession.InterruptionType(rawValue: raw) == .began
            else { return }
            MainActor.assumeIsolated {
                self?.pause()
            }
        }

        // Headphones unplugged / Bluetooth device gone: pause instead of
        // blasting from the speaker.
        routeChangeObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.routeChangeNotification,
            object: AVAudioSession.sharedInstance(),
            queue: .main
        ) { [weak self] notification in
            guard
                let raw = notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
                AVAudioSession.RouteChangeReason(rawValue: raw) == .oldDeviceUnavailable
            else { return }
            MainActor.assumeIsolated {
                self?.pause()
            }
        }
    }

    // MARK: - Controls

    func togglePlayPause() {
        guard loadState == .ready, let player else { return }
        if isPlaying {
            pause()
        } else {
            let session = AVAudioSession.sharedInstance()
            try? session.setCategory(.playback)
            try? session.setActive(true)
            player.play()
            // `isPlaying` flips via the timeControlStatus observation.
        }
    }

    func pause() {
        player?.pause()
        deactivateSession()
    }

    /// Releases the player, observers, and the audio session. Called from
    /// the view's `.onDisappear` (and by `load` for idempotent reloads).
    func teardown() {
        player?.pause()
        removeObservers()
        player = nil
        if isPlaying {
            isPlaying = false
        }
        deactivateSession()
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

    // MARK: - Session / observers

    private func deactivateSession() {
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }

    private func removeObservers() {
        if let timeObserver {
            player?.removeTimeObserver(timeObserver)
            self.timeObserver = nil
        }
        statusObservation?.invalidate()
        statusObservation = nil
        timeControlObservation?.invalidate()
        timeControlObservation = nil
        if let endObserver {
            NotificationCenter.default.removeObserver(endObserver)
            self.endObserver = nil
        }
        if let interruptionObserver {
            NotificationCenter.default.removeObserver(interruptionObserver)
            self.interruptionObserver = nil
        }
        if let routeChangeObserver {
            NotificationCenter.default.removeObserver(routeChangeObserver)
            self.routeChangeObserver = nil
        }
    }
}
