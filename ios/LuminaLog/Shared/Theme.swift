import SwiftUI
import UIKit

// MARK: - Colors

extension Color {

    /// The single warm accent used across the app — a calm amber/terracotta.
    static let accentWarm = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.93, green: 0.58, blue: 0.30, alpha: 1.0) // lighter amber for dark
            : UIColor(red: 0.88, green: 0.53, blue: 0.24, alpha: 1.0) // #E0863C terracotta
    })

    /// Primary screen background — warm off-white in light, near-black in dark.
    static let appBackground = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.07, green: 0.06, blue: 0.06, alpha: 1.0)
            : UIColor(red: 0.98, green: 0.96, blue: 0.94, alpha: 1.0)
    })

    /// Secondary background for grouped sections and sheets.
    static let secondaryBackground = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.11, green: 0.10, blue: 0.09, alpha: 1.0)
            : UIColor(red: 0.95, green: 0.92, blue: 0.89, alpha: 1.0)
    })

    /// Card surfaces (entry rows, stat cards, prompt cards).
    static let cardBackground = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.14, green: 0.13, blue: 0.12, alpha: 1.0)
            : UIColor.white
    })

    /// Primary text — soft warm near-black / warm off-white.
    static let textPrimary = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.95, green: 0.93, blue: 0.91, alpha: 1.0)
            : UIColor(red: 0.17, green: 0.14, blue: 0.12, alpha: 1.0)
    })

    /// Secondary text — captions, timestamps, supporting copy.
    static let textSecondary = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.65, green: 0.61, blue: 0.57, alpha: 1.0)
            : UIColor(red: 0.45, green: 0.41, blue: 0.38, alpha: 1.0)
    })

    /// Destructive actions (Delete Account, end call) — a warm red that
    /// reads against both palettes.
    static let danger = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.94, green: 0.42, blue: 0.38, alpha: 1.0)
            : UIColor(red: 0.78, green: 0.22, blue: 0.18, alpha: 1.0)
    })

    // MARK: Journal-type tints
    //
    // Per-type tints for journal entry type pills — warm hues in the accent
    // family that read in both light and dark modes.

    /// Tint for text entries — the standard warm accent.
    static let tintText = accentWarm

    /// Tint for voice entries — warm rose.
    static let tintVoice = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.88, green: 0.50, blue: 0.50, alpha: 1.0)
            : UIColor(red: 0.76, green: 0.34, blue: 0.36, alpha: 1.0)
    })

    /// Tint for video entries — warm plum.
    static let tintVideo = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.74, green: 0.56, blue: 0.82, alpha: 1.0)
            : UIColor(red: 0.52, green: 0.36, blue: 0.60, alpha: 1.0)
    })

    /// Tint for image entries — warm olive.
    static let tintImage = Color(uiColor: UIColor { traits in
        traits.userInterfaceStyle == .dark
            ? UIColor(red: 0.66, green: 0.72, blue: 0.42, alpha: 1.0)
            : UIColor(red: 0.42, green: 0.50, blue: 0.26, alpha: 1.0)
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
