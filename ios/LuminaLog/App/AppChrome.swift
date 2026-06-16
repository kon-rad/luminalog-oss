import SwiftUI

/// App-wide UI chrome coordination.
///
/// Lets a deeply-nested, full-screen experience (currently the chat
/// conversation, design §7) hide the root tab bar while it is on screen and
/// restore it on dismissal — without threading bindings through every
/// intermediate view. Injected by `RootView`.
@MainActor
final class AppChrome: ObservableObject {

    /// True while an immersive screen wants the root tab bar hidden. The only
    /// way out of such a screen is its own back button, so this naturally
    /// flips back to `false` when that screen disappears.
    @Published var tabBarHidden = false
}
