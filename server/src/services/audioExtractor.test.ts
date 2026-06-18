import { describe, it, expect, beforeAll } from 'vitest'
import { spawn } from 'child_process'
import ffmpegStatic from 'ffmpeg-static'
import { extractAudio } from './audioExtractor'

const ffmpegPath = process.env.FFMPEG_PATH || ffmpegStatic

// Build a real (tiny) video with both a video and audio stream so we can prove
// extractAudio() drops the video and shrinks the payload sent to Whisper.
async function makeTestVideo(): Promise<Buffer> {
  const { mkdtemp, readFile, rm } = await import('fs/promises')
  const { tmpdir } = await import('os')
  const { join } = await import('path')
  const dir = await mkdtemp(join(tmpdir(), 'llog-test-vid-'))
  const out = join(dir, 'in.mp4')
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegPath as string, [
      '-f', 'lavfi', '-i', 'testsrc=duration=2:size=640x480:rate=30',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
      '-c:v', 'libx264', '-c:a', 'aac', '-shortest', '-y', out,
    ], { stdio: ['ignore', 'ignore', 'pipe'] })
    let err = ''
    proc.stderr.on('data', d => { err += d.toString() })
    proc.on('error', reject)
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(err.slice(-400))))
  })
  const buf = await readFile(out)
  await rm(dir, { recursive: true, force: true }).catch(() => {})
  return buf
}

describe('extractAudio', () => {
  let video: Buffer
  beforeAll(async () => { video = await makeTestVideo() }, 30_000)

  it('produces a non-empty audio buffer much smaller than the source video', async () => {
    const audio = await extractAudio(video)
    expect(audio.length).toBeGreaterThan(0)
    expect(audio.length).toBeLessThan(video.length)
  })

  it('returns a valid MP4/M4A container (ftyp box present)', async () => {
    const audio = await extractAudio(video)
    // ISO-BMFF files carry an 'ftyp' box marker in the first bytes.
    expect(audio.subarray(0, 12).toString('latin1')).toContain('ftyp')
  })

  it('rejects when the input is not decodable media', async () => {
    await expect(extractAudio(Buffer.from('not a video'))).rejects.toThrow()
  })
})
