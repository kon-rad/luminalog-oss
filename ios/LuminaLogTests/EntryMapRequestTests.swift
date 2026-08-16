import XCTest
@testable import LuminaLog

final class EntryMapRequestTests: XCTestCase {

    /// Matches `ProxyAPIClient`'s decoder configuration, which is what actually
    /// decodes this response in production.
    private func decoder() -> JSONDecoder {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return decoder
    }

    func testBodyEncodesExactlyTheFieldsTheServerReads() throws {
        let body = Model1Requests.EntryMapBody(content: "Only three signed up.", type: "text")
        let json = try XCTUnwrap(
            JSONSerialization.jsonObject(with: try JSONEncoder().encode(body)) as? [String: Any]
        )
        XCTAssertEqual(json["content"] as? String, "Only three signed up.")
        XCTAssertEqual(json["type"] as? String, "text")
        XCTAssertEqual(Set(json.keys), ["content", "type"])
    }

    func testResponseDecodesIntoAGeneration() throws {
        let payload = #"""
        {
          "v": 1,
          "beats": [{"id":"b0","tier":"map","kind":"event","text":"Signed up","quote":"Signed up.","quoteStart":0,"domain":"craft","isSpine":true,"isKeeper":false,"generality":0.1,"keepScore":0.2,"degree":0,"mentions":[]}],
          "edges": [],
          "model": "llama-3.3-70b",
          "generatedAt": "2026-08-16T10:00:00Z"
        }
        """#
        let response = try decoder().decode(
            ProxyAIService.EntryMapResponse.self, from: Data(payload.utf8)
        )
        let generation = ProxyAIService.generation(from: response)

        XCTAssertEqual(generation.map.beats.count, 1)
        XCTAssertEqual(generation.map.beats.first?.kind, .event)
        XCTAssertEqual(generation.model, "llama-3.3-70b")
        XCTAssertEqual(generation.version, CognitiveMapGeneration.currentVersion)
        XCTAssertEqual(
            generation.generatedAt,
            try XCTUnwrap(ISO8601DateFormatter().date(from: "2026-08-16T10:00:00Z"))
        )
    }

    func testResponseWithoutMetadataStillDecodes() throws {
        let payload = #"{"v":1,"beats":[],"edges":[]}"#
        let response = try decoder().decode(
            ProxyAIService.EntryMapResponse.self, from: Data(payload.utf8)
        )
        let generation = ProxyAIService.generation(from: response)

        XCTAssertEqual(generation.model, "")
        XCTAssertTrue(generation.map.beats.isEmpty)
        XCTAssertEqual(generation.map.v, 1)
    }

    func testDecodesEdgesWithTheirSnakeCasedType() throws {
        let payload = #"""
        {"v":1,"beats":[],"edges":[{"from":"b0","to":"b1","type":"evidence_for","phrasing":"showed me","polarity":-1}]}
        """#
        let response = try decoder().decode(
            ProxyAIService.EntryMapResponse.self, from: Data(payload.utf8)
        )
        XCTAssertEqual(response.edges.first?.type, .evidenceFor)
        XCTAssertEqual(response.edges.first?.polarity, -1)
    }
}
