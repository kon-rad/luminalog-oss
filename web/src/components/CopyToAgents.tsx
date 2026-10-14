'use client'

import { useState } from 'react'

/* Top-right button on every blog post: copies the post as markdown (with its
 * URL in the frontmatter) so it can be pasted straight into an AI agent. */
export default function CopyToAgents({ markdown, markdownUrl }: { markdown: string; markdownUrl: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  async function copy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(markdown)
      } else {
        const area = document.createElement('textarea')
        area.value = markdown
        area.style.position = 'fixed'
        area.style.opacity = '0'
        document.body.appendChild(area)
        area.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(area)
        if (!ok) throw new Error('copy refused')
      }
      setState('copied')
    } catch {
      setState('failed')
    }
    setTimeout(() => setState('idle'), 2200)
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <button
        type="button"
        onClick={copy}
        title="Copy this post as markdown for an AI agent"
        aria-live="polite"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          padding: '7px 13px',
          borderRadius: 999,
          border: '1px solid var(--hairline)',
          background: 'var(--surface)',
          color: 'var(--text)',
          fontSize: 13.5,
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: 'var(--shadow)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <rect x="9" y="9" width="12" height="12" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
        {state === 'copied' ? 'Copied for agents' : state === 'failed' ? 'Copy failed' : 'Copy to agents'}
      </button>
      <a href={markdownUrl} style={{ fontSize: 13, color: 'var(--text3)' }} title="This post as raw markdown">
        .md
      </a>
    </span>
  )
}
