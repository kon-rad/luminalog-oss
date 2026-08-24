import { ReactNode } from 'react'
import ProGate from '@/components/app/ProGate'

// Chat is a Pro surface (design §2). Gating at the layout covers both the inbox
// (`/chats`) and every conversation (`/chats/[chatId]`) in one place, so a new
// chat route cannot ship ungated by accident.
//
// UI only. The server's `requirePro` guard on POST /v1/ai/chat is what actually
// protects the spend.
export default function ChatsLayout({ children }: { children: ReactNode }) {
  return (
    <ProGate
      feature="Chat"
      blurb="Ask your journal anything. Pro lets Argo read everything you have written and answer from it."
    >
      {children}
    </ProGate>
  )
}
