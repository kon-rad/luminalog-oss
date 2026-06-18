import { spawn } from 'child_process'
import { mkdtemp, writeFile, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import ffmpegStatic from 'ffmpeg-static'

// Prefer a system ffmpeg when FFMPEG_PATH is set (handy for ops and for local
// runs where the sandboxed static binary can't be spawned); otherwise fall back
// to the binary bundled by ffmpeg-static.
const ffmpegPath = process.env.FFMPEG_PATH || ffmpegStatic

// Extract a compact audio track from a video container before sending it to
// Whisper. Video files are far larger than their audio, and the transcription
// endpoint caps upload size — so we strip the video stream and downsample to
// mono 16 kHz AAC, which is what Whisper wants and a fraction of the size.
//
// ffmpeg-static ships a platform binary (no system install required). We round-
// trip through temp files because MP4/M4A output needs a seekable sink for its
// moov atom; the temp dir is always removed, even on failure.
export async function extractAudio(videoBuffer: Buffer): Promise<Buffer> {
  if (!ffmpegPath) throw new Error('ffmpeg binary unavailable (ffmpeg-static)')

  const dir = await mkdtemp(join(tmpdir(), 'llog-audio-'))
  const inPath = join(dir, 'in')
  const outPath = join(dir, 'out.m4a')
  try {
    await writeFile(inPath, videoBuffer)
    await runFfmpeg([
      '-i', inPath,
      '-vn',            // drop the video stream
      '-ac', '1',       // mono
      '-ar', '16000',   // 16 kHz (Whisper's working rate)
      '-c:a', 'aac',
      '-b:a', '64k',
      '-y', outPath,
    ])
    return await readFile(outPath)
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath as string, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    proc.stderr.on('data', d => { stderr += d.toString() })
    proc.on('error', reject)
    proc.on('close', code => {
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exited ${code}: ${stderr.slice(-500)}`))
    })
  })
}
