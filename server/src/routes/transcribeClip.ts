import { Request, Response } from 'express'
import { transcribeAudio } from '../services/aiClient'

// Stateless clip transcription: raw audio in (via express.raw), { text } out.
// No S3 read, no Firestore write — the clip is transcribed in memory and
// discarded. The audio is persisted to S3 only when the client saves the entry.
export async function transcribeClipHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as Buffer | undefined
  if (!body || body.length === 0) {
    res.status(400).json({ error: 'Empty audio body' })
    return
  }
  try {
    const text = await transcribeAudio(body, 'clip.m4a')
    res.json({ text })
  } catch (err) {
    console.error('[ai/transcribe-clip]', err)
    res.status(500).json({ error: 'Transcription failed' })
  }
}
