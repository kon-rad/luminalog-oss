import XCTest
@testable import LuminaLog

final class EOAWrapTransportTests: XCTestCase {

    private func makeSUT(handler: @escaping (URLRequest) -> (Data, HTTPURLResponse)) -> ProxyEOAWrapTransport {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [EOAWrapTransportStubURLProtocol.self]
        EOAWrapTransportStubURLProtocol.handler = handler
        let session = URLSession(configuration: config)
        let api = ProxyAPIClient(
            baseURL: URL(string: "https://api.example.com")!,
            tokenProvider: FixedEOATokenProvider(),
            session: session
        )
        return ProxyEOAWrapTransport(api: api)
    }

    func testUploadSendsOnlyTheEoaSlot() async throws {
        var capturedBody: [String: Any]?
        let sut = makeSUT { request in
            let bodyData = request.httpBody ?? request.bodyStreamData()
            if let data = bodyData {
                capturedBody = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            }
            return (Data("{}".utf8), HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!)
        }
        let wrap = WrappedKey(iv: Data(repeating: 1, count: 12), ct: Data([9, 9]), tag: Data(repeating: 2, count: 16))
        try await sut.uploadEOAWrap(wrap)

        let wraps = try XCTUnwrap(capturedBody?["wraps"] as? [String: Any])
        XCTAssertEqual(wraps.count, 1)
        XCTAssertNotNil(wraps["eoa"])
    }

    func testFetchReturnsNilWhenNoEoaSlotPresent() async throws {
        let sut = makeSUT { request in
            let body = #"{"wrappedKeys":{"icloud":{"v":1,"iv":"aaaa","ct":"bbbb","tag":"cccc"}}}"#.data(using: .utf8)!
            return (body, HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!)
        }
        let wrap = try await sut.fetchEOAWrap()
        XCTAssertNil(wrap)
    }

    func testFetchParsesTheEoaSlotWhenPresent() async throws {
        let sut = makeSUT { request in
            let ivB64 = Data(repeating: 1, count: 12).base64EncodedString()
            let ctB64 = Data([9, 9]).base64EncodedString()
            let tagB64 = Data(repeating: 2, count: 16).base64EncodedString()
            let jsonString = #"{"wrappedKeys":{"eoa":{"v":1,"iv":"\#(ivB64)","ct":"\#(ctB64)","tag":"\#(tagB64)"}}}"#
            let body = Data(jsonString.utf8)
            return (body, HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!)
        }
        let wrap = try await sut.fetchEOAWrap()
        XCTAssertNotNil(wrap)
    }
}

private final class EOAWrapTransportStubURLProtocol: URLProtocol {
    static var handler: ((URLRequest) -> (Data, HTTPURLResponse))?
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() {
        guard let handler = Self.handler else { return }
        let (data, response) = handler(request)
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: data)
        client?.urlProtocolDidFinishLoading(self)
    }
    override func stopLoading() {}
}

private final class FixedEOATokenProvider: TokenProvider {
    func idToken(forceRefresh: Bool) async throws -> String { "test-token" }
}

private extension URLRequest {
    func bodyStreamData() -> Data? {
        guard let s = httpBodyStream else { return nil }
        s.open()
        defer { s.close() }
        var data = Data()
        let n = 4096
        let buf = UnsafeMutablePointer<UInt8>.allocate(capacity: n)
        defer { buf.deallocate() }
        while s.hasBytesAvailable {
            let read = s.read(buf, maxLength: n)
            guard read > 0 else { break }
            data.append(buf, count: read)
        }
        return data
    }
}
