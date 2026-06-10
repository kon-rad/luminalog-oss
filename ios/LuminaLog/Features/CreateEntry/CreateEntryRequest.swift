import Foundation

/// Request to open the Create Journal Entry flow, optionally seeded with a
/// journaling prompt (from the Home daily prompt or a generated prompt).
/// Routed through `RootView`; the Create flow (Task 7) consumes it.
struct CreateEntryRequest: Identifiable, Equatable {
    let id = UUID()
    var promptText: String?

    init(promptText: String? = nil) {
        self.promptText = promptText
    }
}
