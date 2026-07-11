import Foundation

/// Drives the pre-auth onboarding flow: current screen, buffered answers
/// (persisted to `OnboardingStore` on every change so progress survives an app
/// kill), and completion. Inputs are never required — blanks are allowed.
@MainActor
final class OnboardingViewModel: ObservableObject {

    @Published var index = 0
    @Published var values: [String: String] = [:]

    let fields = ProfileFieldCatalog.all
    private let store: OnboardingStore

    init(store: OnboardingStore) {
        self.store = store
        values = store.loadDraft()
    }

    var current: ProfileField { fields[index] }
    var isLast: Bool { index == fields.count - 1 }
    var progress: Double { Double(index + 1) / Double(fields.count) }

    func binding(for field: ProfileField) -> String {
        values[field.key] ?? ""
    }

    /// Updates a field, enforcing the bio word cap, and persists the draft.
    func setValue(_ value: String, for field: ProfileField) {
        if field.key == "biography" {
            let words = value.split(whereSeparator: { $0.isWhitespace })
            values[field.key] = words.count > ProfileFieldCatalog.bioWordLimit
                ? words.prefix(ProfileFieldCatalog.bioWordLimit).joined(separator: " ")
                : value
        } else {
            values[field.key] = value
        }
        store.saveDraft(values)
    }

    func next() { if !isLast { index += 1 } }
    func back() { if index > 0 { index -= 1 } }

    /// Marks onboarding done so the gate shows sign-in next. The draft stays
    /// buffered until merged after sign-in.
    func finish() {
        store.saveDraft(values)
        store.markCompleted()
    }

    /// Buffer the user's public-Soul NFT consent (recorded to the profile after
    /// sign-in). `false` means the Soul never mints.
    func setSoulConsent(_ granted: Bool) { store.setPendingSoulConsent(granted) }

    /// First name typed at the "Your name" step, for personalizing the consent copy.
    var firstName: String {
        (values["name"] ?? "").split(whereSeparator: { $0.isWhitespace }).first.map(String.init) ?? ""
    }
}
