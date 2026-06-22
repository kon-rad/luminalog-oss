import Foundation

/// One onboarding/profile question. The catalog of these is the single source
/// of truth that drives onboarding, the edit form, the profile display, and the
/// merge-on-sign-in. `get`/`set` route each field to its storage on `UserProfile`.
struct ProfileField: Identifiable {
    enum Group: String, CaseIterable {
        case identity, about, lifestyle, favorites
        var title: String {
            switch self {
            case .identity: return "Identity"
            case .about: return "About You"
            case .lifestyle: return "Lifestyle"
            case .favorites: return "Favorites"
            }
        }
    }

    let key: String
    let group: Group
    /// Short title for the onboarding screen / edit row label.
    let title: String
    /// The question shown to the user.
    let question: String
    /// Supporting copy / placeholder.
    let helper: String
    let multiline: Bool
    /// `true` for the display name, which renders as the profile header rather
    /// than a grouped body row.
    let isHeader: Bool
    /// Placeholder illustration asset for the onboarding screen (follow-on art).
    let graphicAsset: String
    let get: (UserProfile) -> String
    let set: (inout UserProfile, String) -> Void

    var id: String { key }
}

enum ProfileFieldCatalog {

    /// Hard maximum for the biography field (matches the existing cap).
    static let bioWordLimit = 750

    private static func detail(
        _ key: String, _ group: ProfileField.Group, title: String, question: String,
        helper: String, multiline: Bool, asset: String,
        _ keyPath: WritableKeyPath<UserProfile.ProfileDetails, String?>
    ) -> ProfileField {
        ProfileField(
            key: key, group: group, title: title, question: question, helper: helper,
            multiline: multiline, isHeader: false, graphicAsset: asset,
            get: { $0.details[keyPath: keyPath] ?? "" },
            set: { $0.details[keyPath: keyPath] = $1 }
        )
    }

    /// All 18 fields in onboarding order.
    static let all: [ProfileField] = [
        ProfileField(
            key: "name", group: .identity, title: "Your name",
            question: "What should we call you?",
            helper: "The name your AI companion will use.",
            multiline: false, isHeader: true, graphicAsset: "onboarding-name",
            get: { $0.displayName }, set: { $0.displayName = $1 }
        ),
        ProfileField(
            key: "biography", group: .about, title: "Your story",
            question: "Tell us about yourself.",
            helper: "Who you are, your life story, your values — up to 750 words. Type or tap the mic to speak.",
            multiline: true, isHeader: false, graphicAsset: "onboarding-biography",
            get: { $0.biography }, set: { $0.biography = $1 }
        ),
        detail("goals", .about, title: "Your goals", question: "What do you want to accomplish?",
               helper: "The things you're reaching for.", multiline: true, asset: "onboarding-goals", \.goals),
        detail("hobbies", .lifestyle, title: "Hobbies & passions", question: "What are your hobbies and passions?",
               helper: "What you love to do.", multiline: true, asset: "onboarding-hobbies", \.hobbies),
        detail("age", .identity, title: "Your age", question: "How old are you?",
               helper: "", multiline: false, asset: "onboarding-age", \.age),
        detail("gender", .identity, title: "Your gender", question: "What is your gender?",
               helper: "For example, male or female.", multiline: false, asset: "onboarding-gender", \.gender),
        detail("challenges", .about, title: "Your challenges", question: "What challenges would you solve in a snap?",
               helper: "If you could snap your fingers and fix them.", multiline: true, asset: "onboarding-challenges", \.challenges),
        detail("dailyHabits", .lifestyle, title: "Daily habits", question: "What are your favorite daily habits?",
               helper: "The rituals that anchor your day.", multiline: true, asset: "onboarding-dailyHabits", \.dailyHabits),
        detail("starSign", .identity, title: "Your star sign", question: "What is your star sign?",
               helper: "", multiline: false, asset: "onboarding-starSign", \.starSign),
        detail("maritalStatus", .identity, title: "Marital status", question: "What is your marital status?",
               helper: "", multiline: false, asset: "onboarding-maritalStatus", \.maritalStatus),
        detail("location", .identity, title: "Where you live", question: "Where do you live?",
               helper: "", multiline: false, asset: "onboarding-location", \.location),
        detail("education", .lifestyle, title: "Education", question: "What level of education have you completed?",
               helper: "", multiline: false, asset: "onboarding-education", \.education),
        detail("work", .lifestyle, title: "Work", question: "What do you do for work?",
               helper: "", multiline: true, asset: "onboarding-work", \.work),
        detail("favoriteMovies", .favorites, title: "Favorite movies", question: "What are your top three favorite movies?",
               helper: "", multiline: true, asset: "onboarding-favoriteMovies", \.favoriteMovies),
        detail("favoriteArtists", .favorites, title: "Favorite artists", question: "Who are your top three favorite artists?",
               helper: "", multiline: true, asset: "onboarding-favoriteArtists", \.favoriteArtists),
        detail("favoriteBooks", .favorites, title: "Favorite books", question: "What are your top three favorite books?",
               helper: "", multiline: true, asset: "onboarding-favoriteBooks", \.favoriteBooks),
        detail("languages", .lifestyle, title: "Languages", question: "What languages do you speak?",
               helper: "", multiline: false, asset: "onboarding-languages", \.languages),
        detail("friendsDescribe", .about, title: "Through their eyes", question: "How would your friends describe you?",
               helper: "", multiline: true, asset: "onboarding-friendsDescribe", \.friendsDescribe),
    ]

    /// Fields shown as grouped body rows (everything except the header name).
    static func bodyFields(in group: ProfileField.Group) -> [ProfileField] {
        all.filter { $0.group == group && !$0.isHeader }
    }
}
