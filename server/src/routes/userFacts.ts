import { Request, Response } from 'express'
import { chatCompletion, activeChatModel } from '../services/aiClient'
import { PROMPTS } from '../services/prompts'
import {
  parseUserFactsRequest, buildEntriesBlock, buildKnownFactsBlock, buildRejectedBlock, parseUserFactOps,
} from '../services/userFacts'

async function complete(systemPrompt: string): Promise<string> {
  const res = await chatCompletion(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Return the operations now as strict JSON.' },
    ],
    { response_format: { type: 'json_object' } },
  )
  if (!res.ok) throw new Error(`AI error: ${res.status}`)
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> }
  return data.choices[0]?.message?.content ?? ''
}

/**
 * "What Argo knows": turns a batch of plaintext entries plus the user's known facts
 * into validated operations (add, update, confirm, invalidate).
 * Spec: docs/superpowers/specs/2026-09-28-user-facts-design.md (workspace root).
 *
 * Zero-knowledge: the client sends the batch as PLAINTEXT and owns decisions,
 * encryption and storage. No DEK, no Firestore read or write, and the request body
 * is never logged. Synchronous: input is bounded, so it is one model call. No
 * fallback on failure: a made-up fact stored as memory is worse than none.
 */
export async function userFactsHandler(req: Request, res: Response): Promise<void> {
  const parsed = parseUserFactsRequest(req.body)
  if ('error' in parsed) {
    res.status(400).json({ error: parsed.error }); return
  }
  try {
    const systemPrompt = PROMPTS.userFacts({
      entriesBlock: buildEntriesBlock(parsed.entries),
      knownFactsBlock: buildKnownFactsBlock(parsed.facts),
      rejectedBlock: buildRejectedBlock(parsed.rejected),
    })
    const ctx = {
      entryIds: new Set(parsed.entries.map(e => e.id)),
      refs: new Set(parsed.facts.map(f => f.ref)),
    }
    let ops = parseUserFactOps(await complete(systemPrompt), ctx)
    if (!ops) ops = parseUserFactOps(await complete(systemPrompt), ctx)
    if (!ops) {
      res.status(502).json({ error: 'User facts extraction failed' }); return
    }
    res.json({ ops, model: activeChatModel() })
  } catch (err: any) {
    // Message only: never the request, which is the user's journal in plaintext.
    console.error('[ai/user-facts]', err?.message ?? 'unknown error')
    res.status(502).json({ error: 'User facts extraction failed' })
  }
}
