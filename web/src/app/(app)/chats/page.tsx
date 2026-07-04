'use client'

// Chats tab root (design B.10) — a live inbox of `chats/{id}` conversations.
// Compose menu creates a new text chat (voice is M6, disabled here); rows
// link to the conversation; delete goes through an inline confirm dialog
// (never `window.confirm`) before calling the cascading `deleteChat`.

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AudioLines, BookText, Loader2, MessageCircle, SquarePen, Trash2 } from 'lucide-react'
import { useSession } from '@/lib/session/session-context'
import { createChat, deleteChat, streamChats } from '@/lib/firestore/chats'
import Card from '@/components/app/Card'
import EmptyState from '@/components/app/EmptyState'
import { SkeletonRow } from '@/components/app/Skeleton'
import type { Chat } from '@/lib/firestore/models'

/** `"just now"` / `"5m ago"` / `"3h ago"` / `"2d ago"`, falling back to a
 * short absolute date past a week — mirrors an inbox's relative timestamp
 * without pulling in a date library. */
function formatRelativeTime(date: Date): string {
  const diffSec = Math.round((Date.now() - date.getTime()) / 1000)
  if (diffSec < 60) return 'just now'
  const diffMin = Math.round(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHour = Math.round(diffMin / 60)
  if (diffHour < 24) return `${diffHour}h ago`
  const diffDay = Math.round(diffHour / 24)
  if (diffDay < 7) return `${diffDay}d ago`
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
}

export default function ChatsPage() {
  const router = useRouter()
  const { uid } = useSession()

  // `null` = loading; array (possibly empty) once the first snapshot lands.
  const [chats, setChats] = useState<Chat[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [composeOpen, setComposeOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) return
    setChats(null)
    setError(null)
    const unsubscribe = streamChats(
      uid,
      setChats,
      (err) => setError(err instanceof Error ? err.message : 'Something went wrong.'),
    )
    return unsubscribe
  }, [uid, retryKey])

  async function handleStartTextChat() {
    if (creating) return
    setComposeOpen(false)
    setCreating(true)
    try {
      const id = await createChat({ kind: 'text' })
      router.push(`/chats/${id}`)
    } catch (err) {
      console.error('[chats] createChat failed:', err)
      setCreating(false)
    }
  }

  async function handleConfirmDelete() {
    if (!confirmDeleteId) return
    const id = confirmDeleteId
    setDeletingId(id)
    try {
      await deleteChat(id)
      // The live subscription drops the row once the delete lands — no local
      // state mutation needed here.
    } catch (err) {
      console.error('[chats] deleteChat failed:', err)
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  const loading = chats === null && !error
  const loadError = error !== null
  const empty = !loading && !loadError && chats !== null && chats.length === 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="serif text-[26px] font-semibold" style={{ color: 'var(--text)' }}>
          Chats
        </h1>
        <div className="relative">
          <button
            type="button"
            onClick={() => setComposeOpen((o) => !o)}
            disabled={creating}
            aria-label="New chat"
            aria-haspopup="menu"
            aria-expanded={composeOpen}
            className="flex h-10 w-10 items-center justify-center rounded-full transition-opacity hover:opacity-70 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ color: 'var(--accent)' }}
          >
            {creating ? (
              <Loader2 size={20} strokeWidth={1.75} className="animate-spin" />
            ) : (
              <SquarePen size={20} strokeWidth={1.75} />
            )}
          </button>
          {composeOpen && (
            <div
              role="menu"
              aria-label="New chat options"
              className="absolute right-0 top-11 z-10 w-56 rounded-2xl p-2"
              style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', boxShadow: 'var(--shadowHover)' }}
            >
              <button
                type="button"
                role="menuitem"
                onClick={handleStartTextChat}
                disabled={creating}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-sans text-sm font-medium transition-colors disabled:opacity-50"
                style={{ color: 'var(--text)' }}
              >
                <MessageCircle size={16} strokeWidth={1.75} style={{ color: 'var(--accent)' }} />
                Start Text Chat
              </button>
              <button
                type="button"
                role="menuitem"
                disabled
                title="Voice chat — coming soon"
                className="flex w-full cursor-not-allowed items-center gap-2.5 rounded-xl px-3 py-2.5 text-left font-sans text-sm font-medium opacity-40"
                style={{ color: 'var(--text2)' }}
              >
                <AudioLines size={16} strokeWidth={1.75} />
                Start Voice Chat
              </button>
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      )}

      {loadError && (
        <EmptyState
          title="Couldn't load your chats"
          message={error ?? 'Please try again.'}
          actionLabel="Retry"
          onAction={() => setRetryKey((k) => k + 1)}
        />
      )}

      {empty && (
        <EmptyState
          title="Talk to your journal"
          message="Start a conversation with your AI companion — it remembers what you've written."
          actionLabel="Start Text Chat"
          onAction={handleStartTextChat}
        />
      )}

      {!loading && !loadError && !empty && (
        <div className="flex flex-col gap-3">
          {chats!.map((chat) => (
            <ChatRow
              key={chat.id}
              chat={chat}
              deleting={deletingId === chat.id}
              onDeleteRequest={() => setConfirmDeleteId(chat.id)}
            />
          ))}
        </div>
      )}

      {confirmDeleteId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onClick={() => !deletingId && setConfirmDeleteId(null)}
          role="presentation"
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Delete chat"
            className="w-full max-w-sm rounded-card p-5"
            style={{ background: 'var(--surface)', boxShadow: 'var(--shadowHover)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="serif text-lg font-semibold" style={{ color: 'var(--text)' }}>
              Delete this chat?
            </p>
            <p className="mt-1.5 font-sans text-sm" style={{ color: 'var(--text2)' }}>
              This removes the conversation and its messages. This can&rsquo;t be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                disabled={deletingId !== null}
                className="btn-ghost disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingId !== null}
                className="bg-danger inline-flex items-center gap-2 rounded-btn px-5 py-2.5 font-sans text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingId ? (
                  <Loader2 size={14} strokeWidth={2.25} className="animate-spin" />
                ) : (
                  <Trash2 size={14} strokeWidth={2} />
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ChatRow({
  chat,
  deleting,
  onDeleteRequest,
}: {
  chat: Chat
  deleting: boolean
  onDeleteRequest: () => void
}) {
  const Icon = chat.kind === 'voice' ? AudioLines : MessageCircle
  const subtitle = chat.kind === 'voice' ? 'Voice call' : 'Text chat'
  const showJournalChip = Boolean(chat.journalTitle && chat.journalId)

  return (
    <Card className="group flex items-center gap-3">
      {/* The row link intentionally does NOT wrap the delete button below —
          a <button> nested inside an <a> is invalid HTML and would make the
          delete click also trigger navigation. The journal chip is rendered
          as plain (non-interactive) text for the same reason: this avoids
          any nested-anchor construct entirely. */}
      <Link href={`/chats/${chat.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ background: 'var(--accentSoft)', color: 'var(--accentDeep)' }}
        >
          <Icon size={18} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="serif truncate text-[17px] font-semibold" style={{ color: 'var(--text)' }}>
            {chat.title || 'New chat'}
          </p>
          <div className="mt-0.5 flex min-w-0 items-center gap-2">
            <span className="shrink-0 font-sans text-xs" style={{ color: 'var(--text2)' }}>
              {subtitle}
            </span>
            {showJournalChip && (
              <span
                className="inline-flex min-w-0 items-center gap-1 truncate rounded-full px-2 py-0.5 font-sans text-[11px] font-medium"
                style={{ background: 'var(--surfaceAlt)', color: 'var(--text2)', border: '1px solid var(--hairline)' }}
              >
                <BookText size={10} strokeWidth={2} className="shrink-0" />
                <span className="truncate">{chat.journalTitle}</span>
              </span>
            )}
          </div>
        </div>
        <span className="shrink-0 font-sans text-xs" style={{ color: 'var(--text3)' }}>
          {formatRelativeTime(chat.lastMessageAt)}
        </span>
      </Link>
      <button
        type="button"
        onClick={onDeleteRequest}
        disabled={deleting}
        aria-label="Delete chat"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-danger opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {deleting ? (
          <Loader2 size={16} strokeWidth={2} className="animate-spin" />
        ) : (
          <Trash2 size={16} strokeWidth={1.75} />
        )}
      </button>
    </Card>
  )
}
