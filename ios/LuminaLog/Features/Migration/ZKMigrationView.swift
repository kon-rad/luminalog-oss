import SwiftUI
import CryptoKit

/// Pure gating decision for the one-time zero-knowledge migration prompt
/// (phase 1d). Kept free of SwiftUI/UIKit/UserDefaults so it is trivially
/// unit-testable — see `LuminaLogTests/ZKMigrationGateTests.swift`.
///
/// Deleted, along with the rest of `Features/Migration/`, after the one-time
/// cutover finishes; this is temporary code guarded end-to-end by
/// `DevFlags.zkMigration` (OFF by default).
enum ZKMigrationGate {
    /// True only when the dev flag is on, a user is signed in, the server has
    /// no wraps yet (nothing to migrate to means migration hasn't run), and
    /// this device hasn't already completed it locally.
    static func shouldPrompt(
        flagOn: Bool,
        userId: String?,
        hasServerWraps: Bool,
        locallyMarkedDone: Bool
    ) -> Bool {
        flagOn && userId != nil && !hasServerWraps && !locallyMarkedDone
    }
}

/// Local "already migrated on this device" mark, keyed per user so a shared
/// device / multiple accounts don't cross-contaminate the flag.
enum ZKMigrationLocalMark {
    static func key(forUserId userId: String) -> String { "ll-zk-migrated-\(userId)" }

    static func isDone(userId: String) -> Bool {
        UserDefaults.standard.bool(forKey: key(forUserId: userId))
    }

    static func markDone(userId: String) {
        UserDefaults.standard.set(true, forKey: key(forUserId: userId))
    }
}

/// One-time, flag-gated in-app prompt that RUNS the zero-knowledge key
/// migration and shows the resulting recovery code. Presented as a
/// `.fullScreenCover` above the signed-in app shell (see `LuminaLogApp`).
///
/// Never deletes or finalizes anything server-side — `KeyMigrator.migrate`
/// only uploads the new wraps after verifying they both recover the existing
/// DEK, so a failure here is always safe to retry.
struct ZKMigrationView: View {

    let userId: String
    let dek: SymmetricKey
    let migrator: KeyMigrator
    /// Called once the user has confirmed they saved the recovery code and
    /// tapped Done. The view has already marked local completion by then.
    var onDone: () -> Void

    private enum Phase: Equatable {
        case intro
        case running
        case success(code: String)
        case failed(String)
    }

    @State private var phase: Phase = .intro
    @State private var savedCodeConfirmed = false

    var body: some View {
        ZStack {
            Color.appBackground
                .ignoresSafeArea()

            VStack(spacing: Spacing.l) {
                switch phase {
                case .intro:
                    introContent
                case .running:
                    runningContent
                case .success(let code):
                    successContent(code: code)
                case .failed(let message):
                    failedContent(message: message)
                }
            }
            .padding(Spacing.l)
        }
        .interactiveDismissDisabled(true)
    }

    // MARK: - Intro

    private var introContent: some View {
        VStack(spacing: Spacing.l) {
            Spacer()

            VStack(spacing: Spacing.m) {
                Image(systemName: "lock.shield")
                    .font(.system(size: 40))
                    .foregroundStyle(Color.accentWarm)
                Text("Upgrading your encryption")
                    .font(.sectionHeader)
                    .foregroundStyle(Color.textPrimary)
                Text("Upgrading your encryption so only you hold the key. This takes a moment and won't change any of your journal entries.")
                    .font(.uiBody)
                    .foregroundStyle(Color.textSecondary)
                    .multilineTextAlignment(.center)
            }

            Spacer()
            Spacer()

            primaryButton(title: "Begin") { Task { await runMigration() } }
        }
    }

    // MARK: - Running

    private var runningContent: some View {
        VStack(spacing: Spacing.m) {
            Spacer()
            ProgressView()
                .tint(Color.accentWarm)
            Text("Migrating your encryption key…")
                .font(.uiBody)
                .foregroundStyle(Color.textSecondary)
            Spacer()
        }
    }

    // MARK: - Success

    private func successContent(code: String) -> some View {
        VStack(spacing: Spacing.l) {
            VStack(spacing: Spacing.s) {
                Image(systemName: "checkmark.seal")
                    .font(.system(size: 36))
                    .foregroundStyle(Color.accentWarm)
                Text("Save your recovery code")
                    .font(.sectionHeader)
                    .foregroundStyle(Color.textPrimary)
                Text("This is the only time you'll see this code. Store it somewhere safe — it's the backup way to unlock your journal if you lose access to this device.")
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
                    .multilineTextAlignment(.center)
            }

            VStack(spacing: Spacing.s) {
                Text(code)
                    .font(.system(.body, design: .monospaced))
                    .foregroundStyle(Color.textPrimary)
                    .multilineTextAlignment(.center)
                    .padding(Spacing.m)
                    .frame(maxWidth: .infinity)
                    .background(
                        RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous)
                            .fill(Color.cardBackground)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous)
                            .strokeBorder(Color.textSecondary.opacity(0.25), lineWidth: 1)
                    )
                CopyButton(text: code, accessibilityText: "Copy recovery code")
            }

            Toggle(isOn: $savedCodeConfirmed) {
                Text("I've saved my recovery code")
                    .font(.uiBody)
                    .foregroundStyle(Color.textPrimary)
            }
            .tint(Color.accentWarm)

            Spacer()

            primaryButton(title: "Done", disabled: !savedCodeConfirmed) {
                ZKMigrationLocalMark.markDone(userId: userId)
                onDone()
            }
        }
    }

    // MARK: - Failed

    private func failedContent(message: String) -> some View {
        VStack(spacing: Spacing.m) {
            Spacer()
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 36))
                .foregroundStyle(Color.danger)
            Text("Migration didn't complete")
                .font(.sectionHeader)
                .foregroundStyle(Color.textPrimary)
            Text(message)
                .font(.uiBody)
                .foregroundStyle(Color.textSecondary)
                .multilineTextAlignment(.center)
            Text("Nothing was changed — it's safe to try again.")
                .font(.captionText)
                .foregroundStyle(Color.textSecondary)
            Spacer()
            primaryButton(title: "Retry") { Task { await runMigration() } }
        }
    }

    // MARK: - Actions

    private func runMigration() async {
        phase = .running
        do {
            let code = try await migrator.migrate(userId: userId, dek: dek)
            phase = .success(code: code)
        } catch {
            phase = .failed(error.localizedDescription)
        }
    }

    // MARK: - Shared button

    private func primaryButton(title: String, disabled: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.uiBody.weight(.semibold))
                .foregroundStyle(Color.appBackground)
                .frame(maxWidth: .infinity)
                .frame(minHeight: 50)
                .background(
                    Capsule().fill(Color.accentWarm.opacity(disabled ? 0.4 : 1))
                )
        }
        .buttonStyle(.plain)
        .disabled(disabled)
    }
}

// MARK: - Previews

#Preview("Intro") {
    ZKMigrationView(
        userId: "preview-user",
        dek: SymmetricKey(size: .bits256),
        migrator: KeyMigrator(
            transport: PreviewTransport(),
            iCloudStore: PreviewSecretStore()
        ),
        onDone: {}
    )
}

private struct PreviewTransport: KeyMigrationTransport {
    func uploadWraps(_ wraps: MultiWrappedDEK) async throws {}
    func fetchWraps() async throws -> MultiWrappedDEK? { nil }
    func finalizeMigration() async throws {}
}

/// Preview-only in-memory `SecretStore` (previews never touch the real
/// Keychain).
private final class PreviewSecretStore: SecretStore {
    private var storage: [String: Data] = [:]
    func data(for account: String) -> Data? { storage[account] }
    func set(_ data: Data, for account: String) { storage[account] = data }
    func remove(for account: String) { storage[account] = nil }
}
