'use client'

// Constellation (design B.14) — a modal opened from the Journal toolbar's
// Constellation button: a 3D force-directed graph of the user's entries,
// nodes sized by similarity-degree, edges weighted by similarity, on a dark
// cosmic canvas (mirrors the Soul galaxy's palette). Mirrors `SearchModal`/
// `InsightsModal`'s overlay/Escape/backdrop-close/`role=dialog` shell.
//
// `react-force-graph-3d` touches `window`/WebGL at import time, so it MUST be
// loaded via `next/dynamic` with `ssr:false` — never imported statically (that
// would break `next build`/SSR). We only render it while the modal is open;
// unmounting on close/`!open` is enough cleanup for the underlying instance.

import { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Loader2, X } from 'lucide-react'
import type { ForceGraphProps, LinkObject, NodeObject } from 'react-force-graph-3d'
import { fetchGraph, type GraphLink, type GraphNode, type JournalGraph } from '@/lib/api/graph'
import EmptyState from '@/components/app/EmptyState'
import TypePill from '@/components/app/TypePill'

// Explicit `<GraphNode, GraphLink>` type args so the dynamic import keeps our
// node/link shapes (without them, `dynamic()`'s inferred props type falls
// back to the library's untyped `{}` node/link generics and every accessor
// prop below fails to type-check).
const ForceGraph3D = dynamic<ForceGraphProps<GraphNode, GraphLink>>(() => import('react-force-graph-3d'), {
  ssr: false,
})

const COSMIC_BG = '#120F1A'
const STAR_GOLD = '#F5C842'
const LINK_COLOR = 'rgba(245,200,66,0.35)'

interface ConstellationModalProps {
  open: boolean
  onClose: () => void
}

type GraphState =
  | { status: 'loading' }
  | { status: 'loaded'; graph: JournalGraph }
  | { status: 'error' }

// The graph library's `nodeLabel` tooltip is injected via `innerHTML`
// (float-tooltip → `.html(content)`), so any string handed to it is rendered as
// markup. Entry titles are free-form user text (server-decrypted, not escaped),
// so we HTML-escape here to prevent a self-XSS via a title like `<img onerror=…>`.
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string))
}

/** `GraphNode.date` is a `'yyyy-MM-dd'`-or-ISO string; format it the same way
 * `SearchModal`'s results do, falling back to the raw string if unparseable. */
function formatNodeDate(date: string): string {
  const parsed = new Date(date)
  if (Number.isNaN(parsed.getTime())) return date
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed)
}

/** Viewport-derived canvas size (design: "measure the modal content box…
 * or pass fixed dimensions based on the viewport"). Client-only — only
 * computed inside effects, never during render/SSR. */
function useCanvasDimensions(open: boolean): { width: number; height: number } {
  const [dims, setDims] = useState({ width: 600, height: 420 })

  useEffect(() => {
    if (!open) return
    function measure() {
      setDims({
        width: Math.min(window.innerWidth - 32, 900),
        height: Math.round(window.innerHeight * 0.7),
      })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open])

  return dims
}

export default function ConstellationModal({ open, onClose }: ConstellationModalProps) {
  const [state, setState] = useState<GraphState>({ status: 'loading' })
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const dims = useCanvasDimensions(open)
  // Generation guard: rapid close/reopen can overlap two `fetchGraph()` calls;
  // ignore a resolved response unless it belongs to the latest `load()`.
  const loadGenRef = useRef(0)

  function load() {
    const gen = ++loadGenRef.current
    setState({ status: 'loading' })
    fetchGraph()
      .then((graph) => {
        if (gen === loadGenRef.current) setState({ status: 'loaded', graph })
      })
      .catch((err) => {
        console.error('[constellation-modal] fetchGraph failed:', err)
        if (gen === loadGenRef.current) setState({ status: 'error' })
      })
  }

  // Fetch fresh each time the modal opens, and clear any stale selection from
  // a previous open — mirrors SearchModal's reset-on-open.
  useEffect(() => {
    if (!open) return
    setSelectedNode(null)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Escape closes — client-only listener, attached only while open.
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pb-6 pt-6 sm:pt-12"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Constellation"
        className="flex max-h-full w-full max-w-3xl flex-col rounded-card p-5"
        style={{ background: 'var(--surface)', boxShadow: 'var(--shadowHover)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex shrink-0 items-center justify-between gap-3">
          <h2 className="serif text-lg font-semibold" style={{ color: 'var(--text)' }}>
            Constellation
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close constellation"
            className="flex h-8 w-8 items-center justify-center rounded-full"
            style={{ color: 'var(--text2)' }}
          >
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>

        <div className="min-h-[200px] flex-1 overflow-y-auto">
          {state.status === 'loading' && <ConstellationLoading />}
          {state.status === 'error' && (
            <EmptyState title="Couldn't map your journal" message="Something went wrong. Please try again." actionLabel="Retry" onAction={load} />
          )}
          {state.status === 'loaded' && state.graph.nodes.length < 2 && (
            <EmptyState
              title="Not enough entries yet"
              message="Write a few more entries to discover connections."
            />
          )}
          {state.status === 'loaded' && state.graph.nodes.length >= 2 && (
            <ConstellationGraph
              graph={state.graph}
              width={dims.width}
              height={dims.height}
              selectedNode={selectedNode}
              onSelectNode={setSelectedNode}
              onNavigate={onClose}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function ConstellationLoading() {
  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-2 font-sans text-sm" style={{ color: 'var(--text2)' }}>
        <Loader2 size={14} className="animate-spin" strokeWidth={2.25} />
        Mapping your journal…
      </p>
      <div
        className="w-full animate-pulse rounded-2xl"
        style={{ height: 'clamp(300px, 60vh, 500px)', background: COSMIC_BG }}
      />
    </div>
  )
}

function ConstellationGraph({
  graph,
  width,
  height,
  selectedNode,
  onSelectNode,
  onNavigate,
}: {
  graph: JournalGraph
  width: number
  height: number
  selectedNode: GraphNode | null
  onSelectNode: (node: GraphNode) => void
  onNavigate: () => void
}) {
  // Stable graphData identity across re-renders (e.g. selecting a node)
  // so the force simulation isn't restarted by an unrelated parent re-render.
  const graphData = useMemo(() => ({ nodes: graph.nodes, links: graph.links }), [graph])

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{ width, height, background: COSMIC_BG, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)' }}
      >
        <ForceGraph3D
          graphData={graphData}
          width={width}
          height={height}
          backgroundColor={COSMIC_BG}
          showNavInfo={false}
          nodeLabel={(node: NodeObject<GraphNode>) => escapeHtml(node.title || 'Untitled')}
          nodeVal={(node: NodeObject<GraphNode>) => Math.max(node.degree ?? 0, 1)}
          nodeColor={() => STAR_GOLD}
          nodeOpacity={0.9}
          linkColor={() => LINK_COLOR}
          linkWidth={(link: LinkObject<GraphNode, GraphLink>) => 0.5 + (link.value ?? 0) * 2.5}
          linkOpacity={0.4}
          onNodeClick={(node: NodeObject<GraphNode>) => onSelectNode(node as GraphNode)}
        />
      </div>

      {selectedNode && (
        <div
          className="flex items-start justify-between gap-3 rounded-2xl p-4"
          style={{ background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)' }}
        >
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <TypePill type={selectedNode.type} />
              <p className="font-sans text-xs font-medium" style={{ color: 'var(--text2)' }}>
                {formatNodeDate(selectedNode.date)}
              </p>
            </div>
            <p className="serif truncate text-[15px] font-semibold" style={{ color: 'var(--text)' }}>
              {selectedNode.title || 'Untitled'}
            </p>
          </div>
          <Link href={`/journal/${selectedNode.id}`} onClick={onNavigate} className="btn-amber shrink-0 whitespace-nowrap">
            View full entry
          </Link>
        </div>
      )}
    </div>
  )
}
