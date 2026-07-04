'use client'

// Text chat conversation (design B.11 / spec §2 M5-T3). Mirrors the iOS
// render order exactly: context banner -> greeting (client-only, shown only
// on a fresh empty chat) -> persisted message bubbles (from the live
// `streamMessages` subscription) -> optimistic pending user bubble ->
// failed-send row -> typing indicator -> streaming assistant bubble. The
// SERVER persists both the user and assistant message (design §1) — this
// screen never writes to the `messages` subcollection itself, only the chat
// doc's title (one-shot auto-title) via `updateChatTitle`.
//
// Reconciliation is count-based (mirrors iOS): a `baselineCountRef` snapshots
// `messages.length` right before a send, and once the live subscription
// delivers more messages than that baseline, the optimistic `pendingUser`
// bubble is cleared — the server's persisted copy has landed, so keeping the
// optimistic bubble around would duplicate it. A single in-flight send
// (`responding`/`failedSend` guards) is what makes this safe.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { doc, getDoc } from 'firebase/firestore'
import { ArrowLeft, ChevronDown, Loader2, Send } from 'lucide-react'
import { auth, db } from '@/lib/firebase'
import { bootstrapDEK, getCachedDEK } from '@/lib/crypto/dek'
import { decodeChat } from '@/lib/firestore/codec'
import { streamMessages, updateChatTitle } from '@/lib/firestore/chats'
import { streamChat } from '@/lib/api/chat'
import type { Chat, ChatMessage } from '@/lib/firestore/models'
import EmptyState from '@/components/app/EmptyState'

const GREETING_TEXT = "I've been reading along in your journal. What's on your mind today?"

interface PendingUser {
  text: string
  // Stable per-logical-message id (FIX A) — generated once at send time and
  // reused on retry so the server can dedupe on this id once it honors
  // `messageId`.
  id: string
}

interface FailedSend {
  text: string
  id: string
}

/**
 * The auto-title heuristic (design §2 M5-T3): first line, trimmed; clipped to
 * 40 chars with a trailing ellipsis (U+2026) when longer.
 */
function deriveChatTitle(text: string): string {
  const firstLine = (text.split(/\r?\n/)[0] ?? '').trim()
  if (firstLine.length > 40) return `${firstLine.slice(0, 40).trim()}…`
  return firstLine
}

export default function ChatConversationPage({ params }: { params: { chatId: string } }) {
  const { chatId } = params
  const router = useRouter()

  const [chat, setChat] = useState<Chat | null>(null)
  const [chatLoaded, setChatLoaded] = useState(false)
  const [ownerMismatch, setOwnerMismatch] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [hasLoaded, setHasLoaded] = useState(false)

  const [draft, setDraft] = useState('')
  const [responding, setResponding] = useState(false)
  const [awaitingFirstToken, setAwaitingFirstToken] = useState(false)
  const [streamingReply, setStreamingReply] = useState<string | null>(null)
  const [pendingUser, setPendingUser] = useState<PendingUser | null>(null)
  const [failedSend, setFailedSend] = useState<FailedSend | null>(null)

  // A snapshot of `messages.length` taken right before a send — the
  // reconciliation effect below clears `pendingUser` once the live
  // subscription reports more messages than this baseline.
  const baselineCountRef = useRef(0)
  // One-shot guard for the auto-title fire-and-forget, per mount.
  const titledRef = useRef(false)
  const abortControllerRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  // Best-effort single load of the `chats/{id}` doc, just for the
  // journal-linked context banner + `journalId` (passed to `streamChat`) +
  // header title. A failure here never blocks the conversation itself.
  // `chatLoaded` (FIX C) is set true on EITHER outcome (success or failure) —
  // Send is gated on it so a fast first send always has the resolved
  // `journalId` available, and the composer isn't stuck disabled forever if
  // the load fails.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const dek = getCachedDEK() ?? (await bootstrapDEK())
        const snap = await getDoc(doc(db, 'chats', chatId))
        if (cancelled) return
        if (!snap.exists()) {
          setChatLoaded(true)
          return
        }
        const decoded = await decodeChat(chatId, snap.data(), dek)
        if (cancelled) return
        if (decoded.userId !== auth.currentUser?.uid) {
          // Defense-in-depth (FIX B), mirrors the owner-mismatch handling in
          // journal/[id]/page.tsx: security rules + fail-closed decoding
          // already protect against cross-tenant reads — this is just an
          // explicit client-side assertion.
          console.error('[chat] owner mismatch: chat.userId does not match current user')
          setOwnerMismatch(true)
        } else {
          setChat(decoded)
        }
      } catch (err) {
        console.error('[chat] failed to load chat doc:', err)
      } finally {
        if (!cancelled) setChatLoaded(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [chatId])

  // Live message subscription — the server is the only writer.
  useEffect(() => {
    setHasLoaded(false)
    setMessages([])
    const unsubscribe = streamMessages(
      chatId,
      (msgs) => {
        setMessages(msgs)
        setHasLoaded(true)
      },
      (err) => {
        console.error('[chat] streamMessages error:', err)
        setHasLoaded(true)
      },
    )
    return unsubscribe
  }, [chatId])

  // Count-based reconciliation (design §2 M5-T3).
  useEffect(() => {
    if (pendingUser && messages.length > baselineCountRef.current) {
      setPendingUser(null)
    }
  }, [messages, pendingUser])

  // Cancel any in-flight stream on unmount.
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  // Auto-scroll to the bottom on new persisted messages / streaming deltas /
  // state transitions that change what's visible at the tail of the list.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, pendingUser, failedSend, awaitingFirstToken, streamingReply])

  const hasUserMessage = useMemo(() => messages.some((m) => m.role === 'user'), [messages])

  async function runStream(text: string, messageId: string) {
    setResponding(true)
    setAwaitingFirstToken(true)
    setStreamingReply('')

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      await streamChat(chatId, text, chat?.journalId, {
        onDelta: (delta) => {
          setAwaitingFirstToken(false)
          setStreamingReply((prev) => (prev ?? '') + delta)
        },
        signal: controller.signal,
        messageId,
      })
      setResponding(false)
      setAwaitingFirstToken(false)
      setStreamingReply(null)
    } catch (err) {
      // FIX E: an unmount aborts the in-flight fetch, which rejects into this
      // catch — but by then the component is unmounted, so any setState below
      // would warn/no-op against a dead component. Bail out early when the
      // abort was ours (unmount), rather than reconciling into failed-send
      // state that nothing will ever render.
      if (controller.signal.aborted) return
      console.error('[chat] streamChat failed:', err)
      setResponding(false)
      setAwaitingFirstToken(false)
      setStreamingReply(null)
      setPendingUser(null)
      setFailedSend({ text, id: messageId })
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null
    }
  }

  async function handleSend() {
    const text = draft.trim()
    if (!text || responding || failedSend || !chatLoaded) return
    setDraft('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'

    // Stable id so a retry is idempotent once the server honors messageId.
    const messageId = crypto.randomUUID()
    setPendingUser({ text, id: messageId })
    baselineCountRef.current = messages.length

    // One-shot auto-title: only on the very first user message of this chat,
    // and only once per mount. Fire-and-forget — a failure here shouldn't
    // block or retry the send.
    if (!hasUserMessage && !titledRef.current) {
      titledRef.current = true
      updateChatTitle(chatId, deriveChatTitle(text)).catch((err) => {
        console.warn('[chat] auto-title failed:', err)
      })
    }

    await runStream(text, messageId)
  }

  async function handleRetry() {
    if (!failedSend) return
    const text = failedSend.text
    const messageId = failedSend.id
    setFailedSend(null)
    // The user message was already persisted server-side on the first
    // attempt — do NOT re-add the optimistic bubble / re-snapshot baseline.
    // Reusing the SAME messageId (rather than minting a new one) is what
    // makes this retry idempotent once the server honors it.
    await runStream(text, messageId)
  }

  function handleDiscard() {
    setFailedSend(null)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  function handleDraftChange(value: string) {
    setDraft(value)
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = `${Math.min(el.scrollHeight, 160)}px`
    }
  }

  const showGreeting = hasLoaded && messages.length === 0 && !responding && !failedSend
  // FIX C: gated on `chatLoaded` too, so a fast first send always waits for
  // the chat doc's `journalId` to resolve (or fail-resolve) before posting.
  const canSend = draft.trim().length > 0 && !responding && !failedSend && chatLoaded

  if (ownerMismatch) {
    return (
      <EmptyState
        title="This conversation couldn't be opened."
        message="We weren't able to verify this conversation belongs to you."
      />
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-24">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.push('/chats')}
          aria-label="Back to chats"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-70"
          style={{ color: 'var(--text2)' }}
        >
          <ArrowLeft size={20} strokeWidth={1.75} />
        </button>
        <h1 className="serif min-w-0 flex-1 truncate text-lg font-semibold" style={{ color: 'var(--text)' }}>
          {chat?.title || 'New chat'}
        </h1>
      </header>

      {chat?.journalId && chat?.journalTitle && (
        <div
          className="rounded-2xl px-4 py-2.5 font-sans text-xs font-medium"
          style={{ background: 'var(--accentSoft)', color: 'var(--accentDeep)' }}
        >
          Context: {chat.journalTitle}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {!hasLoaded && (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text3)' }} />
          </div>
        )}

        {showGreeting && (
          <div className="flex flex-col items-start">
            <div className="bubble-ai text-[15px] leading-relaxed" style={{ color: 'var(--text)' }}>
              {GREETING_TEXT}
            </div>
          </div>
        )}

        {messages.map((message) =>
          message.role === 'user' ? (
            <div key={message.id} className="bubble-user whitespace-pre-wrap">
              {message.text}
            </div>
          ) : (
            <AssistantBubble key={message.id} message={message} />
          ),
        )}

        {pendingUser && <div className="bubble-user whitespace-pre-wrap">{pendingUser.text}</div>}

        {failedSend && (
          <div
            className="flex flex-col items-end gap-2 rounded-2xl px-4 py-3"
            style={{ background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)' }}
          >
            <p className="font-sans text-xs" style={{ color: 'var(--danger)' }}>
              Couldn&rsquo;t send. Please try again.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleDiscard}
                className="font-sans text-xs font-semibold"
                style={{ color: 'var(--text2)' }}
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => void handleRetry()}
                className="font-sans text-xs font-semibold"
                style={{ color: 'var(--accent)' }}
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {awaitingFirstToken && <TypingIndicator />}

        {!awaitingFirstToken && streamingReply !== null && (
          <div className="flex flex-col items-start">
            <div className="bubble-ai whitespace-pre-wrap text-[15px] leading-relaxed" style={{ color: 'var(--text)' }}>
              {streamingReply}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4 pt-2"
        style={{
          background: 'color-mix(in srgb, var(--bg) 92%, transparent)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          borderTop: '0.5px solid var(--hairline)',
        }}
      >
        <div className="flex w-full max-w-[560px] items-end gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => handleDraftChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What's on your mind?"
            rows={1}
            className="serif max-h-40 flex-1 resize-none rounded-2xl bg-transparent px-4 py-2.5 text-[15px] leading-relaxed outline-none placeholder:not-italic"
            style={{ color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--hairline)' }}
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!canSend}
            aria-label="Send"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            style={{ background: 'var(--accent)' }}
          >
            <Send size={18} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  )
}

function TypingIndicator() {
  const dotStyle = (delay: string): CSSProperties => ({
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--text3)',
    animationDelay: delay,
  })
  return (
    <div className="flex flex-col items-start">
      <div className="bubble-ai flex items-center gap-1.5 px-4 py-3.5">
        <span className="animate-bounce" style={dotStyle('0ms')} />
        <span className="animate-bounce" style={dotStyle('150ms')} />
        <span className="animate-bounce" style={dotStyle('300ms')} />
      </div>
    </div>
  )
}

function AssistantBubble({ message }: { message: ChatMessage }) {
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const sources = message.sources ?? []

  return (
    <div className="flex flex-col items-start gap-1.5">
      <div className="bubble-ai whitespace-pre-wrap text-[15px] leading-relaxed" style={{ color: 'var(--text)' }}>
        {message.text}
      </div>
      {sources.length > 0 && (
        <div className="max-w-[85%]">
          <button
            type="button"
            onClick={() => setSourcesOpen((o) => !o)}
            className="flex items-center gap-1 font-sans text-xs font-semibold transition-opacity hover:opacity-70"
            style={{ color: 'var(--accent)' }}
          >
            Sources
            <ChevronDown
              size={12}
              strokeWidth={2.25}
              style={{ transform: sourcesOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }}
            />
          </button>
          {sourcesOpen && (
            <div className="mt-1.5 flex flex-col gap-2">
              {sources.map((source, i) => (
                <Link key={i} href={`/journal/${source.journalId}`} className="card flex flex-col gap-1 p-3">
                  <p className="serif text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    {source.title || 'Untitled'}
                  </p>
                  {source.snippet && (
                    <p className="line-clamp-2 font-sans text-xs" style={{ color: 'var(--text2)' }}>
                      {source.snippet}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
