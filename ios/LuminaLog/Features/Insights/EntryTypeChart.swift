import SwiftUI
import Charts

/// Donut of entry counts by type.
struct EntryTypeChart: View {
    let slices: [EntryTypeSlice]

    var body: some View {
        Chart(slices) { slice in
            SectorMark(angle: .value("Count", slice.count),
                       innerRadius: .ratio(0.6),
                       angularInset: 1.5)
                .foregroundStyle(slice.type.tint)
                .annotation(position: .overlay) {
                    Text("\(slice.count)").font(.captionText).foregroundStyle(.white)
                }
        }
        .chartForegroundStyleScale(domain: slices.map { $0.type.displayName },
                                   range: slices.map { $0.type.tint })
        .frame(height: 200)
    }
}

#Preview {
    EntryTypeChart(slices: [
        EntryTypeSlice(type: .text, count: 24), EntryTypeSlice(type: .voice, count: 8),
        EntryTypeSlice(type: .image, count: 5), EntryTypeSlice(type: .video, count: 2)
    ]).padding()
}
