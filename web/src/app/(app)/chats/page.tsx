import { MessageCircle } from 'lucide-react'

// Chats tab root — placeholder for M2 (design B.10 owns the real list; chat
// itself is M5+). Warm empty state: "Talk to your journal."
export default function ChatsPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <MessageCircle size={44} strokeWidth={1.5} color="var(--accent)" opacity={0.8} />
      <p className="serif text-xl font-semibold" style={{ color: 'var(--text)' }}>
        Talk to your journal
      </p>
      <p className="max-w-xs text-sm" style={{ color: 'var(--text2)' }}>
        Conversations with your AI companion will live here. Chat is coming in a later update.
      </p>
    </div>
  )
}
