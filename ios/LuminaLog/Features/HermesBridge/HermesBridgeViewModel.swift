import Foundation

/// Backs the `#if DEBUG`-only Hermes Bridge panel (`docs/features/hermes-bridge.md`).
/// Owns pairing state, the paired device token (Keychain-backed via
/// `SecretStore`), and the recent-tasks/changes/live-stream data shown in
/// `HermesBridgeView`. Independent of `AppServices`/Firebase: this gateway
/// has its own single-device bearer-token auth.
@MainActor
final class HermesBridgeViewModel: ObservableObject {

    enum PairingState: Equatable {
        case unpaired
        case paired(baseURL: URL)
    }

    @Published private(set) var pairingState: PairingState = .unpaired
    @Published private(set) var tasks: [HermesTaskSummary] = []
    @Published private(set) var commits: [HermesCommitSummary] = []
    @Published private(set) var outputLines: [String] = []
    @Published var errorMessage: String?
    @Published private(set) var isStreamConnected = false

    private static let tokenAccount = "hermesBridge.token"
    private static let baseURLKey = "hermesBridge.baseURL"

    private let service: HermesBridgeService
    private let secretStore: SecretStore
    private var stream: HermesStreamConnection?
    private var streamTask: Task<Void, Never>?

    init(service: HermesBridgeService, secretStore: SecretStore) {
        self.service = service
        self.secretStore = secretStore
        restorePairing()
    }

    private func restorePairing() {
        guard
            let token = storedToken(),
            !token.isEmpty,
            let urlString = UserDefaults.standard.string(forKey: Self.baseURLKey),
            let url = URL(string: urlString)
        else { return }
        pairingState = .paired(baseURL: url)
    }

    private func storedToken() -> String? {
        guard let data = secretStore.data(for: Self.tokenAccount) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    // MARK: - Pairing

    func pair(baseURLString: String, code: String, deviceName: String) async {
        errorMessage = nil
        guard let url = URL(string: baseURLString), url.scheme != nil, url.host != nil else {
            errorMessage = HermesBridgeError.invalidBaseURL.errorDescription
            return
        }

        do {
            let token = try await service.pair(baseURL: url, code: code, deviceName: deviceName)
            guard let tokenData = token.data(using: .utf8) else { return }
            secretStore.set(tokenData, for: Self.tokenAccount)
            UserDefaults.standard.set(url.absoluteString, forKey: Self.baseURLKey)
            pairingState = .paired(baseURL: url)
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func unpair() {
        disconnectStream()
        secretStore.remove(for: Self.tokenAccount)
        UserDefaults.standard.removeObject(forKey: Self.baseURLKey)
        tasks = []
        commits = []
        outputLines = []
        pairingState = .unpaired
    }

    // MARK: - Recent tasks / changes

    func loadRecentTasks(limit: Int = 20) async {
        guard case .paired(let baseURL) = pairingState, let token = storedToken() else { return }
        do {
            tasks = try await service.recentTasks(baseURL: baseURL, token: token, limit: limit)
        } catch {
            handle(error)
        }
    }

    func loadRecentChanges(limit: Int = 20) async {
        guard case .paired(let baseURL) = pairingState, let token = storedToken() else { return }
        do {
            commits = try await service.recentChanges(baseURL: baseURL, token: token, limit: limit)
        } catch {
            handle(error)
        }
    }

    private func handle(_ error: Error) {
        if let bridgeError = error as? HermesBridgeError, bridgeError.isUnauthorized {
            unpair()
            errorMessage = bridgeError.errorDescription
        } else {
            errorMessage = error.localizedDescription
        }
    }

    // MARK: - Live stream

    func connectStream() {
        guard case .paired(let baseURL) = pairingState, let token = storedToken() else { return }
        guard stream == nil else { return }

        let connection = service.openStream(baseURL: baseURL, token: token)
        stream = connection
        isStreamConnected = true

        streamTask = Task { [weak self] in
            guard let self else { return }
            do {
                for try await event in connection.events {
                    await self.handle(event)
                }
            } catch {
                await MainActor.run {
                    self.isStreamConnected = false
                    self.outputLines.append("[disconnected: \(error.localizedDescription)]")
                }
            }
        }
    }

    private func handle(_ event: HermesStreamEvent) async {
        switch event {
        case .stdout(let text), .stderr(let text):
            outputLines.append(text)
        case .status(let state):
            outputLines.append("[status: \(state)]")
        case .exit(let code):
            outputLines.append("[exited: \(code.map(String.init) ?? "unknown")]")
        }
    }

    func startHermesSession() async {
        connectStream()
        try? await stream?.send(.start)
    }

    func sendInput(_ text: String) async {
        guard !text.isEmpty else { return }
        do {
            try await stream?.send(.stdin(text))
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    func disconnectStream() {
        stream?.close()
        stream = nil
        streamTask?.cancel()
        streamTask = nil
        isStreamConnected = false
    }
}
