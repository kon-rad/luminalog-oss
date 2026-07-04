import XCTest
@testable import LuminaLog

final class SoulModelsTests: XCTestCase {
    func test_decodesSoulPayload() throws {
        let json = """
        {"constellation":{"version":7,"points":[
          {"dayIndex":20272,"date":"2026-07-03","x":0.42,"y":-0.11,"z":0.88,"wordCount":812,"streakAtEarn":5}
        ]},"stats":{"streakCount":5,"totalWords":61234,"goalDayWords":300}}
        """.data(using: .utf8)!
        let payload = try JSONDecoder().decode(SoulPayload.self, from: json)
        XCTAssertEqual(payload.constellation.version, 7)
        XCTAssertEqual(payload.constellation.points.count, 1)
        XCTAssertEqual(payload.constellation.points[0].wordCount, 812)
        XCTAssertEqual(payload.stats.totalWords, 61234)
    }

    func test_decodesIgnoringUnknownFields() throws {
        // /v1/soul also returns an `nft` field; the model must ignore it.
        let json = """
        {"constellation":{"version":1,"points":[]},
         "stats":{"streakCount":0,"totalWords":0,"goalDayWords":0},
         "nft":{"tokenId":"2","contract":"0xd488"}}
        """.data(using: .utf8)!
        let payload = try JSONDecoder().decode(SoulPayload.self, from: json)
        XCTAssertEqual(payload.constellation.version, 1)
        XCTAssertTrue(payload.constellation.points.isEmpty)
    }
}

@MainActor
final class SoulViewModelTests: XCTestCase {
    func test_load_success_populatesPayloadAndStars() async {
        let vm = SoulViewModel(service: MockSoulService(result: .success(.sample)))
        await vm.load()
        XCTAssertEqual(vm.state, .loaded)
        XCTAssertEqual(vm.payload, .sample)
        XCTAssertEqual(vm.stars, 12)
    }

    func test_load_empty_isLoadedWithZeroStars() async {
        let vm = SoulViewModel(service: MockSoulService(result: .success(.empty)))
        await vm.load()
        XCTAssertEqual(vm.state, .loaded)
        XCTAssertEqual(vm.stars, 0)
    }

    func test_load_failure_setsFailed() async {
        struct Boom: Error {}
        let vm = SoulViewModel(service: MockSoulService(result: .failure(Boom())))
        await vm.load()
        if case .failed = vm.state {} else { XCTFail("expected .failed, got \(vm.state)") }
        XCTAssertNil(vm.payload)
    }
}
