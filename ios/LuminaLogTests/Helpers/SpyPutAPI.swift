import Foundation
@testable import LuminaLog

/// Shared test double for `ConsentAPIPutting`, used by `ConsentServiceTests`
/// and `ConsentGateTests`.
final class SpyPutAPI: ConsentAPIPutting {
    var puts: [(path: String, json: String)] = []
    var shouldThrow: Error?
    func put(path: String, body: some Encodable) async throws {
        if let shouldThrow { throw shouldThrow }
        let data = try JSONEncoder().encode(body)
        puts.append((path, String(data: data, encoding: .utf8) ?? ""))
    }
}
