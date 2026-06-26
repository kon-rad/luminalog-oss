import Foundation

/// Device-local record of daily-report generation failures, scoped per user.
/// Drives the carousel's error cards. Not synced to Firestore — a failure has no
/// encryptable content and is transient device state (see ADR-0038).
@MainActor
final class FailedReportStore: ObservableObject {
    /// Failed "yyyy-MM-dd" dates for the current user.
    @Published private(set) var failedDates: Set<String> = []

    private let auth: AuthService
    private let fileURL: URL

    nonisolated static func defaultDirectory() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        try? FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        return base
    }

    init(auth: AuthService, directory: URL = FailedReportStore.defaultDirectory()) {
        self.auth = auth
        self.fileURL = directory.appendingPathComponent("failed-reports.json")
        reload()
    }

    /// Re-reads the current user's failures from disk (call after auth changes).
    func reload() {
        failedDates = Set(all()[auth.currentUserId ?? ""] ?? [])
    }

    func record(_ date: String) { mutate { $0.insert(date) } }
    func clear(_ date: String) { mutate { $0.remove(date) } }

    /// Failed dates, most recent first.
    func dates() -> [String] { failedDates.sorted(by: >) }

    // MARK: - Persistence ([uid: [date]])

    private func mutate(_ change: (inout Set<String>) -> Void) {
        guard let uid = auth.currentUserId else { return }
        var set = failedDates
        change(&set)
        failedDates = set
        var store = all()
        store[uid] = Array(set)
        if let data = try? JSONEncoder().encode(store) {
            try? data.write(to: fileURL, options: .atomic)
        }
    }

    private func all() -> [String: [String]] {
        guard let data = try? Data(contentsOf: fileURL),
              let decoded = try? JSONDecoder().decode([String: [String]].self, from: data)
        else { return [:] }
        return decoded
    }
}
