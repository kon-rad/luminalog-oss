import { Request, Response } from 'express'
import { transcribeAudio, transcribeWithDeepgram } from '../services/aiClient'
import { deepgramEnabled } from '../config'

// Stateless clip transcription for voice/video JOURNAL ENTRIES: raw audio in
// (via express.raw), { text } out. No S3 read, no Firestore write — the clip is
// transcribed in memory and discarded. Uses Deepgram when configured (higher
// accuracy on real recordings), falling back to Together Whisper on error or
// when no Deepgram key is set. (Text-field dictation is separate and on-device.)
export async function transcribeClipHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as Buffer | undefined
  if (!body || body.length === 0) {
    res.status(400).json({ error: 'Empty audio body' })
    return
  }
  const contentType = (req.headers?.['content-type'] as string | undefined) || 'audio/m4a'
  try {
    let text: string
    if (deepgramEnabled()) {
      try {
        text = await transcribeWithDeepgram(body, contentType)
      } catch (dgErr) {
        console.error('[ai/transcribe-clip] Deepgram failed — falling back to Whisper:', dgErr)
        text = await transcribeAudio(body, 'clip.m4a')
      }
    } else {
      text = await transcribeAudio(body, 'clip.m4a')
    }
    res.json({ text })
  } catch (err) {
    console.error('[ai/transcribe-clip]', err)
    res.status(500).json({ error: 'Transcription failed' })
  }
}
