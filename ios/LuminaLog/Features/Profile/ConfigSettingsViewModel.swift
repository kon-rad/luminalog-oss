import Foundation
import OSLog

/// Edits the user's summary generation settings (Settings → Config).
@MainActor
final class ConfigSettingsViewModel: ObservableObject {

    // Keep in sync with server `summaryDefaults.ts`.
    static let defaultWordLength = 50
    static let defaultSystemPrompt =
        "You are summarizing a {type} journal entry. Capture the key themes and " +
        "emotional tone. Write in second person (\"you felt…\", \"you noticed…\"). " +
        "Be reflective and personal, not clinical."

    @Published var wordLength: Int
    @Published var systemPrompt: String
    @Published private(set) var isSaving = false
    @Published private(set) var saveFailed = false

    private var profile: UserProfile
    private let profiles: ProfileRepository
    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "ConfigSettings")

    init(profile: UserProfile, profiles: ProfileRepository) {
        self.profile = profile
        self.profiles = profiles
        self.wordLength = profile.summaryConfig?.wordLength ?? Self.defaultWordLength
        self.systemPrompt = profile.summaryConfig?.systemPrompt ?? Self.defaultSystemPrompt
    }

    func resetToDefaults() {
        wordLength = Self.defaultWordLength
        systemPrompt = Self.defaultSystemPrompt
    }

    func save() async {
        isSaving = true
        saveFailed = false
        profile.summaryConfig = .init(
            wordLength: max(1, wordLength),
            systemPrompt: systemPrompt.trimmingCharacters(in: .whitespacesAndNewlines)
        )
        do {
            try await profiles.update(profile)
        } catch {
            Self.logger.error("save config failed: \(error.localizedDescription, privacy: .public)")
            saveFailed = true
        }
        isSaving = false
    }
}
