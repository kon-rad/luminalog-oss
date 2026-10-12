import SwiftUI
import UIKit

/// A justified, hyphenated serif paragraph with an optional italic run-in lead, set
/// like the body of a printed paper. SwiftUI's `Text` can't justify or hyphenate,
/// so this wraps a `UILabel`. It fills the width it's offered and is as tall as its
/// text, and follows Dynamic Type and the color scheme.
struct PaperText: UIViewRepresentable {

    /// Italic run-in at the start of the paragraph, e.g. the summary's one-line gist.
    var lead: String?
    let text: String
    var style: UIFont.TextStyle = .body
    var color: Color = .textPrimary

    func makeUIView(context: Context) -> UILabel {
        let label = UILabel()
        label.numberOfLines = 0
        label.lineBreakMode = .byWordWrapping
        label.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        label.setContentHuggingPriority(.required, for: .vertical)
        return label
    }

    func updateUIView(_ label: UILabel, context: Context) {
        let traits = UITraitCollection(preferredContentSizeCategory: UIContentSizeCategory(context.environment.dynamicTypeSize))
        let base = UIFont.preferredFont(forTextStyle: style, compatibleWith: traits)
        let serif = base.fontDescriptor.withDesign(.serif) ?? base.fontDescriptor
        let roman = UIFont(descriptor: serif, size: 0)
        let italic = UIFont(descriptor: serif.withSymbolicTraits(.traitItalic) ?? serif, size: 0)

        let paragraph = NSMutableParagraphStyle()
        paragraph.alignment = .justified
        paragraph.hyphenationFactor = 0.9
        paragraph.lineSpacing = 1.5
        let ink = UIColor(Color(color.resolve(in: context.environment)))

        let out = NSMutableAttributedString()
        if let lead, !lead.isEmpty {
            out.append(NSAttributedString(string: lead + " ", attributes: [.font: italic]))
        }
        out.append(NSAttributedString(string: text, attributes: [.font: roman]))
        out.addAttributes([.paragraphStyle: paragraph, .foregroundColor: ink],
                          range: NSRange(location: 0, length: out.length))
        label.attributedText = out
    }

    func sizeThatFits(_ proposal: ProposedViewSize, uiView: UILabel, context: Context) -> CGSize? {
        guard let width = proposal.width, width.isFinite, width > 0 else { return nil }
        let fitted = uiView.sizeThatFits(CGSize(width: width, height: .greatestFiniteMagnitude))
        return CGSize(width: width, height: ceil(fitted.height))
    }
}
