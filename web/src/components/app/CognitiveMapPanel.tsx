'use client'

import { useCallback, useEffect, useState } from 'react'
import { CognitiveMapView } from '@/lib/cognitive-map/react'
import type { Beat } from '@/lib/cognitive-map'
import { ensureCognitiveMap } from '@/lib/ai/entryMap'
import { useTheme } from '@/lib/theme'
import type { JournalEntry } from '@/lib/firestore/models'

/**
 * The Map tab. Web half of the shared renderer: the exact same layout and drawing
 * code the iOS app loads in its WebView, so the two are one map rather than two that
 * resemble each other.
 *
 * Generation is asynchronous and best-effort, so this is explicit about waiting rather
 * than showing an empty box. Entries written before the feature shipped generate on
 * first open, which is why it fires from an effect and not only from a button.
 */
export function CognitiveMapPanel({ entry }: { entry: JournalEntry }) {
  const { resolvedMode } = useTheme()
  const [generating, setGenerating] = useState(false)
  const [failed, setFailed] = useState(false)
  const [selected, setSelected] = useState<Beat | null>(null)

  const map = entry.cognitiveMap?.map
  const drawn = map?.beats.filter((b) => b.tier === 'map') ?? []
  const hasMap = drawn.length > 0

  const generate = useCallback(async () => {
    setGenerating(true)
    setFailed(false)
    const ok = await ensureCognitiveMap(entry)
    setGenerating(false)
    // The live entry subscription delivers the map, so a false result here just means
    // nothing landed. Offer the retry.
    if (!ok) setFailed(true)
  }, [entry])

  useEffect(() => {
    if (hasMap) return
    void generate()
    // Only re-run for a different entry; `generate` closes over this one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.id])

  const onSelectBeat = useCallback(
    (beatId: string) => setSelected(map?.beats.find((b) => b.id === beatId) ?? null),
    [map],
  )

  if (hasMap && map) {
    return (
      <div className="relative h-[65vh] w-full">
        <CognitiveMapView
          map={map}
          colorScheme={resolvedMode === 'dark' ? 'dark' : 'light'}
          onSelectBeat={onSelectBeat}
          className="h-full w-full"
        />
        {selected && (
          <BeatInspector
            beat={selected}
            content={entry.content}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    )
  }

  return (
    <div className="flex h-64 flex-col items-center justify-center gap-3 text-center text-sm opacity-70">
      {generating && <p>Reading your entry…</p>}
      {!generating && failed && (
        <>
          <p>Couldn&apos;t build the map.</p>
          <button type="button" onClick={() => void generate()} className="font-semibold underline">
            Try again
          </button>
        </>
      )}
      {!generating && !failed && <p>Not enough here to map yet.</p>}
    </div>
  )
}

/**
 * The source quote, highlighted in place. This is what makes "always traceable" real:
 * nothing on the map is asserted without the writer's own words one click underneath.
 *
 * Prefers the recorded offset, VALIDATED against the text, and falls back to a search,
 * which covers an entry edited after mapping. Never highlights an unverified range.
 * Mirrors the iOS `BeatQuoteHighlighter`.
 */
function BeatInspector({
  beat,
  content,
  onClose,
}: {
  beat: Beat
  content: string
  onClose: () => void
}) {
  const start = (() => {
    const at = beat.quoteStart
    if (at >= 0 && content.slice(at, at + beat.quote.length) === beat.quote) return at
    const found = content.indexOf(beat.quote)
    return found >= 0 ? found : -1
  })()

  return (
    <div
      className="absolute inset-0 flex items-end bg-black/30"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[75%] w-full overflow-y-auto rounded-t-2xl bg-[var(--cm-surface,#F4F0E9)] p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="In your words"
      >
        <h3 className="text-xs uppercase tracking-wide opacity-60">In your words</h3>
        <p className="mt-1 text-lg font-semibold">{beat.text}</p>
        <p className="mt-1 text-xs opacity-60">
          {beat.kind} · {beat.domain}
          {beat.isKeeper && ' · Keeper'}
        </p>
        {beat.mentions.length > 0 && (
          <p className="mt-1 text-xs opacity-60">
            {beat.mentions.map((m) => m.surface).join(' · ')}
          </p>
        )}
        <p className="mt-4 whitespace-pre-wrap leading-relaxed">
          {start < 0 ? (
            content
          ) : (
            <>
              {content.slice(0, start)}
              <mark className="rounded bg-amber-200/50 px-0.5">
                {content.slice(start, start + beat.quote.length)}
              </mark>
              {content.slice(start + beat.quote.length)}
            </>
          )}
        </p>
      </div>
    </div>
  )
}
