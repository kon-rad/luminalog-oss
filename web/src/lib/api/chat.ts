import { auth } from '@/lib/firebase'

// SSE client for the M5 streaming chat route (design §1/§2 M5-T1). Unlike
// `apiPost`/`apiPostRaw` (JSON-only), this reads a `text/event-stream` body
// token-by-token via the Streams API, so it's a bespoke fetch rather than a
// reuse of the JSON client. Same auth story: Bearer ID token, force-refresh +
// retry once on a 401. The chat doc must already exist server-side — the
// server never creates it, only persists messages + streams deltas into it.

export interface StreamChatOptions {
  onDelta: (delta: string) => void
  signal?: AbortSignal
  // Stable client-generated id for the logical user message (design §2 M5
  // FIX A): a retry of a failed send reuses the SAME id as the original
  // attempt, so the (soon-to-be-updated) server can use it as an idempotency
  // key and avoid persisting a duplicate user message on retry.
  messageId?: string
}

async function getIdToken(forceRefresh: boolean): Promise<string> {
  const user = auth.currentUser
  if (!user) throw new Error('streamChat: no signed-in user')
  return user.getIdToken(forceRefresh)
}

function doPost(
  token: string,
  chatId: string,
  message: string,
  journalId: string | undefined,
  messageId: string | undefined,
  signal: AbortSignal | undefined,
): Promise<Response> {
  return fetch('/api/ai/chat', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      accept: 'text/event-stream',
    },
    body: JSON.stringify({
      chatId,
      message,
      ...(messageId ? { messageId } : {}),
      ...(journalId ? { journalId } : {}),
    }),
    signal,
  })
}

// Sentinel wrapper so a real in-band `{"error":"..."}` frame propagates as a
// thrown Error, while any other parse/callback failure falls through to the
// non-JSON-fallback path below (never silently swallowed, never mistaken for
// a delta).
class StreamError extends Error {}

/** Returns `true` once the `[DONE]` sentinel is seen (caller should stop reading). */
function handleLine(line: string, onDelta: (delta: string) => void): boolean {
  if (!line.startsWith('data: ') && !line.startsWith('data:')) return false
  const payload = (line.startsWith('data: ') ? line.slice(6) : line.slice(5)).trim()
  if (!payload) return false
  if (payload === '[DONE]') return true

  try {
    const parsed: unknown = JSON.parse(payload)
    if (parsed && typeof parsed === 'object') {
      const j = parsed as { delta?: unknown; error?: unknown }
      if (typeof j.error === 'string') throw new StreamError(j.error)
      if (typeof j.delta === 'string' && j.delta) onDelta(j.delta)
      return false
    }
    // Valid JSON but not an object (e.g. a bare number/string) — treat the
    // raw payload as a delta, same as the non-JSON fallback below.
    onDelta(payload)
    return false
  } catch (e) {
    if (e instanceof StreamError) throw e
    // Not valid JSON at all — tolerate it as a raw delta chunk.
    onDelta(payload)
    return false
  }
}

/**
 * POST a user message to the streaming `/api/ai/chat` forwarder and invoke
 * `onDelta` for each token as it arrives. The chat doc (`chatId`) must already
 * exist. Resolves once the server sends `[DONE]` or the stream ends; rejects
 * on a non-2xx response (after one 401 retry) or an in-band `{"error":...}`
 * frame. Pass `signal` to cancel the underlying fetch/read on unmount.
 */
export async function streamChat(
  chatId: string,
  message: string,
  journalId: string | undefined,
  opts: StreamChatOptions,
): Promise<void> {
  const { onDelta, signal, messageId } = opts

  let token = await getIdToken(false)
  let res = await doPost(token, chatId, message, journalId, messageId, signal)

  if (res.status === 401) {
    token = await getIdToken(true)
    res = await doPost(token, chatId, message, journalId, messageId, signal)
  }

  if (!res.ok) throw new Error(`chat ${res.status}`)
  if (!res.body) return

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })

      const lines = buf.split('\n')
      buf = lines.pop() ?? ''

      for (const rawLine of lines) {
        const line = rawLine.endsWith('\r') ? rawLine.slice(0, -1) : rawLine
        if (line.trim() === '') continue
        if (handleLine(line, onDelta)) return
      }
    }
  } finally {
    reader.releaseLock()
  }
}
