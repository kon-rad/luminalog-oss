import XCTest
@testable import LuminaLog

final class EOACheckTests: XCTestCase {

    private func makeSUT(handler: @escaping (URLRequest) -> (Data, HTTPURLResponse)) -> RPCEOACheck {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [EOACheckStubURLProtocol.self]
        EOACheckStubURLProtocol.handler = handler
        return RPCEOACheck(rpcURL: URL(string: "https://rpc.example.com")!, session: URLSession(configuration: config))
    }

    func testEmptyCodeIsAnEOA() async throws {
        let sut = makeSUT { request in
            let body = #"{"jsonrpc":"2.0","id":1,"result":"0x"}"#.data(using: .utf8)!
            return (body, HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!)
        }
        let isEOA = try await sut.isEOA(address: "0x1234567890123456789012345678901234567890")
        XCTAssertTrue(isEOA)
    }

    func testNonEmptyCodeIsNotAnEOA() async throws {
        let sut = makeSUT { request in
            let body = #"{"jsonrpc":"2.0","id":1,"result":"0x6080604052"}"#.data(using: .utf8)!
            return (body, HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!)
        }
        let isEOA = try await sut.isEOA(address: "0xabcabcabcabcabcabcabcabcabcabcabcabcabc")
        XCTAssertFalse(isEOA)
    }

    func testRequestSendsEthGetCodeWithTheGivenAddress() async throws {
        var capturedBody: Data?
        let sut = makeSUT { request in
            capturedBody = request.httpBodyStreamData() ?? request.httpBody
            let body = #"{"jsonrpc":"2.0","id":1,"result":"0x"}"#.data(using: .utf8)!
            return (body, HTTPURLResponse(url: request.url!, statusCode: 200, httpVersion: nil, headerFields: nil)!)
        }
        _ = try await sut.isEOA(address: "0x1234567890123456789012345678901234567890")
        let json = try XCTUnwrap(capturedBody)
        let decoded = try XCTUnwrap(JSONSerialization.jsonObject(with: json) as? [String: Any])
        XCTAssertEqual(decoded["method"] as? String, "eth_getCode")
        let params = try XCTUnwrap(decoded["params"] as? [String])
        XCTAssertEqual(params.first, "0x1234567890123456789012345678901234567890")
        XCTAssertEqual(params.last, "latest")
    }
}

private final class EOACheckStubURLProtocol: URLProtocol {
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

private extension URLRequest {
    /// Reads httpBody if directly set, or attempts to read from httpBodyStream if available.
    func httpBodyStreamData() -> Data? {
        if let body = httpBody {
            return body
        }
        if let stream = httpBodyStream {
            stream.open()
            defer { stream.close() }

            let data = NSMutableData()
            let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: 1024)
            defer { buffer.deallocate() }

            while stream.hasBytesAvailable {
                let bytesRead = stream.read(buffer, maxLength: 1024)
                if bytesRead > 0 {
                    data.append(buffer, length: bytesRead)
                }
            }
            return data as Data
        }
        return nil
    }
}
