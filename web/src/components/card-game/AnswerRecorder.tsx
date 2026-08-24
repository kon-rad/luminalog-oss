'use client'

import { useState } from 'react'
import { Loader2, Mic, Square } from 'lucide-react'
import styles from './cardGame.module.css'
import { useAuth } from '@/lib/auth-context'
import { formatElapsed, useCardRecorder } from '@/lib/card-game/recorder'
import { requestUploadUrl, submitAnswer, uploadAnswerAudio } from '@/lib/card-game/client'
import type { Card } from '@/lib/card-game/deck'

type Phase = 'idle' | 'saving' | 'failed'

/* Record one answer to the card currently face up.
 *
 * The recorded blob is held until the save actually succeeds: an upload
 * failure turns the button into Retry rather than throwing the recording away,
 * because a person has just said something out loud that they cannot repeat
 * the same way twice.
 */
export default function AnswerRecorder({
  code,
  card,
  cardIndex,
  onSaved,
}: {
  code: string
  card: Card
  cardIndex: number
  onSaved: () => void
}) {
  const { user, signInWithGoogle, signInWithApple } = useAuth()
  const recorder = useCardRecorder()
  const [phase, setPhase] = useState<Phase>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  const save = async () => {
    if (!recorder.blob) return
    setPhase('saving')
    setSaveError(null)
    try {
      const { answerId, s3Key, uploadUrl } = await requestUploadUrl(code, recorder.ext, recorder.mimeType)
      await uploadAnswerAudio(uploadUrl, recorder.blob, recorder.mimeType)
      await submitAnswer(code, {
        answerId,
        s3Key,
        cardId: card.id,
        cardIndex,
        prompt: card.prompt,
        direction: card.direction,
        durationMs: recorder.elapsedMs,
        mimeType: recorder.mimeType,
      })
      recorder.reset()
      setPhase('idle')
      onSaved()
    } catch (err) {
      console.error('[card-game] saving the answer failed', err)
      setSaveError('That did not save. Your recording is still here, try again.')
      setPhase('failed')
    }
  }

  // Signed out: the table can still play, but recording needs a name to
  // attribute the answer to.
  if (!user) {
    return (
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 14.5, color: 'rgba(243,238,228,0.62)', marginBottom: 12 }}>
          Sign in to record your answer. Everyone can keep turning cards without one.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => signInWithApple()} style={darkButton}>
            Sign in with Apple
          </button>
          <button onClick={() => signInWithGoogle()} style={darkButton}>
            Continue with Google
          </button>
        </div>
      </div>
    )
  }

  const { state, elapsedMs, error, blob } = recorder

  return (
    <div style={{ textAlign: 'center' }}>
      {state === 'recording' ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          <span className={styles.recDot} aria-hidden />
          <span
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 22,
              fontWeight: 600,
              color: '#F3EEE4',
              minWidth: 66,
            }}
          >
            {formatElapsed(elapsedMs)}
          </span>
          <button onClick={recorder.stop} style={{ ...goldButton, gap: 8 }}>
            <Square size={15} fill="currentColor" />
            Stop
          </button>
        </div>
      ) : blob ? (
        <div>
          <audio
            controls
            src={URL.createObjectURL(blob)}
            style={{ width: 'min(420px, 88vw)', marginBottom: 14 }}
          />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={save} disabled={phase === 'saving'} style={{ ...goldButton, gap: 8 }}>
              {phase === 'saving' ? <Loader2 size={15} className="animate-spin" /> : null}
              {phase === 'saving' ? 'Saving and transcribing…' : phase === 'failed' ? 'Try again' : 'Save this answer'}
            </button>
            <button onClick={recorder.reset} disabled={phase === 'saving'} style={darkButton}>
              Record again
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={recorder.start}
          disabled={state === 'requesting'}
          style={{ ...goldButton, gap: 9, fontSize: 16, padding: '13px 26px' }}
        >
          <Mic size={17} />
          {state === 'requesting' ? 'Opening the microphone…' : 'Record your answer'}
        </button>
      )}

      {(error || saveError) && (
        <p style={{ marginTop: 12, fontSize: 13.5, lineHeight: 1.5, color: '#F0655C', maxWidth: 460, marginInline: 'auto' }}>
          {error ?? saveError}
        </p>
      )}
    </div>
  )
}

const goldButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '11px 22px',
  borderRadius: 14,
  border: '1px solid rgba(242,203,76,0.45)',
  background: 'linear-gradient(180deg, #F2CB4C, #D9A72E)',
  color: '#16130E',
  fontSize: 15,
  fontWeight: 700,
}

const darkButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '11px 20px',
  borderRadius: 14,
  border: '1px solid rgba(255,240,220,0.18)',
  background: 'rgba(255,240,220,0.05)',
  color: '#F3EEE4',
  fontSize: 14.5,
  fontWeight: 600,
}
