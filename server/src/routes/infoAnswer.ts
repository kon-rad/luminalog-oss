import { Router, Request, Response } from 'express'
import { z } from 'zod'
import { chatCompletion } from '../services/aiClient'
import { firebaseAuth } from '../middleware/firebaseAuth'
import { requireAiConsent } from '../middleware/requireAiConsent'
import { PROMPTS, NO_ANSWER, infoAnswerUserMessage } from '../services/prompts'

/**
 * Stateless route that drafts answers to questions from outside agents.
 * The client provides the full context (journal excerpts, sender info, etc.)
 * because the route has no access to the user's journal data.
 *
 * POST /v1/ai/info-answer
 * Body: { name?, bio?, profile?, sender: { name, description }, reason, items: [{ question, journalContext }] }
 * Returns: { answers: string[] }
 */

const ITEM_SCHEMA = z.object({
  question: z.string().min(1),
  journalContext: z.string().default(''),
})

const BODY_SCHEMA = z.object({
  name: z.string().optional().default(''),
  bio: z.string().optional().default(''),
  profile: z.record(z.string(), z.string()).optional().default({}),
  sender: z.object({
    name: z.string().min(1, 'sender name is required'),
    description: z.string().min(1, 'sender description is required'),
  }),
  reason: z.string().min(1, 'reason is required'),
  items: z.array(ITEM_SCHEMA).min(1, 'at least one item is required').max(10, 'at most 10 items allowed'),
})

/**
 * Run async functions with bounded concurrency.
 */
async function mapLimit<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    const batchResults = await Promise.all(batch.map(fn))
    results.push(...batchResults)
  }
  return results
}

async function infoAnswerHandler(req: Request, res: Response): Promise<void> {
  try {
    const parsed = BODY_SCHEMA.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ error: 'invalid_body', detail: parsed.error.issues })
      return
    }

    const { name, bio, profile, sender, reason, items } = parsed.data
    const systemPrompt = PROMPTS.infoAnswerSystem(name, bio, profile as any)

    const answers = await mapLimit(items, 3, async (item) => {
      const userMessage = infoAnswerUserMessage({
        senderName: sender.name,
        senderDescription: sender.description,
        reason,
        question: item.question,
        journalContext: item.journalContext,
      })

      const result = await chatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ])

      if (!result.ok) {
        throw new Error(`chatCompletion returned status ${result.status}`)
      }

      const json = await result.json()
      const data = json as { choices: Array<{ message: { content: string } }> }
      const content = data?.choices?.[0]?.message?.content ?? NO_ANSWER
      return content.trim()
    })

    res.json({ answers })
  } catch (err) {
    console.error('[infoAnswer]', err instanceof Error ? err.message : 'error')
    res.status(500).json({ error: 'answer_drafting_failed' })
  }
}

export const infoAnswerRouter = Router()
infoAnswerRouter.post('/', firebaseAuth, requireAiConsent, infoAnswerHandler)