import SwiftUI

/// Bottom sheet shown when the user taps "Chat ›" on a journal entry.
/// Presents "Context: [title]" plus text/voice start buttons.
struct JournalChatPickerSheet: View {

    let journalTitle: String
    let onSelect: (ChatKind) -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: Spacing.m) {
            VStack(spacing: Spacing.s) {
                Text("Chat about this entry")
                    .font(.sectionHeader)
                    .foregroundStyle(Color.textPrimary)

                Text("Start a new text or voice call with your AI. This journal entry will be included in the conversation as context.")
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)

                HStack(spacing: Spacing.xs) {
                    Image(systemName: "book.closed")
                        .font(.system(size: 12, weight: .semibold))
                        .foregroundStyle(Color.accentWarm)
                    Text(journalTitle)
                        .font(.captionText.weight(.semibold))
                        .foregroundStyle(Color.accentWarm)
                        .lineLimit(1)
                        .truncationMode(.tail)
                }
                .padding(.horizontal, Spacing.s)
                .padding(.vertical, Spacing.xs)
                .background(
                    Capsule(style: .continuous)
                        .fill(Color.accentWarm.opacity(0.12))
                )
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
        .presentationDetents([.height(300)])
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
