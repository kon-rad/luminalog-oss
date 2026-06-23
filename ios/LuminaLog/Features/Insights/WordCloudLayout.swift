import SwiftUI

/// Maps a word's frequency to a font size in [14, 44]. Uniform frequency
/// (max == min) maps to a calm lower-third size so there's no divide-by-zero.
func wordCloudFontSize(count: Int, minCount: Int, maxCount: Int,
                       minSize: CGFloat = 14, maxSize: CGFloat = 44) -> CGFloat {
    // Uniform frequency → a calm lower-third size (24 for the defaults);
    // also avoids divide-by-zero in the interpolation below.
    guard maxCount > minCount else { return minSize + (maxSize - minSize) / 3 }
    let t = CGFloat(count - minCount) / CGFloat(maxCount - minCount)
    return minSize + t * (maxSize - minSize)
}

/// A wrapping flow layout (left-to-right, top-to-bottom). Subviews keep their
/// own ideal size — the word cloud sizes each `Text` before placing it here.
struct WordCloudFlowLayout: Layout {

    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var rowWidth: CGFloat = 0
        var rowHeight: CGFloat = 0
        var totalHeight: CGFloat = 0
        var totalWidth: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if rowWidth + size.width > maxWidth, rowWidth > 0 {
                totalHeight += rowHeight + spacing
                totalWidth = max(totalWidth, rowWidth - spacing)
                rowWidth = 0
                rowHeight = 0
            }
            rowWidth += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
        totalHeight += rowHeight
        totalWidth = max(totalWidth, rowWidth - spacing)
        return CGSize(width: min(totalWidth, maxWidth), height: totalHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize,
                       subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        var y = bounds.minY
        var rowHeight: CGFloat = 0

        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x + size.width > bounds.maxX, x > bounds.minX {
                x = bounds.minX
                y += rowHeight + spacing
                rowHeight = 0
            }
            subview.place(at: CGPoint(x: x, y: y), anchor: .topLeading,
                          proposal: ProposedViewSize(size))
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}
