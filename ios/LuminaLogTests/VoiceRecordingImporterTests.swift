import XCTest
import CryptoKit
@testable import LuminaLog

/// Scripts the network: POST view-urls → GET staging bytes → POST upload-urls → PUT ciphertext
/// → POST recording-finalize (captured). Everything 200s.
final class VRIStubProtocol: URLProtocol {
    nonisolated(unsafe) static var finalizeBody: Data?
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for r: URLRequest) -> URLRequest { r }
    override func startLoading() {
        let url = request.url!.absoluteString
        let body = request.httpBody ?? request.bodyStreamData()
        if url.contains("/v1/vapi/recording-finalize") { Self.finalizeBody = body }
        let payload: Data
        if url.contains("/v1/media/view-urls") {
            payload = Data(#"{"urls":[{"s3Key":"users/u1/voice-staging/c.wav","viewUrl":"https://s3.test/get"}]}"#.utf8)
        } else if url.contains("/v1/media/upload-urls") {
            payload = Data(#"{"files":[{"s3Key":"users/u1/voice/c.wav","uploadUrl":"https://s3.test/put"}]}"#.utf8)
        } else if url.contains("/get") {
            payload = Data("RAW_WAV_BYTES".utf8)
        } else {
            payload = Data(#"{"ok":true}"#.utf8)
        }
        let resp = HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!
        client?.urlProtocol(self, didReceive: resp, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: payload)
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

private extension URLRequest {
    func bodyStreamData() -> Data? {
        guard let s = httpBodyStream else { return nil }
        s.open(); defer { s.close() }
        var data = Data(); let n = 4096; let buf = UnsafeMutablePointer<UInt8>.allocate(capacity: n)
        defer { buf.deallocate() }
        while s.hasBytesAvailable { let read = s.read(buf, maxLength: n); if read <= 0 { break }; data.append(buf, count: read) }
        return data
    }
}

private final class VRIInMemorySecretStore: SecretStore {
    private var storage: [String: Data] = [:]
    func data(for account: String) -> Data? { storage[account] }
    func set(_ data: Data, for account: String) { storage[account] = data }
    func remove(for account: String) { storage[account] = nil }
}

private final class VRIStubToken: TokenProvider {
    func idToken(forceRefresh: Bool) async throws -> String { "t" }
}

@MainActor
final class VoiceRecordingImporterTests: XCTestCase {
    func testProcessEncryptsAndFinalizesWithDerivedKey() async throws {
        VRIStubProtocol.finalizeBody = nil
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [VRIStubProtocol.self]
        let session = URLSession(configuration: config)

        let keys = UserKeyStore(provider: MockKeyProvider(), secrets: VRIInMemorySecretStore())
        _ = try await keys.loadCipher(userId: "u1")   // populates currentDataKey

        let api = ProxyAPIClient(baseURL: URL(string: "https://api.test")!, tokenProvider: VRIStubToken(), session: session)
        let media = ProxyMediaUploader(api: api, keys: keys, session: session)
        let chat = Chat(id: "chat_1", userId: "u1", kind: .voice,
                        pendingRecordingKey: "users/u1/voice-staging/c.wav")
        let repo = MockChatRepository(chats: [chat])

        let importer = VoiceRecordingImporter(api: api, media: media, keys: keys, repository: repo, session: session)
        await importer.process(chat: chat)

        let body = try XCTUnwrap(VRIStubProtocol.finalizeBody)
        let json = try JSONSerialization.jsonObject(with: body) as! [String: String]
        XCTAssertEqual(json["chatId"], "chat_1")
        XCTAssertEqual(json["recordingPath"], "users/u1/voice/c.wav")
    }
}
