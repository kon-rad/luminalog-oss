import SwiftUI
import UIKit

// MARK: - Colors

extension Color {

    /// The single warm accent used across the app — a calm amber/terracotta.
    /// Light: #CE7F44, Dark: #E5A063 (core.jsx design tokens).
    static let accentWarm = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.898, green: 0.627, blue: 0.388, alpha: 1.0) // #E5A063
            : UIColor(red: 0.808, green: 0.498, blue: 0.267, alpha: 1.0) // #CE7F44
    })

    /// Primary screen background — warm paper in light, deep warm-black in dark.
    /// Light: #F4F0E9, Dark: #16130E (core.jsx design tokens).
    static let appBackground = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.086, green: 0.075, blue: 0.055, alpha: 1.0) // #16130E
            : UIColor(red: 0.957, green: 0.941, blue: 0.914, alpha: 1.0) // #F4F0E9
    })

    /// Secondary background for grouped sections and sheets.
    /// Light: #FBF8F3, Dark: #1D1913 (core.jsx bgElev).
    static let secondaryBackground = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.114, green: 0.098, blue: 0.075, alpha: 1.0) // #1D1913
            : UIColor(red: 0.984, green: 0.973, blue: 0.953, alpha: 1.0) // #FBF8F3
    })

    /// Card surfaces (entry rows, stat cards, prompt cards).
    /// Light: #FFFDFA, Dark: #221E17 (core.jsx surface).
    static let cardBackground = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.133, green: 0.118, blue: 0.090, alpha: 1.0) // #221E17
            : UIColor(red: 1.0, green: 0.992, blue: 0.980, alpha: 1.0)   // #FFFDFA
    })

    /// Primary text — soft warm near-black / warm off-white.
    /// Light: #2B2722, Dark: #F3EEE4 (core.jsx design tokens).
    static let textPrimary = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.953, green: 0.933, blue: 0.894, alpha: 1.0) // #F3EEE4
            : UIColor(red: 0.169, green: 0.153, blue: 0.133, alpha: 1.0) // #2B2722
    })

    /// Secondary text — captions, timestamps, supporting copy.
    /// Light: #7C7468, Dark: #A89E8F (core.jsx text2).
    static let textSecondary = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.659, green: 0.620, blue: 0.561, alpha: 1.0) // #A89E8F
            : UIColor(red: 0.486, green: 0.455, blue: 0.408, alpha: 1.0) // #7C7468
    })

    /// Destructive actions (Delete Account, end call).
    /// #E5544B across both palettes.
    static let danger = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.898, green: 0.329, blue: 0.294, alpha: 1.0) // #E5544B
            : UIColor(red: 0.898, green: 0.329, blue: 0.294, alpha: 1.0) // #E5544B
    })

    // MARK: Journal-type tints
    //
    // Per-type tints for journal entry type pills — warm hues in the accent
    // family that read in both light and dark modes.

    /// Tint for text entries — the standard warm accent.
    static let tintText = accentWarm

    /// Tint for voice entries — warm rose.
    /// Light: #C16C6C, Dark: #D98C8C (core.jsx typeMeta).
    static let tintVoice = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.851, green: 0.549, blue: 0.549, alpha: 1.0) // #D98C8C
            : UIColor(red: 0.757, green: 0.424, blue: 0.424, alpha: 1.0) // #C16C6C
    })

    /// Tint for video entries — warm plum.
    /// Light: #897BA8, Dark: #A89BC4 (core.jsx typeMeta).
    static let tintVideo = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.659, green: 0.608, blue: 0.769, alpha: 1.0) // #A89BC4
            : UIColor(red: 0.537, green: 0.482, blue: 0.659, alpha: 1.0) // #897BA8
    })

    /// Tint for image entries — warm olive.
    /// Light: #6E8C77, Dark: #90AE97 (core.jsx typeMeta).
    static let tintImage = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.565, green: 0.682, blue: 0.592, alpha: 1.0) // #90AE97
            : UIColor(red: 0.431, green: 0.549, blue: 0.467, alpha: 1.0) // #6E8C77
    })
}

// MARK: - Typography
//
// Journal content and quotes use a serif design for a warm, bookish feel;
// UI chrome stays on the default SF system design.

extension Font {

    /// Large serif title for journal entries and the wordmark.
    static let journalTitle = Font.system(.largeTitle, design: .serif).weight(.semibold)

    /// Serif body for journal text content.
    static let journalBody = Font.system(.body, design: .serif)

    /// Serif italic style for prompts and reflective quotes.
    static let promptQuote = Font.system(.title3, design: .serif).italic()

    /// Compact serif italic for prompt list rows.
    static let promptQuoteCompact = Font.system(.body, design: .serif).italic()

    /// Serif headline for entry titles in lists.
    static let entryTitle = Font.system(.headline, design: .serif).weight(.semibold)

    /// Bold rounded-feel numerals for stats (streaks, word counts).
    static let statValue = Font.system(.title2, design: .default).weight(.bold)

    /// Section headers in UI chrome.
    static let sectionHeader = Font.system(.headline, design: .default)

    /// Standard UI body text (chrome, settings, buttons).
    static let uiBody = Font.system(.body, design: .default)

    /// Small supporting text — timestamps, labels, badges.
    static let captionText = Font.system(.caption, design: .default)
}

// MARK: - Spacing

/// Spacing scale used throughout the app (points).
enum Spacing {
    /// 4pt — tight inline gaps.
    static let xs: CGFloat = 4
    /// 8pt — small gaps between related elements.
    static let s: CGFloat = 8
    /// 16pt — default padding and stack spacing.
    static let m: CGFloat = 16
    /// 24pt — section spacing.
    static let l: CGFloat = 24
    /// 32pt — large screen-level spacing.
    static let xl: CGFloat = 32
}

// MARK: - Corner Radius

/// Corner radius scale for surfaces and controls.
enum CornerRadius {
    /// 8pt — small controls, pills, badges.
    static let small: CGFloat = 8
    /// 12pt — buttons and inputs.
    static let medium: CGFloat = 12
    /// 16pt — cards.
    static let large: CGFloat = 16
    /// 24pt — sheets and hero surfaces.
    static let xLarge: CGFloat = 24
}
