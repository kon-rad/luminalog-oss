import { Router, Request, Response } from 'express'
import admin from 'firebase-admin'
import { firebaseAuth, db } from '../middleware/firebaseAuth'
import { requireAiConsent } from '../middleware/requireAiConsent'
import { stageRecording, deleteStaging } from '../services/voiceRecordingStore'
import { PROMPTS } from '../services/prompts'
import type { ProfileFields } from '../services/profileContext'
import { config } from '../config'
import { createSession, getSession, evictByChatId } from '../services/voiceCallSessions'
import { decryptField } from '../crypto/fieldCipher'
import { searchChunks } from '../services/ragStore'
import { chatCompletion, resolveVoiceProvider } from '../services/aiClient'

export const vapiRouter = Router()

// ── call-config ──────────────────────────────────────────────────────────────

export async function callConfigHandler(req: Request, res: Response) {
  const chatId = (req.body?.chatId as string | undefined) ?? ''

  const baseUrl =
    config.NODE_ENV === 'production'
      ? 'https://api.luminalog.com'
      : `http://localhost:${config.PORT}`

  // Zero-knowledge: the client sends its RAG context as PLAINTEXT (built on-device,
  // like the text-chat path). We bake it into the assistant's system prompt here so
  // Vapi carries it into every turn — the server never decrypts mid-call.
  //
  // We inject the per-call personalized prompt via a Vapi TEMPLATE VARIABLE, not a
  // `model` override. The dashboard assistant's system prompt is literally
  // `{{systemPrompt}}`; Vapi substitutes this value at call time. Model + provider +
  // params live entirely on the dashboard (ADR-0077). We must NOT send `model` here:
  // Vapi validates any `assistantOverrides.model` as a COMPLETE model object and rejects
  // the call with `model.provider must be one of…` (a 400 "Call failed") if provider is
  // absent — it does not deep-merge a bare `messages` override. Prompt text stays in
  // prompts.ts.
  const name = (req.body?.name as string | undefined) ?? ''
  const bio = (req.body?.bio as string | undefined) ?? ''
  const profile = (req.body?.profile as ProfileFields | undefined) ?? {}
  const ragContext = (req.body?.ragContext as string | undefined) ?? ''
  const focalEntry = (req.body?.focalEntry as string | undefined) || undefined
  // Today's entries, fetched client-side straight from the local DB (not RAG) so they are
  // always complete and current.
  const todayContext = (req.body?.todayContext as string | undefined) ?? ''
  // Device-local wall clock at call start; anchors the assistant's "today"/"now" against
  // the local timestamps the client stamped onto each entry block.
  const currentDateTime = (req.body?.now as string | undefined) || undefined

  // Base assistant overrides shared by both paths (custom-LLM proxy and legacy
  // baked-prompt). Model routing is layered on below.
  const assistantOverrides: Record<string, unknown> = {
    // chatId lets the end-of-call webhook associate transcript + recording.
    metadata: { chatId },
    // Record the call so we can offer playback on the detail page.
    artifactPlan: { recordingEnabled: true },
    // Deliver the end-of-call report to our webhook (belt-and-suspenders with
    // the dashboard assistant config).
    server: { url: `${baseUrl}/v1/vapi/webhook`, secret: config.VAPI_WEBHOOK_SECRET },
    serverMessages: ['end-of-call-report'],
    // PlayHT/jennifer raised `playht-unknown-error` on the first message and
    // ended the call in ~0s. Vapi's native TTS needs no third-party account.
    voice: { provider: 'vapi', voiceId: 'Elliot' },
    transcriber: { provider: 'deepgram', model: 'nova-2' },
  }

  // Custom-LLM proxy path (ADR-0091): the client passes its DEK so the server can
  // run per-turn RAG over the user's PAST entries on Morpheus. We mint a per-call
  // token, hold the DEK in RAM keyed by it, and route Vapi at our /llm/<token>
  // proxy for the completion. NO `variableValues.systemPrompt` — the proxy builds
  // the system prompt fresh each turn.
  const dekB64 = req.body?.dek as string | undefined
  if (dekB64) {
    const dek = Buffer.from(dekB64, 'base64')
    const token = createSession({
      uid: (req as any).uid,
      chatId,
      dek,
      name,
      bio,
      profile,
      todayContext,
      focalEntry,
      now: currentDateTime,
    })
    assistantOverrides.model = {
      provider: 'custom-llm',
      url: `${baseUrl}/v1/vapi/llm/${token}/chat/completions`,
      model: 'custom',
    }
    res.json({
      publicKey: config.VAPI_PUBLIC_KEY,
      assistantId: config.VAPI_ASSISTANT_ID || undefined,
      assistantOverrides,
    })
    return
  }

  // Legacy back-compat path (no DEK): bake the client-built RAG context into the
  // dashboard prompt's `{{systemPrompt}}` placeholder via a Vapi template variable.
  // We must NOT send `model` here — Vapi validates any `assistantOverrides.model`
  // as a COMPLETE model object (ADR-0077).
  const systemPrompt = PROMPTS.voiceChat(name, bio, profile, ragContext, focalEntry, currentDateTime, todayContext)
  assistantOverrides.variableValues = { systemPrompt }
  res.json({
    publicKey: config.VAPI_PUBLIC_KEY,
    assistantId: config.VAPI_ASSISTANT_ID || undefined,
    assistantOverrides,
  })
}

// Voice calls send name/bio/profile/RAG context to the Anthropic-powered assistant,
// so gate on AI-data-sharing consent like the other /v1/ai routes (defense in depth;
// the client ConsentGate already blocks the UI path until consent is recorded).
vapiRouter.post('/call-config', firebaseAuth, requireAiConsent, callConfigHandler)

// ── custom-LLM proxy (per-turn RAG on Morpheus) ───────────────────────────────

interface OpenAIMessage { role?: string; content?: string }

// Hard ceiling on how long per-turn RAG may add to a voice turn. Vapi ends the
// call with `custom-llm-llm-failed` when a turn is too slow, and the RAG step
// (embed + Chroma + Firestore + decrypt) can spike far past its typical ~1.7s.
// If it doesn't finish in time we proceed with NO memory context rather than let
// a slow turn drop the call — the underlying promise keeps running (fail-soft) but
// no longer blocks the response. ADR-0093.
const RAG_BUDGET_MS = 1500

// Voice-turn fetch budget. The DEFAULT budget in aiClient (3 attempts × 30s) is
// sized for background work and is actively harmful here: against a hung upstream
// it blocks a voice turn for up to 90.75s, so Vapi has long since killed the call
// as `custom-llm-llm-failed`. A voice turn has a hard deadline (~20s at Vapi), so
// bound it well inside that: 2 attempts × 6s + 150ms backoff ≈ 12.15s worst case,
// while still leaving ~3x headroom over the measured 2.06s p100 TTFB. ADR-0109.
const VOICE_FETCH_TIMEOUT_MS = 6_000
const VOICE_FETCH_ATTEMPTS = 2
const VOICE_FETCH_BACKOFF_MS = 150

// Mid-stream idle ceiling. `fetchWithRetry`'s timeout only bounds time-to-HEADERS;
// once the upstream responds it is cleared, so a provider that sends headers and
// then stalls would leave `reader.read()` awaiting forever and the turn would never
// complete. Cut the stream loose after this long with no bytes. ADR-0109.
const VOICE_STREAM_IDLE_MS = 8_000

/** Resolve to `p`, or to `fallback` if `p` hasn't settled within `ms`. */
function withBudget<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([
    p.catch(() => fallback),
    new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms)),
  ])
}

// Conversational filler that carries no retrieval signal. Running the full RAG
// step (embed → Chroma → Firestore → decrypt) for "yeah" spends up to RAG_BUDGET_MS
// of dead air to retrieve nothing useful, on a turn where the user most expects an
// instant reply.
const BACKCHANNEL_WORDS = new Set([
  'yeah', 'yes', 'yep', 'yup', 'no', 'nope', 'ok', 'okay', 'sure', 'right',
  'mhm', 'mm', 'mmhmm', 'uh', 'uhhuh', 'huh', 'oh', 'ah', 'hm', 'hmm', 'um', 'er',
  'thanks', 'thank', 'you', 'cool', 'nice', 'wow', 'true', 'exactly', 'totally',
  'i', 'see', 'got', 'it', 'good', 'great', 'fine', 'well', 'so', 'and',
])

/**
 * True when the user's turn is pure backchannel ("yeah", "mhm", "got it") and so
 * cannot usefully drive semantic retrieval. Deliberately CONSERVATIVE: it only
 * fires on turns of ≤3 words where EVERY word is filler, so a short but real
 * question ("what about mom?", "why though?") still gets full RAG. ADR-0109.
 */
export function isBackchannel(text: string): boolean {
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return true
  if (words.length > 3) return false
  return words.every(w => BACKCHANNEL_WORDS.has(w.replace(/'/g, '')))
}

/**
 * Per-turn semantic RAG over the user's PAST journal entries. Fail-soft: ANY
 * error (embedding, Chroma, Firestore, decryption) returns '' so the call keeps
 * going with no memory context rather than dropping. Dedupes hits by entryId
 * (whole-entry context, ignoring chunkIndex — ADR-0091), enforces tenant
 * isolation (`userId === uid`), and decrypts with the in-RAM DEK.
 */
async function buildPastRagContext(
  uid: string,
  dek: Buffer,
  query: string,
  database = db,
): Promise<string> {
  if (!query.trim()) return ''
  try {
    const topK = (config as any).RAG_TOP_K ?? 6
    const hits = await searchChunks(uid, query, topK)
    // Dedupe entryIds, preserving best-score order (searchChunks returns hits
    // best-first).
    const seen = new Set<string>()
    const entryIds: string[] = []
    for (const h of hits) {
      if (h.entryId && !seen.has(h.entryId)) {
        seen.add(h.entryId)
        entryIds.push(h.entryId)
      }
    }

    const blocks: string[] = []
    for (const entryId of entryIds) {
      try {
        const snap = await database.collection('journals').doc(entryId).get()
        const data = snap.data()
        // Tenant isolation: never surface another user's entry, even on a stray hit.
        if (!data || data.userId !== uid) continue
        const content = data.content ? decryptField(data.content, dek, 'journals.content') : ''
        if (!content.trim()) continue
        let title = ''
        if (data.title) {
          try { title = decryptField(data.title, dek, 'journals.title') } catch { title = '' }
        }
        blocks.push(title.trim() ? `${title.trim()}\n${content.trim()}` : content.trim())
      } catch {
        // Skip an entry we can't fetch/decrypt; keep the rest.
        continue
      }
    }
    return blocks.join('\n\n---\n\n')
  } catch {
    return ''
  }
}

/**
 * DIAGNOSTIC (voice cut-off investigation). Meters the OpenAI SSE stream we relay
 * to Vapi WITHOUT altering or storing it: counts assistant content characters and
 * delta chunks, and captures the terminal `finish_reason`. It never logs or
 * retains the text — only lengths — so it is safe on the zero-knowledge path.
 *
 * Why: our logs previously recorded only raw BYTES relayed, which conflates SSE
 * framing overhead (~200-280 bytes/token) with actual spoken content, and could
 * not distinguish "the model stopped early" (`finish_reason: length`) from "the
 * model finished but the speech was cut".
 */
class SseContentMeter {
  private decoder = new TextDecoder()
  private buf = ''
  chars = 0
  chunks = 0
  finish: string | null = null

  push(bytes: Uint8Array): void {
    this.buf += this.decoder.decode(bytes, { stream: true })
    let idx: number
    while ((idx = this.buf.indexOf('\n')) !== -1) {
      const line = this.buf.slice(0, idx).trim()
      this.buf = this.buf.slice(idx + 1)
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      try {
        const choice = JSON.parse(payload)?.choices?.[0]
        const content = choice?.delta?.content
        if (typeof content === 'string' && content.length > 0) {
          this.chars += content.length
          this.chunks++
        }
        if (choice?.finish_reason) this.finish = String(choice.finish_reason)
      } catch {
        // Keep-alive comment or a payload we don't recognize — metering only.
      }
    }
    // A stream that never emits a newline must not grow the buffer unbounded.
    if (this.buf.length > 64 * 1024) this.buf = ''
  }
}

// One OpenAI-shaped streaming chunk carrying a spoken line, followed by [DONE].
// Used as the graceful fallback when Morpheus is unavailable (no cross-provider
// fallback — strict privacy). Written directly to the SSE response.
function writeGracefulCompletion(res: Response, text: string): void {
  const chunk = {
    id: 'chatcmpl-fallback',
    object: 'chat.completion.chunk',
    choices: [{ index: 0, delta: { content: text }, finish_reason: 'stop' }],
  }
  res.write(`data: ${JSON.stringify(chunk)}\n\n`)
  res.write('data: [DONE]\n\n')
  res.end()
}

/**
 * Vapi custom-LLM endpoint. OpenAI-compatible: Vapi POSTs `{ messages, stream }`
 * each turn and expects a STANDARD OpenAI SSE stream back. UNLIKE chat.ts (which
 * reshapes deltas to `{delta}` for the app), we pass the upstream Morpheus SSE
 * bytes through VERBATIM. No firebaseAuth — the unguessable per-call token is the
 * credential. Fully guarded: no async throw may escape.
 */
export async function llmProxyHandler(req: Request, res: Response, database = db): Promise<void> {
  try {
    const session = getSession(req.params.token)
    if (!session) {
      res.status(401).json({ error: 'invalid or expired call token' })
      return
    }

    const turnStart = Date.now()
    const inbound: OpenAIMessage[] = Array.isArray(req.body?.messages) ? req.body.messages : []
    // The RAG query is the latest user turn.
    const lastUser = [...inbound].reverse().find(m => m?.role === 'user')
    const query = String(lastUser?.content ?? '')

    // DIAGNOSTIC (voice cut-off investigation). Vapi replays the conversation so
    // far on every turn, and the assistant messages it replays are what was
    // actually SPOKEN. So the previous turn's spoken length arrives here, and we
    // can compare it against what we streamed for that turn: a SHORTER echo means
    // the speech was cut mid-turn (barge-in / TTS abort), a matching one means the
    // audio played through and any cut-off lives further downstream (client audio).
    // Lengths only — no content is logged. See the ADR for this investigation.
    const chatTag = session.chatId.slice(0, 8)
    const seq = (session.turnSeq = (session.turnSeq ?? 0) + 1)
    const lastAssistant = [...inbound].reverse().find(m => m?.role === 'assistant')
    const echoedChars = String(lastAssistant?.content ?? '').length
    const prevStreamedChars = session.lastStreamedChars ?? -1
    const cutBy =
      prevStreamedChars > 0 && echoedChars > 0 ? prevStreamedChars - echoedChars : 0
    console.log(
      `[vapi/llm] turn in chat=${chatTag} seq=${seq} msgs=${inbound.length} ` +
        `echoedAsstChars=${echoedChars} prevStreamedChars=${prevStreamedChars}` +
        (cutBy > 0 ? ` SPEECH_CUT_BY=${cutBy}` : ''),
    )

    // Bound the RAG step so a slow embed/Chroma/Firestore turn can't stall the
    // reply past Vapi's custom-LLM timeout (which shows up as an instant "Call
    // ended" on-device). Fail-soft to no context on timeout. ADR-0093.
    // Pure backchannel ("yeah", "mhm") skips retrieval entirely — it can't produce
    // a useful query, so paying up to RAG_BUDGET_MS for it is pure dead air on the
    // turn where the user most expects an instant reply. ADR-0109.
    const skipRag = isBackchannel(query)
    const ragStart = Date.now()
    const ragContext = skipRag
      ? ''
      : await withBudget(
          buildPastRagContext(session.uid, session.dek, query, database),
          RAG_BUDGET_MS,
          '',
        )
    const ragMs = Date.now() - ragStart

    const systemPrompt = PROMPTS.voiceChat(
      session.name,
      session.bio,
      session.profile,
      ragContext,
      session.focalEntry,
      session.now,
      session.todayContext,
    )
    // Keep the user/assistant turns Vapi sends; drop any inbound system message
    // (we own the system prompt).
    const history = inbound
      .filter(m => m?.role === 'user' || m?.role === 'assistant')
      .map(m => ({ role: String(m.role), content: String(m.content ?? '') }))
    const messages = [{ role: 'system', content: systemPrompt }, ...history]

    // Voice is latency-critical and picks its provider independently of the global
    // AI_PROVIDER (ADR-0109): a slow or unavailable model here is a DROPPED CALL.
    const provider = resolveVoiceProvider()
    const llmStart = Date.now()
    let aiRes: Awaited<ReturnType<typeof chatCompletion>>
    try {
      aiRes = await chatCompletion(messages, {
        stream: true,
        provider,
        retry: {
          attempts: VOICE_FETCH_ATTEMPTS,
          timeoutMs: VOICE_FETCH_TIMEOUT_MS,
          baseBackoffMs: VOICE_FETCH_BACKOFF_MS,
        },
      })
    } catch (err) {
      console.error(
        `[vapi/llm] turn FAILED provider=${provider.name} model=${provider.chatModel} ` +
          `ragMs=${ragMs}${skipRag ? '(skipped)' : ''} llmMs=${Date.now() - llmStart} threw`,
        err,
      )
      res.setHeader('Content-Type', 'text/event-stream')
      res.setHeader('Cache-Control', 'no-cache')
      res.setHeader('Connection', 'keep-alive')
      res.flushHeaders()
      writeGracefulCompletion(res, "Sorry, I'm having a moment — could you say that again?")
      return
    }
    const ttfbMs = Date.now() - llmStart

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    // Pre-stream upstream failure → fail-soft, NO cross-provider retry mid-call.
    // Log the BODY, not just the status: a bare "503" hid a total model outage
    // ("capacity is reserved for priority models") for weeks. ADR-0109.
    if (!aiRes.ok || !aiRes.body) {
      const detail = await aiRes.text().catch(() => '<unreadable>')
      console.error(
        `[vapi/llm] turn FAILED provider=${provider.name} model=${provider.chatModel} ` +
          `status=${aiRes.status} ragMs=${ragMs}${skipRag ? '(skipped)' : ''} ttfbMs=${ttfbMs} ` +
          `body=${detail.slice(0, 300)}`,
      )
      writeGracefulCompletion(res, "Sorry, I'm having a moment — could you say that again?")
      return
    }

    // Per-turn latency telemetry. Previously the proxy logged ONLY errors, so there
    // was no way to see turn latency creeping toward Vapi's deadline. ADR-0109.
    console.log(
      `[vapi/llm] turn ok chat=${chatTag} seq=${seq} provider=${provider.name} model=${provider.chatModel} ` +
        `ragMs=${ragMs}${skipRag ? '(skipped)' : ''} ttfbMs=${ttfbMs} preLlmMs=${llmStart - turnStart}`,
    )

    // Pass the upstream OpenAI SSE bytes through verbatim. Vapi's custom-LLM
    // expects the standard `data: {choices:[{delta:{content}}]}` + `[DONE]` shape,
    // which Morpheus already emits — so we do NOT reshape.
    const reader = (aiRes.body as any).getReader()
    const meter = new SseContentMeter()
    let bytes = 0
    try {
      while (true) {
        // Race each read against the idle ceiling. Without this a provider that
        // sends headers then stalls parks this await forever, the response never
        // ends, and the turn hangs until Vapi kills the call. ADR-0109.
        const IDLE = Symbol('idle')
        let idleTimer: NodeJS.Timeout | undefined
        const next = await Promise.race([
          reader.read(),
          new Promise<typeof IDLE>(resolve => {
            idleTimer = setTimeout(() => resolve(IDLE), VOICE_STREAM_IDLE_MS)
          }),
        ]).finally(() => clearTimeout(idleTimer))

        if (next === IDLE) {
          console.error(
            `[vapi/llm] stream idle >${VOICE_STREAM_IDLE_MS}ms — cutting turn loose ` +
              `provider=${provider.name} model=${provider.chatModel} bytes=${bytes}`,
          )
          // Cancel upstream so the socket isn't leaked, then close cleanly. If we
          // never relayed anything, give Vapi a spoken line rather than silence.
          await reader.cancel().catch(() => {})
          session.lastStreamedChars = meter.chars
          if (bytes === 0) writeGracefulCompletion(res, "Sorry, I'm having a moment — could you say that again?")
          else { res.write('data: [DONE]\n\n'); res.end() }
          return
        }

        const { done, value } = next as { done: boolean; value?: Uint8Array }
        if (done) break
        if (value) {
          bytes += value.byteLength
          // Relay VERBATIM first; metering never touches what Vapi receives.
          res.write(Buffer.from(value))
          meter.push(value)
        }
      }
      res.end()
      session.lastStreamedChars = meter.chars
      console.log(
        `[vapi/llm] turn streamed chat=${chatTag} seq=${seq} bytes=${bytes} ` +
          `contentChars=${meter.chars} deltas=${meter.chunks} finish=${meter.finish ?? 'none'} ` +
          `totalMs=${Date.now() - turnStart}`,
      )
    } catch (err) {
      // Mid-stream failure after headers are already sent: end gracefully.
      console.error('[vapi/llm] stream relay failed', err)
      try { res.end() } catch {}
    }
  } catch (err) {
    console.error('[vapi/llm]', err)
    if (res.headersSent) {
      try { res.end() } catch {}
    } else {
      res.status(500).json({ error: 'llm proxy failed' })
    }
  }
}

// No firebaseAuth: the per-call token in the path is the credential (Vapi cannot
// carry a Firebase ID token).
vapiRouter.post('/llm/:token/chat/completions', (req: Request, res: Response) => llmProxyHandler(req, res))

// ── webhook (call-ended transcript + recording persistence) ───────────────────

export interface ParsedWebhook {
  type: string
  chatId: string
  callId: string
  endedReason: string
  rawTranscript: string
  recordingUrl: string
  durationSeconds: number | null
}

// Vapi wraps server messages under `message`; older/manual payloads are flat.
export function parseWebhookMessage(body: any): ParsedWebhook {
  const m = body?.message ?? body ?? {}
  const transcript =
    typeof m.transcript === 'string'
      ? m.transcript
      : typeof m.artifact?.transcript === 'string'
        ? m.artifact.transcript
        : ''

  // Prefer explicit durationSeconds field; fall back to startedAt/endedAt diff.
  let durationSeconds: number | null = null
  if (typeof m.durationSeconds === 'number' && m.durationSeconds > 0) {
    durationSeconds = m.durationSeconds
  } else if (typeof m.call?.startedAt === 'string' && typeof m.call?.endedAt === 'string') {
    const start = Date.parse(m.call.startedAt)
    const end = Date.parse(m.call.endedAt)
    if (!isNaN(start) && !isNaN(end) && end > start) {
      durationSeconds = (end - start) / 1000
    }
  }

  return {
    type: m.type ?? '',
    chatId:
      m.call?.metadata?.chatId ??
      m.call?.assistantOverrides?.metadata?.chatId ??
      m.assistant?.metadata?.chatId ??
      m.metadata?.chatId ??
      '',
    callId: m.call?.id ?? '',
    endedReason: m.endedReason ?? '',
    rawTranscript: transcript,
    // The string URL is at artifact.recordingUrl; artifact.recording is an OBJECT
    // ({ stereoUrl, mono: { combinedUrl, ... } }), so prefer the explicit strings.
    recordingUrl:
      m.recordingUrl ??
      m.artifact?.recordingUrl ??
      m.artifact?.recording?.mono?.combinedUrl ??
      m.artifact?.recording?.stereoUrl ??
      m.stereoRecordingUrl ??
      '',
    durationSeconds,
  }
}

export async function webhookHandler(req: Request, res: Response, database = db): Promise<void> {
  // Vapi auth = a shared secret (NOT an HMAC of the body). The end-of-call-report
  // arrives with no custom headers, so accept ?secret= (always sent verbatim),
  // falling back to the secret headers.
  const provided = (req.query['secret']
    ?? req.headers['x-vapi-secret']
    ?? req.headers['x-vapi-signature']) as string | undefined
  if (provided !== config.VAPI_WEBHOOK_SECRET) {
    res.status(401).json({ error: 'Invalid signature' })
    return
  }

  const parsed = parseWebhookMessage(req.body)
  console.log('[vapi/webhook]', JSON.stringify({
    type: parsed.type, endedReason: parsed.endedReason,
    chatId: parsed.chatId, callId: parsed.callId,
    hasRecording: !!parsed.recordingUrl, transcriptLen: parsed.rawTranscript.length,
  }))

  // Call ended → evict the in-RAM voice-call session so the DEK leaves memory
  // immediately (belt-and-suspenders with the TTL backstop). ADR-0087.
  if (parsed.type === 'end-of-call-report' && parsed.chatId) {
    evictByChatId(parsed.chatId)
  }

  // Zero-knowledge: the client persists the voice TRANSCRIPT itself from live events.
  // For the recording, the server can't encrypt (no DEK), so it only STAGES the
  // plaintext audio promptly (Vapi retains it ~14 days) and records a pointer; the
  // client encrypts + finalizes on next foreground. Best-effort — always ack so Vapi
  // does not retry.
  if (parsed.recordingUrl && parsed.chatId && parsed.callId) {
    try {
      const snap = await database.collection('chats').doc(parsed.chatId).get()
      const uid = snap.data()?.userId as string | undefined
      if (!uid) {
        console.error('[vapi/webhook] no chat/uid for recording', { chatId: parsed.chatId })
      } else {
        const key = await stageRecording(uid, parsed.callId, parsed.recordingUrl)
        if (key) {
          const update: Record<string, unknown> = { pendingRecordingKey: key }
          if (parsed.durationSeconds != null) update.recordingDurationSeconds = parsed.durationSeconds
          await database.collection('chats').doc(parsed.chatId).update(update)
        }
      }
    } catch (err) {
      console.error('[vapi/webhook] recording stage failed', err)
    }
  }

  res.json({ ok: true })
}

vapiRouter.post('/webhook', (req: Request, res: Response) => webhookHandler(req, res))

// ── recording-finalize (client re-uploaded the encrypted recording) ───────────

export async function recordingFinalizeHandler(req: Request, res: Response, database = db): Promise<void> {
  const uid = (req as any).uid as string
  const chatId = (req.body?.chatId as string | undefined) ?? ''
  const recordingPath = (req.body?.recordingPath as string | undefined) ?? ''
  if (!chatId || !recordingPath) { res.status(400).json({ error: 'chatId and recordingPath required' }); return }
  // The client may only point recordingPath at its own namespace.
  if (!recordingPath.startsWith(`users/${uid}/`)) { res.status(403).json({ error: 'forbidden' }); return }

  const ref = database.collection('chats').doc(chatId)
  const snap = await ref.get()
  const data = snap.data()
  if (!data || data.userId !== uid) { res.status(403).json({ error: 'forbidden' }); return }

  const stagingPath = data.pendingRecordingKey as string | undefined
  await ref.update({
    recordingPath,
    pendingRecordingKey: admin.firestore.FieldValue.delete(),
  })
  if (stagingPath) {
    try { await deleteStaging(stagingPath) } catch (err) { console.error('[vapi/recording-finalize] staging delete failed', err) }
  }
  res.json({ ok: true })
}

vapiRouter.post('/recording-finalize', firebaseAuth, (req: Request, res: Response) => recordingFinalizeHandler(req, res))
