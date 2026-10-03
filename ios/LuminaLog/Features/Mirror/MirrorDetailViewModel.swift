import Foundation

/// Loads one Mirror Echo and the inputs of its day's batch for `MirrorDetailView`.
@MainActor
final class MirrorDetailViewModel: ObservableObject {

    enum State: Equatable {
        case loading
        case loaded(EncouragementMessage, MirrorInputs?)
        case notFound
        case failed
    }

    @Published private(set) var state: State = .loading

    let id: String
    private let repository: EncouragementRepository

    init(id: String, repository: EncouragementRepository) {
        self.id = id
        self.repository = repository
    }

    func load() async {
        state = .loading
        do {
            guard let message = try await repository.message(id: id) else {
                state = .notFound
                return
            }
            // Inputs are an overlay: older batches have none, and a failed read
            // still shows the reflection.
            let inputs = (try? await repository.inputs(forDateKey: EncouragementIds.dateKeyPrefix(id))) ?? nil
            state = .loaded(message, inputs)
        } catch {
            state = .failed
        }
    }

    /// Plain text of the Details section for "Copy text": sources, then the
    /// system prompt, then the user message, each verbatim.
    static func detailsText(_ inputs: MirrorInputs) -> String {
        let sources = inputs.sources.map { source in
            "[\(source.type) · \(source.title) · \(source.createdAt.formatted(date: .abbreviated, time: .shortened))]\n\(source.content)"
        }.joined(separator: "\n\n---\n\n")
        var parts = ["SOURCE ENTRIES\n\n\(sources)"]
        if let system = inputs.system, let user = inputs.user {
            parts.append("SYSTEM PROMPT\n\n\(system)")
            parts.append("USER MESSAGE\n\n\(user)")
            if let model = inputs.model { parts.append("MODEL\n\n\(model)") }
        } else {
            parts.append("Prompt text not recorded.")
        }
        return parts.joined(separator: "\n\n====\n\n")
    }
}
