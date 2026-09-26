import Foundation

// MARK: - Protocol

/// Generates draft answers for an `InfoRequest` by assembling the context
/// needed by the AI model.
@MainActor
protocol InfoAnswerDrafting: AnyObject {
    /// Produces a list of answer strings, one per question in the request.
    /// Returns empty strings or declines as appropriate.
    func draftAnswers(for request: InfoRequest) async throws -> [String]
}

// MARK: - Draft body

/// JSON body sent to the AI endpoint for answer drafting.
struct InfoAnswerDraftBody: Encodable {
    /// The sender of the info request.
    struct Sender: Encodable {
        let address: String
        let ens: String?
        let name: String
        let description: String
    }

    /// One question-and-answer slot.
    struct Item: Encodable {
        let index: Int
        let question: String
    }

    let name: String
    let bio: String
    let profile: [String: String]
    let sender: Sender
    let reason: String
    let items: [Item]
    let contexts: [String]
}

// MARK: - InfoAnswerDrafter

/// On-device answer drafter that gathers local context (profile, journal
/// entries) and delegates the AI call to a `ProxyAPIClient`.
@MainActor
final class InfoAnswerDrafter: InfoAnswerDrafting {

    private let api: ProxyAPIClient
    private let journals: JournalRepository
    private let profiles: ProfileRepository
    private let searcher: SemanticIndexCoordinating?
    private let now: () -> Date

    init(
        api: ProxyAPIClient,
        journals: JournalRepository,
        profiles: ProfileRepository,
        searcher: SemanticIndexCoordinating? = nil,
        now: @escaping () -> Date = Date.init
    ) {
        self.api = api
        self.journals = journals
        self.profiles = profiles
        self.searcher = searcher
        self.now = now
    }

    func draftAnswers(for request: InfoRequest) async throws -> [String] {
        // Gather context
        let entries = try await journals.fetchAllEntries()
        let profile = try await fetchProfile()
        let query = request.questions.joined(separator: " ")
        let context = await Model1Requests.journalContext(
            from: entries,
            query: query,
            now: now(),
            searcher: searcher
        )
        let contexts = context.isEmpty ? [] : [context]

        let body = Self.makeBody(
            request: request,
            profile: profile,
            contexts: contexts
        )

        // POST to the AI drafting endpoint and decode responses
        let response: DraftResponse = try await api.post(
            path: "/v1/inbox/draft",
            body: body
        )
        return response.answers
    }

    /// Fetch the full user profile; throws if not signed in.
    private func fetchProfile() async throws -> UserProfile {
        var latest: UserProfile?
        for await profile in profiles.profile() {
            latest = profile
            break
        }
        guard let profile = latest else {
            throw AuthServiceError.notSignedIn
        }
        return profile
    }

    // MARK: - Body assembly

    /// Pure factory: builds the request body from the available data.
    /// No I/O, no state, testable independently.
    static func makeBody(
        request: InfoRequest,
        profile: UserProfile,
        contexts: [String]
    ) -> InfoAnswerDraftBody {
        InfoAnswerDraftBody(
            name: profile.displayName,
            bio: profile.biography,
            profile: Model1Requests.profileFields(from: profile.details),
            sender: InfoAnswerDraftBody.Sender(
                address: request.sender.address,
                ens: request.sender.ens,
                name: request.sender.name,
                description: request.sender.description
            ),
            reason: request.reason,
            items: request.questions.enumerated().map { index, question in
                InfoAnswerDraftBody.Item(index: index, question: question)
            },
            contexts: contexts
        )
    }
}

// MARK: - DraftResponse

private struct DraftResponse: Decodable {
    let answers: [String]
}

// MARK: - MockInfoAnswerDrafter

final class MockInfoAnswerDrafter: InfoAnswerDrafting {

    /// Preconfigured answers returned by `draftAnswers(for:)`.
    var answers: [String] = []

    /// When non-nil, `draftAnswers(for:)` throws this error.
    var error: Error?

    func draftAnswers(for request: InfoRequest) async throws -> [String] {
        if let error { throw error }
        return answers
    }
}