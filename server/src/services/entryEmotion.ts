// Score a finalized entry with Hume and write `journals/{id}.emotion`.
// Best-effort + idempotent: never throws into the caller; skips if already scored.
import { db } from '../middleware/firebaseAuth'
import { scoreText, scoreAudio, topN, type RawEmotions } from './humeService'

export interface ScoreEntryArgs {
  uid: string
  journalId: string
  content: string
  data: Record<string, any>
  dek: Buffer
  /** Returns the decrypted audio bytes for this entry (video already de-muxed). */
  downloadAudio: () => Promise<Buffer | null>
  force?: boolean
}

function mergeScores(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = out[k] == null ? v : (out[k] + v) / 2
  return out
}

export async function scoreEntryEmotion(args: ScoreEntryArgs): Promise<void> {
  try {
    if (args.data?.emotion && !args.force) return

    const text: RawEmotions | null = await scoreText(args.content)

    const media: Array<{ kind?: string }> = args.data?.media ?? []
    const hasAudio = media.some(m => m.kind === 'audio' || m.kind === 'video')
    let audio: RawEmotions | null = null
    if (hasAudio) {
      const buf = await args.downloadAudio()
      if (buf) audio = await scoreAudio(buf)
    }

    if (!text && !audio) return

    const scores = text && audio ? mergeScores(text.scores, audio.scores)
      : (text?.scores ?? audio!.scores)
    const source = text && audio ? 'text+audio' : text ? 'text' : 'audio'

    await db.collection('journals').doc(args.journalId).update({
      emotion: {
        source,
        scores,
        top: topN(scores, 10),
        model: 'hume:expression-measurement',
        scoredAt: new Date().toISOString(),
      },
    })
  } catch (err) {
    console.error('[entryEmotion] scoring failed (entry kept)', err)
  }
}
