import SwiftUI

/// The map's palette, owned by the app rather than by the renderer.
///
/// `packages/cognitive-map` sets no colours of its own: every fill and stroke is a
/// CSS custom property, and the host supplies the values. That is what lets one
/// renderer follow the iOS design system and the web design system without knowing
/// either exists.
///
/// The six domain hues are warm-shifted into Argo's register rather than taken from a
/// generic chart palette. The app lives on parchment #F4F0E9 in light and ink #16130E
/// in dark, and its existing type tints are desaturated (#C16C6C, #897BA8, #6E8C77).
/// Hue separation is what carries the domain coding, and that survives desaturation
/// intact; saturated primaries would read as a different app's screen.
enum CognitiveMapTheme {

    /// The CSS custom property a domain maps to. These strings are the contract with
    /// packages/cognitive-map/src/theme.ts and must match it exactly.
    static func variableName(for domain: LifeDomain) -> String {
        "--cm-\(domain.rawValue)"
    }

    private static let lightDomains: [LifeDomain: String] = [
        .craft: "#4F6F94",   // slate blue
        .body: "#6E8C77",    // sage, the tintImage family
        .people: "#C16C6C",  // dusty rose, the tintVoice family
        .place: "#B07C3E",   // ochre
        .mind: "#897BA8",    // muted violet, the tintVideo family
        .money: "#8A7A55",   // warm stone
        .other: "#9A9287",   // neutral
    ]

    private static let darkDomains: [LifeDomain: String] = [
        .craft: "#86A3C4",
        .body: "#90AE97",
        .people: "#D98C8C",
        .place: "#D3A263",
        .mind: "#A89BC4",
        .money: "#B8A97F",
        .other: "#7E786D",
    ]

    // `--cm-surface` is the GROUND the map sits on, not a card colour: it is used only
    // to mask the edge curve behind its label. Setting it to cardBackground makes every
    // edge label read as a pale box.
    private static let lightInk: [String: String] = [
        "--cm-text": "#2B2722",        // textPrimary
        "--cm-text-muted": "#7C7468",  // textSecondary
        "--cm-surface": "#F4F0E9",     // appBackground
        "--cm-edge": "#7C7468",
        "--cm-keeper": "#9C7C2A",      // goldSurface
    ]

    private static let darkInk: [String: String] = [
        "--cm-text": "#F3EEE4",
        "--cm-text-muted": "#A89E8F",
        "--cm-surface": "#16130E",
        "--cm-edge": "#A89E8F",
        "--cm-keeper": "#F2CB4C",      // bright gold reads better on ink
    ]

    /// Every custom property the renderer reads, for one colour scheme. Injected into
    /// the WebView as JSON alongside the map.
    static func tokens(for colorScheme: ColorScheme) -> [String: String] {
        let domains = colorScheme == .dark ? darkDomains : lightDomains
        var tokens = colorScheme == .dark ? darkInk : lightInk
        for (domain, hex) in domains {
            tokens[variableName(for: domain)] = hex
        }
        return tokens
    }

    /// The same palette as a SwiftUI colour, for native chrome outside the WebView
    /// (the domain dot on the beat inspector sheet).
    static func color(for domain: LifeDomain) -> Color {
        Color(uiColor: UIColor { traits in
            let hex = traits.userInterfaceStyle == .dark
                ? darkDomains[domain] ?? "#7E786D"
                : lightDomains[domain] ?? "#9A9287"
            return UIColor(cognitiveMapHex: hex)
        })
    }
}

private extension UIColor {
    /// Six-digit hex only. The palette above is the only caller, so anything else is a
    /// programming error and falls back to mid gray rather than trapping.
    convenience init(cognitiveMapHex hex: String) {
        var value: UInt64 = 0
        Scanner(string: hex.replacingOccurrences(of: "#", with: "")).scanHexInt64(&value)
        self.init(
            red: CGFloat((value & 0xFF0000) >> 16) / 255,
            green: CGFloat((value & 0x00FF00) >> 8) / 255,
            blue: CGFloat(value & 0x0000FF) / 255,
            alpha: 1
        )
    }
}
