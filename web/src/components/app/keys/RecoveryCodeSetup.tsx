'use client'

import { useMemo, useState } from 'react'
import { Check, Copy, Download } from 'lucide-react'

// Shown exactly once, right after a brand-new account is enrolled in this
// browser. The code is stored NOWHERE, so this screen is the user's only chance
// to keep it, and it therefore blocks rather than nudges: the user must save the
// code and then retype two of its groups before the app opens.

/** Which groups to challenge. Deterministic in `code` so a re-render does not
 *  move the goalposts mid-typing. */
export function challengeIndices(code: string, count = 2): number[] {
  const groups = code.split('-')
  const picks: number[] = []
  // A tiny deterministic hash of the code seeds the choice: stable per code,
  // different across codes, and no dependency on render order.
  let h = 0
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  let guard = 0
  while (picks.length < count && picks.length < groups.length && guard < 1000) {
    const idx = h % groups.length
    if (!picks.includes(idx)) picks.push(idx)
    h = (h * 31 + 17) >>> 0
    guard++
  }
  return picks.sort((a, b) => a - b)
}

export default function RecoveryCodeSetup({
  code,
  onAcknowledged,
}: {
  code: string
  onAcknowledged: () => void
}) {
  const groups = useMemo(() => code.split('-'), [code])
  const challenge = useMemo(() => challengeIndices(code), [code])
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)
  const [answers, setAnswers] = useState<Record<number, string>>({})

  const answersCorrect = challenge.every(
    (i) => (answers[i] ?? '').trim().toUpperCase() === groups[i],
  )
  const canProceed = saved && answersCorrect

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setSaved(true)
    } catch {
      // Clipboard permission denied. Downloading is still available, and the
      // code is on screen to copy by hand, so this is not an error state.
    }
  }

  const handleDownload = () => {
    const blob = new Blob(
      [
        'Argo recovery code\n\n',
        `${code}\n\n`,
        'This code is the only way to unlock your journal on a new device or browser.\n',
        'Argo does not store it and cannot recover it for you. Keep it somewhere safe.\n',
      ],
      { type: 'text/plain' },
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'argo-recovery-code.txt'
    a.click()
    URL.revokeObjectURL(url)
    setSaved(true)
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{ background: 'var(--bg)' }}
    >
      <div className="w-full max-w-md">
        <h1 className="serif mb-3 text-2xl font-semibold" style={{ color: 'var(--text)' }}>
          Save your recovery code
        </h1>
        <p className="mb-5 font-sans text-sm leading-relaxed" style={{ color: 'var(--text2)' }}>
          Your journal is encrypted with a key only you hold. This code is the only way to unlock it
          on another device. We do not store it and cannot recover it for you.
        </p>

        <div
          className="rounded-card p-4 font-mono text-sm leading-relaxed tracking-wide"
          style={{ background: 'var(--surfaceAlt)', color: 'var(--text)' }}
        >
          {code}
        </div>

        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => void handleCopy()}
            className="flex flex-1 items-center justify-center gap-2 rounded-btn py-2.5 font-sans text-sm font-semibold"
            style={{ color: 'var(--text)', border: '1px solid var(--hairline2)' }}
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex flex-1 items-center justify-center gap-2 rounded-btn py-2.5 font-sans text-sm font-semibold"
            style={{ color: 'var(--text)', border: '1px solid var(--hairline2)' }}
          >
            <Download size={16} />
            Download
          </button>
        </div>

        <p className="mb-3 mt-6 font-sans text-sm" style={{ color: 'var(--text2)' }}>
          Confirm you saved it. Type these groups back:
        </p>
        <div className="flex flex-wrap gap-3">
          {challenge.map((i) => (
            <label key={i} className="flex flex-col gap-1">
              <span className="font-sans text-xs" style={{ color: 'var(--text3)' }}>
                Group {i + 1}
              </span>
              <input
                value={answers[i] ?? ''}
                onChange={(e) => setAnswers((prev) => ({ ...prev, [i]: e.target.value }))}
                maxLength={4}
                spellCheck={false}
                autoCapitalize="characters"
                autoCorrect="off"
                className="w-24 rounded-btn px-3 py-2 text-center font-mono text-sm uppercase outline-none"
                style={{
                  background: 'var(--surfaceAlt)',
                  color: 'var(--text)',
                  border: '1px solid var(--hairline2)',
                }}
              />
            </label>
          ))}
        </div>

        <button
          type="button"
          onClick={onAcknowledged}
          disabled={!canProceed}
          className="btn-amber-full mt-6 disabled:opacity-40"
        >
          I saved my code
        </button>

        <p className="mt-4 font-sans text-xs leading-relaxed" style={{ color: 'var(--text3)' }}>
          Using Argo on iPhone too? Open the app and enter this same code once. Your key will then
          also live in your iCloud Keychain as a second backup.
        </p>
      </div>
    </div>
  )
}
