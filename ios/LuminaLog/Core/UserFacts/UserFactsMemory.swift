import Foundation

/// The facts block at the top of the voice call's `memoryContext`: the most compact
/// memory Argo has, so it goes first (lost in the middle). Current facts only;
/// proposals are not applied, ended and deleted facts are left out.
enum UserFactsMemory {

    static let defaultLimit = 30

    static func block(facts: [UserFact], limit: Int = defaultLimit) -> String? {
        let current = facts
            .filter { $0.status == .active }
            .sorted { a, b in
                if a.userAuthored != b.userAuthored { return a.userAuthored }
                return a.lastConfirmedAt > b.lastConfirmedAt
            }
            .prefix(limit)
        guard !current.isEmpty else { return nil }
        let lines = current.map { "- \($0.category.singular): \($0.statement)" }
        return (["What they have told you about their life (current; they can edit this list):"] + lines)
            .joined(separator: "\n")
    }
}
