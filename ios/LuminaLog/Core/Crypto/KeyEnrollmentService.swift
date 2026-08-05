import Foundation
import OSLog
import CryptoKit

/// Where the signed-in user stands with respect to their encryption key.
///
/// Every content path in the app fails closed without a DEK (reads yield empty,
/// writes throw `CryptoUnavailableError.keyNotLoaded`), so this state — not a
/// silent empty screen — is what the UI gates on.
enum KeyUnlockState: Equatable {
    /// Work in flight (loading, enrolling, or unlocking).
    case resolving
    /// The DEK is installed; the app may read and write content.
    case unlocked
    /// Freshly enrolled. The DEK is usable, but the user must acknowledge their
    /// recovery code before proceeding — it is shown exactly once and stored
    /// nowhere, so this is their only chance to keep it.
    case showingRecoveryCode(String)
    /// The account has wraps but this device holds no key that opens them
    /// (reinstall, new device, iCloud Keychain off).
    case needsRecoveryCode(failedAttempt: Bool)
    /// Transient failure (offline, Keychain error). Retryable, never destructive.
    case failed(String)
}

/// Resolves the per-user DEK at sign-in, enrolling a brand-new account if it has
/// none and falling back to the recovery code when this device can't unlock.
///
/// **The `/bootstrap` server key path was deleted at the zero-knowledge cutover
/// (ADR-0073), and nothing replaced it for new signups — this type is that
/// replacement.** Before it, a new account never obtained a DEK, so its journal
/// entries and profile edits failed to persist silently (ADR-0114).
///
/// Ordering is the safety property throughout: a DEK is installed only after its
/// wraps are uploaded AND verified, so the user can never encrypt data with a key
/// that has no durable backup.
@MainActor
final class KeyEnrollmentService: ObservableObject {

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "keys")

    @Published private(set) var state: KeyUnlockState = .resolving

    private let keys: UserKeyStore
    private let enroller: ClientKeyEnroller
    private let transport: KeyMigrationTransport
    private let defaults: UserDefaults
    private let local = LocalKeyProvider()

    init(
        keys: UserKeyStore,
        enroller: ClientKeyEnroller,
        transport: KeyMigrationTransport,
        defaults: UserDefaults = .standard
    ) {
        self.keys = keys
        self.enroller = enroller
        self.transport = transport
        self.defaults = defaults
    }

    // MARK: - Resolve

    /// Decide (and act on) the user's key state. Idempotent — safe to re-run on
    /// every sign-in and as a retry.
    func resolve(userId: String) async {
        state = .resolving

        // 1. Already loadable? `loadCipher` returns the in-memory cipher if one
        //    is cached, else the device Keychain, else the iCloud KEK + server
        //    wraps (`ICloudKeyProvider`). This is the common path for every
        //    returning user and never touches enrollment.
        if (try? await keys.loadCipher(userId: userId)) != nil {
            // An enrollment interrupted before the user saved their code leaves
            // them with a backstop they never saw. The code is stored nowhere,
            // so rotate to a fresh one (same DEK) and show it again.
            if isAwaitingCodeAcknowledgement(userId) {
                await rotateRecoveryCode(userId: userId)
            } else {
                state = .unlocked
            }
            return
        }

        // 2. Can't unlock. Distinguish "no key material exists yet" (a new
        //    account) from "this device can't open the key that does exist".
        //    A transport error is NEITHER — treating offline as "new account"
        //    would mint a second DEK and orphan everything already written.
        let wraps: MultiWrappedDEK?
        do {
            wraps = try await transport.fetchWraps()
        } catch {
            Self.logger.error("wrap fetch failed: \(error.localizedDescription, privacy: .public)")
            state = .failed("Couldn't reach the server to unlock your journal.")
            return
        }

        if wraps == nil {
            await enrollNewAccount(userId: userId)
        } else {
            state = .needsRecoveryCode(failedAttempt: false)
        }
    }

    // MARK: - Enrollment

    /// Brand-new account: mint a DEK on-device, bind it to a fresh iCloud KEK +
    /// a recovery code, and install it only once both wraps are verified.
    private func enrollNewAccount(userId: String) async {
        let dek = local.generateDEK()
        do {
            setAwaitingCodeAcknowledgement(userId, true)
            let code = try await enroller.enroll(userId: userId, dek: dek)
            keys.install(dek: dek, userId: userId)
            state = .showingRecoveryCode(code)
        } catch {
            // Nothing installed — a retry simply mints a fresh DEK, since no
            // data can have been written under this one.
            setAwaitingCodeAcknowledgement(userId, false)
            Self.logger.error("enrollment failed: \(error.localizedDescription, privacy: .public)")
            state = .failed("Couldn't set up encryption for your account.")
        }
    }

    /// Re-wrap the ALREADY-INSTALLED DEK under a fresh KEK + a fresh code, for an
    /// enrollment the user never finished acknowledging. The DEK is unchanged, so
    /// no existing ciphertext is orphaned.
    private func rotateRecoveryCode(userId: String) async {
        guard let dek = keys.currentDataKey else { state = .unlocked; return }
        do {
            let code = try await enroller.enroll(userId: userId, dek: dek)
            state = .showingRecoveryCode(code)
        } catch {
            // The key still works; only the reminder failed. Let them in rather
            // than blocking on a network hiccup — we'll try again next launch.
            Self.logger.error("code rotation failed: \(error.localizedDescription, privacy: .public)")
            state = .unlocked
        }
    }

    /// The user confirmed they saved the code. Never shown again.
    func acknowledgeRecoveryCode(userId: String) {
        setAwaitingCodeAcknowledgement(userId, false)
        state = .unlocked
    }

    // MARK: - Recovery-code unlock

    /// Unlock with the user's recovery code, then re-bind the recovered DEK to a
    /// fresh iCloud KEK so this device unlocks silently from now on.
    func submitRecoveryCode(_ code: String, userId: String) async {
        // Deliberately NOT `.resolving`: that would swap the entry screen out and
        // discard what the user typed. `KeyGate` shows progress via `isSubmitting`.
        let wraps: MultiWrappedDEK?
        do {
            wraps = try await transport.fetchWraps()
        } catch {
            state = .failed("Couldn't reach the server to check your code.")
            return
        }
        guard let wraps else {
            state = .failed("No recovery key is stored for this account.")
            return
        }
        // Fails closed on a wrong code — a bad guess must never touch the wraps.
        guard let dek = try? RecoveryCode.unwrap(wraps.recovery, code: code) else {
            state = .needsRecoveryCode(failedAttempt: true)
            return
        }

        // Re-enroll under the SAME code, so the one the user holds stays valid.
        // Best-effort: the recovered DEK is already proven good, and a failure
        // here only means this device asks for the code again next reinstall.
        do {
            try await enroller.enroll(userId: userId, dek: dek, code: code)
        } catch {
            Self.logger.error("device re-bind failed: \(error.localizedDescription, privacy: .public)")
        }
        keys.install(dek: dek, userId: userId)
        state = .unlocked
    }

    // MARK: - Lifecycle

    /// Sign-out: forget the resolved state so the next user starts clean.
    func reset() {
        state = .resolving
    }

    // MARK: - Pending-acknowledgement flag

    /// Device-local: set the moment we begin enrolling, cleared when the user
    /// confirms they saved the code. Deliberately NOT cross-device — a second
    /// device never enrolled, so it must not rotate a code shown on the first.
    private func awaitingKey(_ userId: String) -> String { "ll-recovery-code-pending.\(userId)" }

    private func isAwaitingCodeAcknowledgement(_ userId: String) -> Bool {
        defaults.bool(forKey: awaitingKey(userId))
    }

    private func setAwaitingCodeAcknowledgement(_ userId: String, _ pending: Bool) {
        if pending {
            defaults.set(true, forKey: awaitingKey(userId))
        } else {
            defaults.removeObject(forKey: awaitingKey(userId))
        }
    }
}
