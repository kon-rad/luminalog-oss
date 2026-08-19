'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

// Recovery-code entry. The only door a browser has into the zero-knowledge key
// store: the other wrap slot is an iCloud Keychain key that no browser can
// reach. A wrong code fails on the AES-GCM tag, so there is nothing to
// distinguish and nothing to rate limit; the user simply tries again.

export default function RecoveryCodeUnlock({
  failedAttempt,
  onSubmit,
}: {
  failedAttempt: boolean
  onSubmit: (code: string, remember: boolean) => Promise<void>
}) {
  const [code, setCode] = useState('')
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)

  const canSubmit = code.trim().length > 0 && !busy

  const handleSubmit = async () => {
    if (!canSubmit) return
    setBusy(true)
    try {
      await onSubmit(code, remember)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-md">
        <h1 className="serif mb-3 text-2xl font-semibold" style={{ color: 'var(--text)' }}>
          Unlock your journal
        </h1>
        <p className="mb-6 font-sans text-sm leading-relaxed" style={{ color: 'var(--text2)' }}>
          Your entries are encrypted with a key only you hold, so we cannot unlock them for you.
          Enter the recovery code you saved when you set up Argo.
        </p>

        <label
          htmlFor="recovery-code"
          className="mb-2 block font-sans text-xs font-medium"
          style={{ color: 'var(--text3)' }}
        >
          Recovery code
        </label>
        <textarea
          id="recovery-code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          rows={3}
          autoFocus
          spellCheck={false}
          autoCapitalize="characters"
          autoCorrect="off"
          placeholder="XXXX-XXXX-XXXX-..."
          className="w-full resize-none rounded-btn p-3 font-mono text-sm tracking-wide outline-none"
          style={{
            background: 'var(--surfaceAlt)',
            color: 'var(--text)',
            border: `1px solid ${failedAttempt ? 'var(--danger)' : 'var(--hairline2)'}`,
          }}
        />

        {failedAttempt && (
          <p className="mt-2 font-sans text-sm" style={{ color: 'var(--danger)' }}>
            That code did not unlock your journal. Check for a missing or extra character and try
            again.
          </p>
        )}

        <label
          className="mt-4 flex items-center gap-2 font-sans text-sm"
          style={{ color: 'var(--text2)' }}
        >
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            style={{ accentColor: 'var(--accent)' }}
          />
          Remember this browser
        </label>
        <p className="mt-1 font-sans text-xs leading-relaxed" style={{ color: 'var(--text3)' }}>
          Keeps your key on this device so you will not need the code again here. Leave it off on a
          shared computer.
        </p>

        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={!canSubmit}
          className="btn-amber-full mt-6 disabled:opacity-40"
        >
          {busy ? <Loader2 size={16} className="mx-auto animate-spin" /> : 'Unlock'}
        </button>

        <p className="mt-6 font-sans text-xs leading-relaxed" style={{ color: 'var(--text3)' }}>
          Lost your code? If you still have Argo on your iPhone, open it there: your key is also
          held in your iCloud Keychain, so the app can unlock without the code.
        </p>
      </div>
    </div>
  )
}
