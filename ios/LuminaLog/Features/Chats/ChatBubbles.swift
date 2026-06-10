import SwiftUI

// MARK: - Message bubble

/// One chat bubble (design §7): user messages sit right in the warm accent,
/// assistant messages sit left on a card surface. Soft, asymmetric corners
/// give the conversation the app's hand-made feel.
struct MessageBubble: View {

    let text: String
    let role: MessageRole
    /// Streaming replies show a subtle trailing cursor.
    var isStreaming: Bool = false
    /// Failed sends render dimmed with a warning tint.
    var isFailed: Bool = false

    private var isUser: Bool { role == .user }

    var body: some View {
        HStack {
            if isUser { Spacer(minLength: 48) }

            Text(text + (isStreaming ? " …" : ""))
                .font(.uiBody)
                .foregroundStyle(isUser ? Color.white : Color.textPrimary)
                .padding(.horizontal, Spacing.m)
                .padding(.vertical, Spacing.s + Spacing.xs)
                .background(bubbleShape.fill(fillColor))
                .overlay {
                    if isFailed {
                        bubbleShape.stroke(Color.tintVoice.opacity(0.6), lineWidth: 1)
                    }
                }
                .opacity(isFailed ? 0.7 : 1)

            if !isUser { Spacer(minLength: 48) }
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(isUser ? "You" : "Companion"): \(text)")
    }

    private var fillColor: Color {
        isUser ? Color.accentWarm : Color.cardBackground
    }

    private var bubbleShape: UnevenRoundedRectangle {
        UnevenRoundedRectangle(
            topLeadingRadius: CornerRadius.large,
            bottomLeadingRadius: isUser ? CornerRadius.large : CornerRadius.small,
            bottomTrailingRadius: isUser ? CornerRadius.small : CornerRadius.large,
            topTrailingRadius: CornerRadius.large,
            style: .continuous
        )
    }
}

// MARK: - Timestamp caption

/// Small relative timestamp shown under the last bubble of a same-role run.
struct BubbleTimestamp: View {

    let date: Date
    let role: MessageRole

    var body: some View {
        Text(date.formatted(.relative(presentation: .named)))
            .font(.captionText)
            .foregroundStyle(Color.textSecondary)
            .frame(maxWidth: .infinity, alignment: role == .user ? .trailing : .leading)
            .padding(role == .user ? .trailing : .leading, Spacing.xs)
    }
}

// MARK: - Typing indicator

/// Three softly pulsing dots while waiting for the first streamed token.
struct TypingIndicator: View {

    @State private var animating = false

    var body: some View {
        HStack {
            HStack(spacing: Spacing.xs + 1) {
                ForEach(0..<3, id: \.self) { index in
                    Circle()
                        .fill(Color.textSecondary)
                        .frame(width: 7, height: 7)
                        .scaleEffect(animating ? 1.0 : 0.55)
                        .opacity(animating ? 1.0 : 0.4)
                        .animation(
                            .easeInOut(duration: 0.55)
                                .repeatForever(autoreverses: true)
                                .delay(Double(index) * 0.18),
                            value: animating
                        )
                }
            }
            .padding(.horizontal, Spacing.m)
            .padding(.vertical, Spacing.m - Spacing.xs)
            .background(
                UnevenRoundedRectangle(
                    topLeadingRadius: CornerRadius.large,
                    bottomLeadingRadius: CornerRadius.small,
                    bottomTrailingRadius: CornerRadius.large,
                    topTrailingRadius: CornerRadius.large,
                    style: .continuous
                )
                .fill(Color.cardBackground)
            )

            Spacer(minLength: 48)
        }
        .onAppear { animating = true }
        .accessibilityLabel("The companion is thinking")
    }
}

// MARK: - Previews

#Preview("Bubbles") {
    ZStack {
        Color.appBackground.ignoresSafeArea()
        VStack(spacing: Spacing.s) {
            MessageBubble(text: "How was my week, honestly?", role: .user)
            BubbleTimestamp(date: .now.addingTimeInterval(-3600), role: .user)
            MessageBubble(
                text: "You protected your mornings better than usual, and it shows in what you wrote.",
                role: .assistant
            )
            MessageBubble(text: "Reading back through your entries", role: .assistant, isStreaming: true)
            MessageBubble(text: "This one didn't send.", role: .user, isFailed: true)
            TypingIndicator()
        }
        .padding()
    }
}

#Preview("Bubbles Dark") {
    ZStack {
        Color.appBackground.ignoresSafeArea()
        VStack(spacing: Spacing.s) {
            MessageBubble(text: "How was my week, honestly?", role: .user)
            MessageBubble(
                text: "You protected your mornings better than usual, and it shows in what you wrote.",
                role: .assistant
            )
            TypingIndicator()
        }
        .padding()
    }
    .preferredColorScheme(.dark)
}
