'use client'

import { useEffect, useState } from 'react'
import { fetchPlaybackUrls } from '@/lib/card-game/client'
import { formatElapsed } from '@/lib/card-game/recorder'
import type { Answer } from '@/lib/card-game/room'

/* The answers recorded for one card: who said it, the audio, the transcript.
 *
 * Playback URLs are signed and short-lived, so they are fetched for whatever
 * is on screen rather than stored. A failure there costs the audio players,
 * not the attribution or the transcripts, which is why the list renders
 * regardless of what comes back.
 */
export default function AnswerList({ answers }: { answers: Answer[] }) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const keys = answers.map((a) => a.s3Key).join(',')

  useEffect(() => {
    let cancelled = false
    const s3Keys = keys ? keys.split(',') : []
    if (s3Keys.length === 0) {
      setUrls({})
      return
    }
    fetchPlaybackUrls(s3Keys).then((map) => {
      if (!cancelled) setUrls(map)
    })
    return () => {
      cancelled = true
    }
  }, [keys])

  if (answers.length === 0) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {answers.map((answer) => (
        <article
          key={answer.id}
          style={{
            padding: '18px 20px 20px',
            borderRadius: 18,
            background: 'rgba(255,240,220,0.04)',
            border: '1px solid rgba(255,240,220,0.09)',
          }}
        >
          <header style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            {answer.photoURL ? (
              // A remote avatar from an arbitrary identity provider, so a plain
              // img rather than next/image (no domain allowlist to maintain).
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={answer.photoURL}
                alt=""
                width={30}
                height={30}
                style={{ borderRadius: '50%', flexShrink: 0 }}
              />
            ) : (
              <span
                aria-hidden
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  background: 'rgba(242,203,76,0.16)',
                  color: '#F2CB4C',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {answer.name?.[0] ?? '?'}
              </span>
            )}
            <span style={{ fontSize: 14.5, fontWeight: 600, color: '#F3EEE4' }}>{answer.name}</span>
            {answer.durationMs > 0 && (
              <span style={{ fontSize: 12.5, color: 'rgba(243,238,228,0.42)' }}>
                {formatElapsed(answer.durationMs)}
              </span>
            )}
          </header>

          {urls[answer.s3Key] && (
            <audio controls src={urls[answer.s3Key]} style={{ width: '100%', marginTop: 13 }} />
          )}

          <p
            style={{
              marginTop: 13,
              fontSize: 15.5,
              lineHeight: 1.62,
              color: answer.transcriptStatus === 'ready' ? 'rgba(243,238,228,0.86)' : 'rgba(243,238,228,0.4)',
              fontStyle: answer.transcriptStatus === 'ready' ? 'normal' : 'italic',
            }}
          >
            {answer.transcriptStatus === 'ready' && answer.transcript
              ? answer.transcript
              : 'Transcript unavailable. The recording is still here.'}
          </p>
        </article>
      ))}
    </div>
  )
}
