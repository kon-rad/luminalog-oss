import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { firebaseAuth } from '../middleware/firebaseAuth'
import { requireAiConsent } from '../middleware/requireAiConsent'
import { chatCompletion, resolveVoiceProvider } from '../services/aiClient'
import { PROMPTS } from '../services/prompts'
import {
  CHALLENGE_PROBES,
  InterviewMarkerParser,
  LIFE_INTERVIEW_SCRIPT,
  SCENE_PROBES,
  findLifeInterviewSection,
} from '../services/lifeInterviewScript'

/**
 * One turn of a LOCAL voice call (on-device speech-to-text and text-to-speech).
 *
 * The phone hears the user, transcribes the utterance on device, builds every
 * piece of context on device (profile, today's entries, memory ladder, focal
 * entry, per-turn RAG over past entries) and posts it here as plaintext. This
 * route builds the voice prompt, streams the reply from the voice provider and
 * persists nothing. It never receives audio and never receives the user's key:
 * unlike `/v1/vapi/call-config`, there is no `dek` field and no server-side
 * decryption.
 *
 * POST /v1/ai/voice-turn
 * Returns: SSE, `data: {"delta":"..."}` chunks then `data: [DONE]`.
 *
 * With an `interview` field the turn belongs to a Life Story Interview sitting:
 * the interviewer prompt replaces the companion prompt, no journal context is
 * used, and the reply's leading tag is stripped and reported as
 * `data: {"interview":{"item":"B3","sectionComplete":false}}`.
 *
 * GET /v1/ai/voice-turn/interview-script returns the sections and questions.
 */

export const voiceTurnRouter = Router()

// Same budget as the Vapi custom-LLM proxy: a slow turn is dead air on a call.
const VOICE_FETCH_TIMEOUT_MS = 6_000
const VOICE_FETCH_ATTEMPTS = 2
const VOICE_FETCH_BACKOFF_MS = 150

const MAX_HISTORY_MESSAGES = 40

const BODY_SCHEMA = z.object({
  chatId: z.string().min(1),
  message: z.string().min(1).max(8_000),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() }))
    .optional()
    .default([]),
  name: z.string().optional().default(''),
  bio: z.string().optional().default(''),
  profile: z.record(z.string(), z.string()).optional().default({}),
  todayContext: z.string().optional().default(''),
  ragContext: z.string().optional().default(''),
  memoryContext: z.string().optional().default(''),
  focalEntry: z.string().optional().default(''),
  now: z.string().optional().default(''),
  interview: z
    .object({
      section: z.string().min(1).max(2),
      item: z.string().max(6).optional(),
      resumed: z.boolean().optional().default(false),
    })
    .optional(),
})

/**
 * Collapses consecutive same-role messages into one. The client can send two
 * user turns in a row (the user kept talking before the reply started), and
 * some providers reject or mishandle non-alternating roles.
 */
export function mergeConsecutiveRoles(
  messages: Array<{ role: string; content: string }>,
): Array<{ role: string; content: string }> {
  const out: Array<{ role: string; content: string }> = []
  for (const m of messages) {
    if (!m.content.trim()) continue
    const last = out[out.length - 1]
    if (last && last.role === m.role) {
      last.content = `${last.content}\n${m.content}`
    } else {
      out.push({ role: m.role, content: m.content })
    }
  }
  return out
}

export async function voiceTurnHandler(req: Request, res: Response): Promise<void> {
  // Guard the whole handler: Express 4 does not forward async rejections.
  try {
    const parsed = BODY_SCHEMA.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid voice turn body' })
      return
    }
    const body = parsed.data

    let systemPrompt: string
    let markerParser: InterviewMarkerParser | null = null
    let validInterviewItems = new Set<string>()
    if (body.interview) {
      const section = findLifeInterviewSection(body.interview.section)
      if (!section) {
        res.status(400).json({ error: 'Unknown interview section' })
        return
      }
      validInterviewItems = new Set(section.items.map((item) => item.key))
      const known = section.items.some((i) => i.key === body.interview!.item)
      systemPrompt = PROMPTS.lifeInterview({
        name: body.name,
        section,
        currentItem: known ? body.interview.item! : section.items[0].key,
        resumed: body.interview.resumed,
        sceneProbes: SCENE_PROBES,
        challengeProbes: CHALLENGE_PROBES,
        currentDateTime: body.now || undefined,
      })
      markerParser = new InterviewMarkerParser()
    } else {
      systemPrompt = PROMPTS.voiceChat(
        body.name,
        body.bio,
        body.profile,
        body.ragContext,
        body.focalEntry || undefined,
        body.now || undefined,
        body.todayContext || undefined,
        body.memoryContext || undefined,
      )
    }
    const turns = mergeConsecutiveRoles([
      ...body.history.slice(-MAX_HISTORY_MESSAGES),
      { role: 'user', content: body.message },
    ])
    const messages = [{ role: 'system', content: systemPrompt }, ...turns]

    const provider = resolveVoiceProvider()
    const started = Date.now()
    const aiRes = await chatCompletion(messages, {
      stream: true,
      provider,
      retry: {
        attempts: VOICE_FETCH_ATTEMPTS,
        timeoutMs: VOICE_FETCH_TIMEOUT_MS,
        baseBackoffMs: VOICE_FETCH_BACKOFF_MS,
      },
    })
    if (!aiRes.ok || !aiRes.body) {
      const detail = await aiRes.text().catch(() => '<unreadable>')
      console.error(
        `[voice-turn] upstream FAILED provider=${provider.name} model=${provider.chatModel} ` +
          `status=${aiRes.status} body=${detail.slice(0, 300)}`,
      )
      res.status(502).json({ error: 'Voice model unavailable' })
      return
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    // SSE lines can split across read() chunks: buffer until a full line arrives.
    const decoder = new TextDecoder()
    const reader = (aiRes.body as any).getReader()
    let lineBuffer = ''
    let firstTokenMs = -1
    let chars = 0

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      lineBuffer += decoder.decode(value as Uint8Array, { stream: true })
      const lines = lineBuffer.split('\n')
      lineBuffer = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const payload = line.slice(6).trim()
        if (payload === '[DONE]') continue
        try {
          const chunk = JSON.parse(payload) as { choices?: Array<{ delta?: { content?: string } }> }
          const raw = chunk.choices?.[0]?.delta?.content ?? ''
          if (!raw) continue
          if (firstTokenMs < 0) firstTokenMs = Date.now() - started
          let delta = raw
          if (markerParser) {
            const parsed = markerParser.feed(raw)
            if (parsed.marker && (parsed.marker.sectionComplete ||
                (parsed.marker.item !== null && validInterviewItems.has(parsed.marker.item)))) {
              res.write(`data: ${JSON.stringify({ interview: parsed.marker })}\n\n`)
            }
            delta = parsed.text
          }
          if (delta) {
            chars += delta.length
            res.write(`data: ${JSON.stringify({ delta })}\n\n`)
          }
        } catch {}
      }
    }
    // A reply that ended while a possible tag was still being held back.
    const held = markerParser?.flush() ?? ''
    if (held) {
      chars += held.length
      res.write(`data: ${JSON.stringify({ delta: held })}\n\n`)
    }

    // Lengths and timings only: no transcript or journal content is logged.
    console.log(
      `[voice-turn] ok chat=${body.chatId.slice(0, 8)} provider=${provider.name} model=${provider.chatModel} ` +
        `firstTokenMs=${firstTokenMs} totalMs=${Date.now() - started} chars=${chars} ` +
        `history=${body.history.length} ragChars=${body.ragContext.length}` +
        (body.interview ? ` interview=${body.interview.section}` : ''),
    )
    res.write('data: [DONE]\n\n')
    res.end()
  } catch (err) {
    console.error('[voice-turn]', err)
    if (res.headersSent) {
      res.write(`data: ${JSON.stringify({ error: 'Stream failed' })}\n\n`)
      res.end()
    } else {
      res.status(500).json({ error: 'Voice turn failed' })
    }
  }
}

voiceTurnRouter.post('/', firebaseAuth, requireAiConsent, voiceTurnHandler)

/** The interview's sections and questions. Static, no user data. */
voiceTurnRouter.get('/interview-script', firebaseAuth, (_req: Request, res: Response) => {
  res.json(LIFE_INTERVIEW_SCRIPT)
})
