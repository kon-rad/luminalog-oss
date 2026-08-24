import Foundation

/// The complete list of events this app may send, as a closed `enum` with typed
/// payloads.
///
/// The shape is the point. There is deliberately no reachable
/// `capture(String, [String: Any])` anywhere in the app, so an arbitrary string
/// with an arbitrary dictionary cannot be sent by anyone who is moving fast, and
/// journal content cannot reach the analytics pipeline through an ordinary code
/// review miss. `Analytics.capture(_:)` takes only this type.
///
/// NOTHING here may carry journal content: no titles, no entry text, no
/// transcripts, and no character or word counts. A length is a measurement of
/// content, and it is exactly the kind of property that looks harmless in a
/// diff.
enum AnalyticsEvent {

    case appOpened
    case onboardingCompleted
    case entryCreated(kind: EntryKind)
    case insightViewed
    case chatMessageSent
    case paywallShown(source: PaywallSource)
    case paywallDismissed(source: PaywallSource)
    case purchaseStarted(productId: String)

    /// The only entry kinds that may be reported. A closed set rather than a
    /// free string, so a future entry type has to be added here consciously.
    enum EntryKind: String {
        case text
        case voice
        case video
        case photo
    }

    /// Where a paywall was raised from, so the funnel can tell an upsell that
    /// interrupted a voice call apart from one the user opened in Settings.
    enum PaywallSource: String {
        case settings
        case credits
        case voice
        case chat
        case onboarding
    }

    var name: String {
        switch self {
        case .appOpened: return "app_opened"
        case .onboardingCompleted: return "onboarding_completed"
        case .entryCreated: return "entry_created"
        case .insightViewed: return "insight_viewed"
        case .chatMessageSent: return "chat_message_sent"
        case .paywallShown: return "paywall_shown"
        case .paywallDismissed: return "paywall_dismissed"
        case .purchaseStarted: return "purchase_started"
        }
    }

    /// `[String: String]` rather than `[String: Any]`, on purpose: a dictionary
    /// of `Any` is how a model object, and with it a journal entry, ends up
    /// serialized into an analytics payload.
    var properties: [String: String] {
        switch self {
        case .entryCreated(let kind):
            return ["kind": kind.rawValue]
        case .paywallShown(let source), .paywallDismissed(let source):
            return ["source": source.rawValue]
        case .purchaseStarted(let productId):
            return ["product_id": productId]
        case .appOpened, .onboardingCompleted, .insightViewed, .chatMessageSent:
            return [:]
        }
    }
}
