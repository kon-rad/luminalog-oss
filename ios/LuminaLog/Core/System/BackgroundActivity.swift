import Foundation

/// Runs an async block under an iOS finite-length background-task assertion so a
/// brief app backgrounding cannot suspend the app mid-work — which would cancel an
/// in-flight `URLSession` request (the entry-AI HTTP 499s). Injected so the view
/// model stays UIKit-free and unit-testable.
@MainActor
protocol BackgroundActivityGranting {
    func run<T>(_ name: String, _ body: () async throws -> T) async rethrows -> T
}

/// Default / test conformer: no assertion, just runs the block. Used as the
/// `JournalDetailViewModel.init` default so tests and previews need no UIKit.
struct ImmediateBackgroundActivity: BackgroundActivityGranting {
    func run<T>(_ name: String, _ body: () async throws -> T) async rethrows -> T {
        try await body()
    }
}

#if canImport(UIKit)
import UIKit

/// Production conformer: begins a `beginBackgroundTask` assertion (needs no
/// capability/entitlement) that keeps the app alive ~30s after backgrounding,
/// ending it in every path — normal completion, throw, or the system expiration
/// handler. This is what lets a long voice-entry generation finish when the user
/// puts the phone down instead of the request being killed (499).
@MainActor
struct UIKitBackgroundActivity: BackgroundActivityGranting {
    func run<T>(_ name: String, _ body: () async throws -> T) async rethrows -> T {
        var id: UIBackgroundTaskIdentifier = .invalid
        id = UIApplication.shared.beginBackgroundTask(withName: name) {
            if id != .invalid {
                UIApplication.shared.endBackgroundTask(id)
                id = .invalid
            }
        }
        defer {
            if id != .invalid { UIApplication.shared.endBackgroundTask(id) }
        }
        return try await body()
    }
}
#endif
