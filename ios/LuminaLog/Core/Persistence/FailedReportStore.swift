import Foundation

/// Device-local record of daily-report generation failures, scoped per user.
/// Drives the carousel's error cards. Not synced to Firestore — a failure has no
/// encryptable content and is transient device state (see ADR-0038).
@MainActor
final class FailedReportStore: ObservableObject {
    /// Failed "yyyy-MM-dd" dates for the current user.
    @Published private(set) var failedDates: Set<String> = []
    @Published private(set) var seenDates: Set<String> = []

    private let auth: AuthService
    private let fileURL: URL
    private let seenFileURL: URL

    nonisolated static func defaultDirectory() -> URL {
        let base = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
            ?? FileManager.default.temporaryDirectory
        try? FileManager.default.createDirectory(at: base, withIntermediateDirectories: true)
        return base
    }

    init(auth: AuthService, directory: URL = FailedReportStore.defaultDirectory()) {
        self.auth = auth
        self.fileURL = directory.appendingPathComponent("failed-reports.json")
        self.seenFileURL = directory.appendingPathComponent("seen-failed-reports.json")
        reload()
    }

    /// Re-reads the current user's failures from disk (call after auth changes).
    func reload() {
        failedDates = Set(all()[auth.currentUserId ?? ""] ?? [])
        seenDates = Set(allSeen()[auth.currentUserId ?? ""] ?? [])
    }

    func record(_ date: String) { mutate { $0.insert(date) } }
    func clear(_ date: String) {
        mutate { $0.remove(date) }
        mutateSeen { $0.remove(date) }
    }

    func hasSeen(_ date: String) -> Bool { seenDates.contains(date) }
    func markSeen(_ date: String) { mutateSeen { $0.insert(date) } }

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

    private func mutateSeen(_ change: (inout Set<String>) -> Void) {
        guard let uid = auth.currentUserId else { return }
        var set = seenDates
        change(&set)
        seenDates = set
        var store = allSeen()
        store[uid] = Array(set)
        if let data = try? JSONEncoder().encode(store) {
            try? data.write(to: seenFileURL, options: .atomic)
        }
    }

    private func allSeen() -> [String: [String]] {
        guard let data = try? Data(contentsOf: seenFileURL),
              let decoded = try? JSONDecoder().decode([String: [String]].self, from: data)
        else { return [:] }
        return decoded
    }
}
