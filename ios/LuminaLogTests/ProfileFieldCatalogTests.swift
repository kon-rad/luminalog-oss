import XCTest
@testable import LuminaLog

final class ProfileFieldCatalogTests: XCTestCase {

    func testCatalogHas18FieldsWithUniqueKeys() {
        let all = ProfileFieldCatalog.all
        XCTAssertEqual(all.count, 18)
        XCTAssertEqual(Set(all.map(\.key)).count, 18)
    }

    func testExactlyOneHeaderField() {
        XCTAssertEqual(ProfileFieldCatalog.all.filter(\.isHeader).count, 1)
        XCTAssertEqual(ProfileFieldCatalog.all.first(where: \.isHeader)?.key, "name")
    }

    func testGetAndSetRoundTripThroughProfile() {
        var profile = UserProfile(id: "u")
        for field in ProfileFieldCatalog.all {
            field.set(&profile, "value-\(field.key)")
        }
        for field in ProfileFieldCatalog.all {
            XCTAssertEqual(field.get(profile), "value-\(field.key)")
        }
        // Spot-check that the right storage was used.
        XCTAssertEqual(profile.displayName, "value-name")
        XCTAssertEqual(profile.biography, "value-biography")
        XCTAssertEqual(profile.details.goals, "value-goals")
        XCTAssertEqual(profile.details.friendsDescribe, "value-friendsDescribe")
    }

    func testBodyFieldsExcludeHeaderAndCoverAllDetails() {
        let body = ProfileField.Group.allCases.flatMap { ProfileFieldCatalog.bodyFields(in: $0) }
        XCTAssertEqual(body.count, 17) // 18 - the header
        XCTAssertFalse(body.contains { $0.isHeader })
    }
}
