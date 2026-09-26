import Foundation
import OSLog

// MARK: - View Model

/// Drives the username editor: live availability check, local validation,
/// 30-day cooldown enforcement, and save.
@MainActor
final class UsernameEditViewModel: ObservableObject {

    private static let logger = Logger(
        subsystem: "com.konradgnat.luminalog",
        category: "username-edit"
    )

    // MARK: - Status

    enum Status: Equatable {
        case idle
        case checking
        case available
        case unavailable(String)
        case saving
        case saved(UsernameUpdate)
        case failed(String)
    }

    // MARK: Published state

    @Published var text: String = ""
    /// Settable in-module so tests can seed a state; views only read it.
    @Published var status: Status = .idle

    // MARK: Dependencies

    private let service: InboxService
    private let current: String?
    private let changedAt: Date?
    private let now: () -> Date
    private let debounceNanoseconds: UInt64

    init(
        service: InboxService,
        current: String?,
        changedAt: Date?,
        now: @escaping () -> Date = Date.init,
        debounceNanoseconds: UInt64 = 400_000_000
    ) {
        self.service = service
        self.current = current
        self.changedAt = changedAt
        self.now = now
        self.debounceNanoseconds = debounceNanoseconds
        self.text = current ?? ""
    }

    // MARK: - Computed

    /// When the user is within the 30-day cooldown window, returns the date
    /// at which they may change their username again.
    var lockedUntil: Date? {
        guard let changedAt else { return nil }
        let cooldownEnd = changedAt.addingTimeInterval(86400 * 30)
        guard cooldownEnd > now() else { return nil }
        return cooldownEnd
    }

    /// True only when the status is `.available`; the save button is enabled.
    var canSave: Bool {
        if case .available = status { return true }
        return false
    }

    // MARK: - Validation helpers

    /// Characters allowed in usernames: alphanumeric, underscore, hyphen, period.
    private static let allowedCharacterSet = CharacterSet(
        charactersIn: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-."
    )

    private static let reservedUsernames: Set<String> = [
        "admin", "root", "system", "moderator", "support", "help",
        "info", "api", "null", "undefined", "true", "false",
        "luminalog", "argo", "lumina", "contact", "terms", "privacy",
        "about", "status", "security", "legal", "dmca"
    ]

    /// Returns nil when valid, or an error message when invalid.
    private func validate(_ raw: String) -> String? {
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return "Username is required." }
        guard trimmed.count >= 3 else { return "Username must be at least 3 characters." }
        guard trimmed.count <= 30 else { return "Username must be 30 characters or fewer." }

        // Check for invalid characters
        let forbidden = trimmed.unicodeScalars.filter { !Self.allowedCharacterSet.contains($0) }
        if !forbidden.isEmpty {
            return "Username can only contain letters, numbers, underscores, hyphens, and periods."
        }

        let lowercased = trimmed.lowercased()
        if Self.reservedUsernames.contains(lowercased) {
            return "That username is reserved."
        }

        return nil
    }

    /// Normalize: trim whitespace and lowercase.
    private func normalize(_ raw: String) -> String {
        raw.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    // MARK: - Intents

    /// Called when the text field value changes. Debounces then performs a
    /// local validation check; if the input passes, kicks off a network
    /// availability check.
    func textChanged() async {
        // Debounce
        try? await Task.sleep(nanoseconds: debounceNanoseconds)

        let raw = text
        let trimmed = raw.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !trimmed.isEmpty else {
            status = .idle
            return
        }

        // Local validation
        if let error = validate(raw) {
            status = .unavailable(error)
            return
        }

        // If the name hasn't changed from the current one, consider it
        // "available" (the user already owns it).
        let normalized = normalize(raw)
        if let current, normalize(current) == normalized {
            status = .available
            return
        }

        // Network check
        status = .checking
        do {
            let result = try await service.checkUsername(normalized)
            if result.available {
                status = .available
            } else {
                status = .unavailable(result.reason ?? "That username is not available.")
            }
        } catch {
            Self.logger.error("check failed: \(error.localizedDescription, privacy: .public)")
            status = .unavailable("Could not check availability. Please try again.")
        }
    }

    /// Saves the username. Returns true on success.
    @discardableResult
    func save() async -> Bool {
        guard case .available = status else { return false }
        status = .saving

        let normalized = normalize(text)
        do {
            let update = try await service.setUsername(normalized)
            status = .saved(update)
            return true
        } catch {
            let usernameError = UsernameError.from(error)
            let message: String
            if let desc = usernameError.errorDescription {
                message = desc
            } else {
                message = error.localizedDescription
            }
            status = .failed(message)
            return false
        }
    }
}