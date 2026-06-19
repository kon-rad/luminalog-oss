import Foundation
import OSLog
import UIKit

/// Drives the voice call screen (design §8): creates the `.voice` chat,
/// starts the call, mirrors `VoiceCallEvent`s into UI state, and runs the
/// duration timer.
@MainActor
final class VoiceCallViewModel: ObservableObject {

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "voice-call")

    /// Screen-level lifecycle.
    enum Phase: Equatable {
        case connecting
        case active
        case ended(reason: String?)
        case failed(message: String)
        /// User has no credits; the view should dismiss and show the credit store.
        case insufficientCredits
    }

    /// Who is "holding the floor" while the call is active — drives the orb.
    enum SpeakingState: Equatable {
        case listening
        case thinking
        case assistantSpeaking
        case userSpeaking

        var caption: String {
            switch self {
            case .listening: return "Listening…"
            case .thinking: return "Thinking…"
            case .assistantSpeaking: return "Speaking…"
            case .userSpeaking: return "I hear you…"
            }
        }
    }

    enum DisplayMode: Equatable {
        case animation
        case transcript
    }

    // MARK: - Published state

    @Published private(set) var phase: Phase = .connecting
    @Published private(set) var speakingState: SpeakingState = .listening
    @Published private(set) var transcript: [ChatMessage] = []
    /// In-progress assistant caption while it speaks.
    @Published private(set) var assistantPartial: String?
    @Published private(set) var elapsedSeconds = 0
    @Published var displayMode: DisplayMode = .animation
    @Published private(set) var isMuted = false
    /// The `.voice` chat backing this call (created on start).
    @Published private(set) var chat: Chat?
    /// True when fewer than ~1 minute of credit remains — drives the warning pill.
    @Published private(set) var lowCreditWarning = false
    /// True once the call was auto-ended because the credit budget ran out.
    @Published private(set) var outOfCredits = false

    private let voice: VoiceCallService
    private let chats: ChatRepository
    private let credits: CreditService

    private var eventsTask: Task<Void, Never>?
    private var timerTask: Task<Void, Never>?
    private var balanceTask: Task<Void, Never>?
    private var hasStarted = false
    /// Set to true when `.connected` fires; prevents charging for failed connection attempts.
    private var callWasConnected = false
    /// Seconds of call time the current balance buys (credits × 6 min). Snapshotted
    /// at `.connected` and raised live if the user tops up mid-call.
    private var budgetSeconds = 0

    init(voice: VoiceCallService, chats: ChatRepository, credits: CreditService) {
        self.voice = voice
        self.chats = chats
        self.credits = credits
    }

    deinit {
        eventsTask?.cancel()
        timerTask?.cancel()
        balanceTask?.cancel()
    }

    // MARK: - Derived state

    var durationText: String {
        String(format: "%d:%02d", elapsedSeconds / 60, elapsedSeconds % 60)
    }

    // MARK: - Lifecycle

    /// Creates the voice chat, subscribes to call events (before starting,
    /// so `connecting` is observed), then starts the call. Idempotent.
    /// Transitions to `.insufficientCredits` when balance is zero so the view
    /// can dismiss and present the credit store.
    func start() async {
        guard !hasStarted else { return }
        hasStarted = true

        let balance = await credits.currentBalance()
        guard balance >= 1 else {
            phase = .insufficientCredits
            return
        }

        let stream = voice.events
        eventsTask = Task { [weak self] in
            for await event in stream {
                guard let self, !Task.isCancelled else { return }
                self.handle(event)
            }
        }

        do {
            let chat = try await chats.createChat(kind: .voice, title: "Voice call")
            self.chat = chat
            try await voice.startCall(chatId: chat.id)
        } catch {
            Self.logger.error("start call failed: \(error.localizedDescription, privacy: .public)")
            stopTimer()
            phase = .failed(message: error.localizedDescription)
        }
    }

    func endCall() async {
        await voice.endCall()
    }

    func toggleMute() {
        isMuted.toggle()
        voice.setMuted(isMuted)
    }

    func toggleDisplayMode() {
        displayMode = displayMode == .animation ? .transcript : .animation
    }

    // MARK: - Event handling

    private func handle(_ event: VoiceCallEvent) {
        switch event {
        case .connecting:
            phase = .connecting

        case .connected:
            phase = .active
            speakingState = .listening
            callWasConnected = true
            setScreenAwake(true)
            startBudgetTracking()
            startTimer()

        case .listening:
            speakingState = .listening
            assistantPartial = nil

        case .userSpeaking:
            speakingState = .userSpeaking

        case .assistantSpeaking(let partial):
            speakingState = partial == nil ? .thinking : .assistantSpeaking
            assistantPartial = partial

        case .transcriptUpdated(let message):
            transcript.append(message)
            if message.role == .assistant {
                assistantPartial = nil
            }

        case .ended(let reason):
            stopTimer()
            setScreenAwake(false)
            deductCreditsForCall()
            phase = .ended(reason: outOfCredits ? "You're out of credits." : reason)

        case .failed(let message):
            stopTimer()
            setScreenAwake(false)
            deductCreditsForCall()
            phase = .failed(message: message)
        }
    }

    // MARK: - Credit budget (live metering)

    /// Snapshots the call-time budget from the current balance and keeps it in
    /// sync with the live balance stream so a mid-call top-up extends the call.
    private func startBudgetTracking() {
        Task { [weak self] in
            guard let self else { return }
            let balance = await self.credits.currentBalance()
            self.budgetSeconds = max(self.budgetSeconds, balance * CreditPack.minutesPerCredit * 60)
        }
        guard balanceTask == nil else { return }
        balanceTask = Task { [weak self] in
            guard let stream = self?.credits.balanceStream() else { return }
            for await balance in stream {
                guard let self, !Task.isCancelled else { return }
                self.budgetSeconds = max(self.budgetSeconds, balance * CreditPack.minutesPerCredit * 60)
            }
        }
    }

    /// Called each timer tick: raises the low-credit warning near the end and
    /// auto-ends the call once the budget is exhausted.
    private func checkBudget() {
        guard budgetSeconds > 0 else { return }
        let remaining = budgetSeconds - elapsedSeconds
        lowCreditWarning = remaining > 0 && remaining <= 60
        if remaining <= 0 && !outOfCredits {
            outOfCredits = true
            lowCreditWarning = false
            Task { [weak self] in await self?.voice.endCall() }
        }
    }

    // MARK: - Screen wake

    /// Keeps the screen awake while the call is live (idle-timer auto-lock off).
    private func setScreenAwake(_ on: Bool) {
        UIApplication.shared.isIdleTimerDisabled = on
    }

    /// Safety net for the view's `onDisappear` — always re-enable auto-lock.
    func releaseScreenWake() {
        setScreenAwake(false)
    }

    // MARK: - Credit deduction

    private func deductCreditsForCall() {
        guard callWasConnected, elapsedSeconds > 0 else { return }
        callWasConnected = false
        // 1 credit = 6 minutes (docs/PRICING.md); round partial blocks up, min 1.
        let secondsPerCredit = Double(CreditPack.minutesPerCredit * 60)
        let creditsUsed = max(1, Int(ceil(Double(elapsedSeconds) / secondsPerCredit)))
        Task { [weak self] in
            guard let self else { return }
            try? await credits.deductCredits(creditsUsed)
            Self.logger.info("deducted \(creditsUsed) credit(s) for \(self.elapsedSeconds)s call")
        }
    }

    // MARK: - Duration timer

    private func startTimer() {
        guard timerTask == nil else { return }
        timerTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 1_000_000_000)
                guard let self, !Task.isCancelled else { return }
                self.elapsedSeconds += 1
                self.checkBudget()
            }
        }
    }

    private func stopTimer() {
        timerTask?.cancel()
        timerTask = nil
    }
}

// MARK: - Preview hooks

#if DEBUG
extension VoiceCallViewModel {
    static func preview(balance: Int = 5) -> VoiceCallViewModel {
        let chats = MockChatRepository()
        return VoiceCallViewModel(
            voice: MockVoiceCallService(chats: chats),
            chats: chats,
            credits: MockCreditService(balance: balance)
        )
    }

    /// Seeds state so previews can render each phase without a live call.
    func setPreviewState(
        phase: Phase,
        speakingState: SpeakingState = .listening,
        transcript: [ChatMessage] = [],
        assistantPartial: String? = nil,
        elapsedSeconds: Int = 0,
        displayMode: DisplayMode = .animation
    ) {
        self.phase = phase
        self.speakingState = speakingState
        self.transcript = transcript
        self.assistantPartial = assistantPartial
        self.elapsedSeconds = elapsedSeconds
        self.displayMode = displayMode
    }

    /// Prevents `start()` from kicking off a real (mock) call in previews.
    func disableStartForPreviews() {
        hasStarted = true
    }

    /// Seed the elapsed clock without the real timer (metering tests).
    func setElapsedForTesting(_ seconds: Int) { elapsedSeconds = seconds }

    /// Seed the call-time budget directly (metering tests).
    func primeBudgetForTesting(_ seconds: Int) { budgetSeconds = seconds }

    /// Mark the call as connected so deduction tests exercise the charge path.
    func markConnectedForTesting() { callWasConnected = true }

    /// Drive a single budget check (metering tests).
    func checkBudgetForTesting() { checkBudget() }
}
#endif
