import SwiftUI

/// Only these local voices are exposed to the user. The ID is stored on this device.
enum CallVoiceChoice: String, CaseIterable, Identifiable, Sendable {
    case heart = "af_heart"
    case bella = "af_bella"
    case adam = "am_adam"
    case emma = "bf_emma"
    case device = "device"

    static let storageKey = "callVoiceChoice.v1"

    var id: String { rawValue }
    var title: String {
        switch self {
        case .heart: return "Heart"
        case .bella: return "Bella"
        case .adam: return "Adam"
        case .emma: return "Emma"
        case .device: return "Device voice"
        }
    }

    var isNeural: Bool { self != .device }

    static func saved(in defaults: UserDefaults) -> Self {
        Self(rawValue: defaults.string(forKey: storageKey) ?? "") ?? .heart
    }
}

enum CallVoicePreparationError: LocalizedError {
    case unsupportedDevice

    var errorDescription: String? {
        switch self {
        case .unsupportedDevice:
            return "This iPhone uses the device voice because it has limited memory."
        }
    }
}

/// One shared preference for Settings, the call sheet and the live call.
@MainActor
final class CallVoicePreference: ObservableObject {
    static let shared = CallVoicePreference()

    @Published private(set) var selected: CallVoiceChoice
    @Published private(set) var effective: CallVoiceChoice?
    @Published private(set) var preparing: CallVoiceChoice?
    @Published private(set) var errorMessage: String?
    @Published private(set) var failedChoice: CallVoiceChoice?
    @Published private(set) var fallbackReason: String?

    private let defaults: UserDefaults
    private let engines: LocalVoiceEngineProviding

    init(defaults: UserDefaults = .standard, engines: LocalVoiceEngineProviding = LocalVoiceEngines.shared) {
        self.defaults = defaults
        self.engines = engines
        self.selected = CallVoiceChoice.saved(in: defaults)
    }

    func select(_ choice: CallVoiceChoice) async {
        guard preparing == nil else { return }
        errorMessage = nil
        failedChoice = nil
        if choice.isNeural {
            preparing = choice
            defer { preparing = nil }
            do {
                try await engines.prepareVoice(choice)
            } catch {
                errorMessage = error.localizedDescription
                failedChoice = choice
                return
            }
        }
        defaults.set(choice.rawValue, forKey: CallVoiceChoice.storageKey)
        selected = choice
    }

    func reportEffective(_ choice: CallVoiceChoice, reason: String? = nil) {
        effective = choice
        fallbackReason = reason
    }

    func clearCall() {
        effective = nil
        fallbackReason = nil
    }
}
