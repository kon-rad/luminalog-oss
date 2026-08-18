'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** Three minutes. Long enough for a real story, short enough that the table
 *  keeps moving and the transcription stays quick. */
export const MAX_RECORDING_MS = 180000

/** Ordered by preference. Safari (and every browser on iOS, which is most of a
 *  table at a live event) has no webm recorder, so mp4 is the common fallback
 *  rather than an edge case. */
const CANDIDATES: { mimeType: string; ext: string }[] = [
  { mimeType: 'audio/webm;codecs=opus', ext: 'webm' },
  { mimeType: 'audio/webm', ext: 'webm' },
  { mimeType: 'audio/mp4', ext: 'm4a' },
  { mimeType: 'audio/mpeg', ext: 'mp3' },
]

/** An empty mimeType is a valid answer: it tells MediaRecorder to pick for
 *  itself, which beats throwing at a table mid-game. */
export function pickMimeType(
  isTypeSupported?: (type: string) => boolean,
): { mimeType: string; ext: string } {
  if (!isTypeSupported) return { mimeType: '', ext: 'webm' }
  return CANDIDATES.find((c) => isTypeSupported(c.mimeType)) ?? { mimeType: '', ext: 'webm' }
}

export function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'recorded'

export interface CardRecorder {
  state: RecorderState
  elapsedMs: number
  error: string | null
  blob: Blob | null
  mimeType: string
  ext: string
  start: () => Promise<void>
  stop: () => void
  reset: () => void
}

/** Microphone capture for one answer. Owns the MediaRecorder, the elapsed
 *  timer, the three-minute cap, and track cleanup. */
export function useCardRecorder(): CardRecorder {
  const [state, setState] = useState<RecorderState>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [format, setFormat] = useState({ mimeType: '', ext: 'webm' })

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null)

  /** Always release the microphone. A live track leaves the browser's
   *  recording indicator on and holds the device against other tabs. */
  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (tickRef.current) {
      clearInterval(tickRef.current)
      tickRef.current = null
    }
  }, [])

  useEffect(() => releaseStream, [releaseStream])

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
  }, [])

  const start = useCallback(async () => {
    setError(null)
    setBlob(null)
    setElapsedMs(0)
    setState('requesting')

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const picked = pickMimeType(
        typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported
          ? (t: string) => MediaRecorder.isTypeSupported(t)
          : undefined,
      )
      setFormat(picked)

      const recorder = new MediaRecorder(
        stream,
        picked.mimeType ? { mimeType: picked.mimeType } : undefined,
      )
      recorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const type = picked.mimeType || recorder.mimeType || 'audio/webm'
        setBlob(new Blob(chunksRef.current, { type }))
        setState('recorded')
        releaseStream()
      }
      recorder.onerror = () => {
        setError('Recording stopped unexpectedly. Please try again.')
        setState('idle')
        releaseStream()
      }

      recorder.start()
      setState('recording')

      const startedAt = Date.now()
      tickRef.current = setInterval(() => {
        const elapsed = Date.now() - startedAt
        setElapsedMs(elapsed)
        if (elapsed >= MAX_RECORDING_MS) stop()
      }, 200)
    } catch (err) {
      releaseStream()
      setState('idle')
      const name = (err as { name?: string })?.name
      setError(
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'Argo needs microphone access to record your answer. Allow it in your browser settings, then try again.'
          : 'No microphone was available. Check that another app is not using it.',
      )
    }
  }, [releaseStream, stop])

  const reset = useCallback(() => {
    releaseStream()
    recorderRef.current = null
    chunksRef.current = []
    setBlob(null)
    setElapsedMs(0)
    setError(null)
    setState('idle')
  }, [releaseStream])

  return {
    state,
    elapsedMs,
    error,
    blob,
    mimeType: format.mimeType || 'audio/webm',
    ext: format.ext,
    start,
    stop,
    reset,
  }
}
