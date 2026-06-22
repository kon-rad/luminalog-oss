import SwiftUI

/// Bottom sheet shown when the user taps "Chat ›" on a journal entry.
/// Presents "Context: [title]" plus text/voice start buttons.
struct JournalChatPickerSheet: View {

    let journalTitle: String
    let onSelect: (ChatKind) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: Spacing.m) {
            HStack(spacing: Spacing.xs) {
                Image(systemName: "book.closed")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(Color.accentWarm)
                Text("Context: \(journalTitle)")
                    .font(.captionText.weight(.semibold))
                    .foregroundStyle(Color.accentWarm)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
            .frame(maxWidth: .infinity)
            .padding(.top, Spacing.s)

            VStack(spacing: Spacing.s) {
                Button {
                    dismiss()
                    onSelect(.text)
                } label: {
                    Label("Start Text Chat", systemImage: "bubble.left.and.text.bubble.right")
                        .font(.uiBody.weight(.semibold))
                        .foregroundStyle(Color.white)
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .background(
                            RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous)
                                .fill(Color.accentWarm)
                        )
                }
                .buttonStyle(.plain)

                Button {
                    dismiss()
                    onSelect(.voice)
                } label: {
                    Label("Start Voice Call", systemImage: "waveform")
                        .font(.uiBody.weight(.semibold))
                        .foregroundStyle(Color.accentWarm)
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .background(
                            RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous)
                                .fill(Color.accentWarm.opacity(0.12))
                        )
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal, Spacing.m)
        .padding(.bottom, Spacing.m)
        .presentationDetents([.height(200)])
        .presentationDragIndicator(.visible)
        .background(Color.appBackground.ignoresSafeArea())
    }
}

#Preview {
    Color.appBackground
        .sheet(isPresented: .constant(true)) {
            JournalChatPickerSheet(journalTitle: "Morning Reflection") { kind in
                print("Selected: \(kind)")
            }
        }
}
