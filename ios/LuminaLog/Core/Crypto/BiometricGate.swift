import Foundation
import LocalAuthentication

enum BiometricGateError: LocalizedError, Equatable {
    case unavailable
    case failed

    var errorDescription: String? {
        switch self {
        case .unavailable: return "Face ID / passcode is not available on this device."
        case .failed: return "Authentication was not successful."
        }
    }
}

/// Injectable seam over `LAContext` so unit tests can supply a fake instead of
/// invoking real biometrics.
protocol BiometricContext {
    func canEvaluatePolicy(_ policy: LAPolicy, error: NSErrorPointer) -> Bool
    func evaluatePolicy(_ policy: LAPolicy, localizedReason: String) async throws -> Bool
}

/// Production `BiometricContext` backed by a real `LAContext`. Bridges the
/// callback-based `evaluatePolicy` to async without depending on the synthesized
/// overload (avoids signature ambiguity).
final class SystemBiometricContext: BiometricContext {

    private let context = LAContext()

    func canEvaluatePolicy(_ policy: LAPolicy, error: NSErrorPointer) -> Bool {
        context.canEvaluatePolicy(policy, error: error)
    }

    func evaluatePolicy(_ policy: LAPolicy, localizedReason: String) async throws -> Bool {
        try await withCheckedThrowingContinuation { continuation in
            context.evaluatePolicy(policy, localizedReason: localizedReason) { success, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: success)
                }
            }
        }
    }
}

/// App-level Face ID / passcode gate (spec §2). Uses
/// `.deviceOwnerAuthentication` so a device without biometrics still falls back
/// to the passcode. Fails closed: any unavailable / denied / errored evaluation
/// throws — it never silently reports success.
struct BiometricGate {

    private let context: BiometricContext

    init(context: BiometricContext = SystemBiometricContext()) {
        self.context = context
    }

    /// Whether device-owner authentication can currently be evaluated.
    var isAvailable: Bool {
        var error: NSError?
        return context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error)
    }

    /// Prompt for Face ID / passcode. Throws `.unavailable` if the policy can't
    /// be evaluated, `.failed` if the user is denied or cancels.
    func evaluate(reason: String) async throws {
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            throw BiometricGateError.unavailable
        }
        let success = try await context.evaluatePolicy(
            .deviceOwnerAuthentication,
            localizedReason: reason
        )
        guard success else { throw BiometricGateError.failed }
    }
}
