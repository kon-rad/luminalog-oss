import { chatCompletion, chatModelChain } from '../aiClient'
import { PROMPTS } from '../prompts'
import type { PeriodType } from '../periodCentroid/periodIndex'
import { chunkDays, MAX_BEATS_PER_CHUNK, type PeriodNarrativeDayInput } from './chunk'

export type { PeriodNarrativeBeatInput, PeriodNarrativeDayInput } from './chunk'

/** One day's beats rendered as "kind [domain]<spine> text" lines under a "Day N:" header. */
function formatDaysForPrompt(days: PeriodNarrativeDayInput[]): string {
  return days
    .map(day => {
      const lines = day.beats
        .map(b => `${b.kind} [${b.domain}]${b.isSpine ? ' <spine>' : ''} ${b.text}`)
        .join('\n')
      return `Day ${day.dayIndex}:\n${lines}`
    })
    .join('\n\n')
}

async function completionText(
  systemPrompt: string,
  userContent: string,
  model: string,
): Promise<string> {
  const res = await chatCompletion(
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userContent }],
    { model },
  )
  if (!res.ok) throw new Error(`AI error: ${res.status}`)
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> }
  return (data.choices[0]?.message?.content ?? '').trim()
}

/** Walk the model chain with one prompt/user-content pair until one model returns text. */
async function completeAcrossChain(
  systemPrompt: string, userContent: string,
): Promise<{ text: string; model: string }> {
  let lastErr: unknown = new Error('Period narrative: empty response')
  for (const model of chatModelChain()) {
    try {
      const text = await completionText(systemPrompt, userContent, model)
      if (text) return { text, model }
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr
}

/** One paragraph from one chunk's beats. */
function synthesizeChunk(
  periodType: PeriodType, chunk: PeriodNarrativeDayInput[],
): Promise<{ text: string; model: string }> {
  return completeAcrossChain(PROMPTS.periodNarrativeSynthesize(periodType), formatDaysForPrompt(chunk))
}

/** The single final paragraph from N partial syntheses. */
function reducePartials(
  periodType: PeriodType, partials: string[],
): Promise<{ text: string; model: string }> {
  const user = partials.map((p, i) => `Partial ${i + 1}:\n${p}`).join('\n\n')
  return completeAcrossChain(PROMPTS.periodNarrativeReduce(periodType), user)
}

/**
 * Build one tier's narrative paragraph, direct from the beats of every entry in the
 * period (never from a lower tier's already-written paragraph, per the design spec).
 * A period that fits in one chunk gets a single direct call. A larger period runs a
 * two-pass map-reduce: one partial-synthesis call per chunk, then one final call over
 * the partials.
 *
 * STATELESS. No DEK, no Firestore read/write. The caller (the device) already
 * decrypted these beats and encrypts the result itself; the server forgets
 * everything it saw the moment it returns.
 */
export async function generatePeriodNarrative(params: {
  periodType: PeriodType
  days: PeriodNarrativeDayInput[]
  maxBeatsPerChunk?: number
}): Promise<{ narrative: string; model: string; generatedAt: string }> {
  const chunks = chunkDays(params.days, params.maxBeatsPerChunk ?? MAX_BEATS_PER_CHUNK)
  if (chunks.length === 0) {
    throw new Error('Period narrative: no beats to synthesize')
  }

  if (chunks.length === 1) {
    const { text, model } = await synthesizeChunk(params.periodType, chunks[0]!)
    return { narrative: text, model, generatedAt: new Date().toISOString() }
  }

  const partials: string[] = []
  for (const chunk of chunks) {
    const { text } = await synthesizeChunk(params.periodType, chunk)
    partials.push(text)
  }
  const { text, model } = await reducePartials(params.periodType, partials)
  return { narrative: text, model, generatedAt: new Date().toISOString() }
}
