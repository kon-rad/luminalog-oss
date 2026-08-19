import XCTest
import SwiftUI
@testable import LuminaLog

final class CognitiveMapThemeTests: XCTestCase {

    func testEveryDomainHasATokenInBothSchemes() {
        for scheme in [ColorScheme.light, .dark] {
            let tokens = CognitiveMapTheme.tokens(for: scheme)
            for domain in LifeDomain.allCases {
                let name = CognitiveMapTheme.variableName(for: domain)
                let value = tokens[name]
                XCTAssertNotNil(value, "\(domain) missing in \(scheme)")
                XCTAssertTrue(
                    value?.hasPrefix("#") == true,
                    "\(domain) in \(scheme) must be a hex string the CSS can use"
                )
            }
        }
    }

    func testTheInkTokensArePresentInBothSchemes() {
        for scheme in [ColorScheme.light, .dark] {
            let tokens = CognitiveMapTheme.tokens(for: scheme)
            for name in ["--cm-text", "--cm-text-muted", "--cm-surface", "--cm-edge", "--cm-keeper"] {
                XCTAssertNotNil(tokens[name], "\(name) missing in \(scheme)")
            }
        }
    }

    func testLightAndDarkDifferForEveryDomain() {
        let light = CognitiveMapTheme.tokens(for: .light)
        let dark = CognitiveMapTheme.tokens(for: .dark)
        for domain in LifeDomain.allCases {
            let name = CognitiveMapTheme.variableName(for: domain)
            XCTAssertNotEqual(light[name], dark[name], "\(domain) is identical in both schemes")
        }
    }

    func testVariableNamesMatchTheRendererContract() {
        // These strings are the contract with packages/cognitive-map/src/theme.ts.
        XCTAssertEqual(CognitiveMapTheme.variableName(for: .craft), "--cm-craft")
        XCTAssertEqual(CognitiveMapTheme.variableName(for: .money), "--cm-money")
        XCTAssertEqual(CognitiveMapTheme.variableName(for: .other), "--cm-other")
    }

    func testTheSurfaceTokenIsTheAppGroundNotACardColour() {
        // --cm-surface only masks the edge curve behind its label. If it is a card
        // colour, every edge label renders as a visible pale box on the map.
        XCTAssertEqual(CognitiveMapTheme.tokens(for: .light)["--cm-surface"], "#F4F0E9")
        XCTAssertEqual(CognitiveMapTheme.tokens(for: .dark)["--cm-surface"], "#16130E")
    }

    func testTokensSerializeToValidJSONForInjection() throws {
        let json = try JSONSerialization.data(withJSONObject: CognitiveMapTheme.tokens(for: .dark))
        XCTAssertGreaterThan(json.count, 0)
    }

    func testTheRendererBundleIsPresentInTheAppBundle() {
        // Guards against someone editing the package and forgetting `npm run sync:ios`.
        XCTAssertNotNil(Bundle.main.url(forResource: "map", withExtension: "html"))
    }
}
