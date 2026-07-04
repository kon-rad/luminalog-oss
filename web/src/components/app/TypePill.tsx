import { AlignLeft, AudioLines, Video, Image as ImageIcon, Loader2, TriangleAlert } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { JournalType } from '@/lib/firestore/models'

interface TypeMeta {
  label: string
  Icon: LucideIcon
  /** Solid per-type tint fill + white icon/label (default variant). */
  solid: string
  /** `tint @12%` fill for the status-badge variant. */
  tint: string
  /** Tint-colored text/icon for the status-badge variant. */
  text: string
}

// Per-type tints (design A.2/A.7): text=accent, voice/video/image use the
// dedicated `type*`/`type*Dk` Tailwind tokens added in T1 — both variants
// declared so `dark:` picks up the dark-mode hex automatically.
const TYPE_META: Record<JournalType, TypeMeta> = {
  text: {
    label: 'Text',
    Icon: AlignLeft,
    solid: 'bg-accent dark:bg-accentDk',
    tint: 'bg-accent/10 dark:bg-accentDk/15',
    text: 'text-accent dark:text-accentDk',
  },
  voice: {
    label: 'Voice',
    Icon: AudioLines,
    solid: 'bg-typeVoice dark:bg-typeVoiceDk',
    tint: 'bg-typeVoice/10 dark:bg-typeVoiceDk/15',
    text: 'text-typeVoice dark:text-typeVoiceDk',
  },
  video: {
    label: 'Video',
    Icon: Video,
    solid: 'bg-typeVideo dark:bg-typeVideoDk',
    tint: 'bg-typeVideo/10 dark:bg-typeVideoDk/15',
    text: 'text-typeVideo dark:text-typeVideoDk',
  },
  image: {
    label: 'Photo',
    Icon: ImageIcon,
    solid: 'bg-typeImage dark:bg-typeImageDk',
    tint: 'bg-typeImage/10 dark:bg-typeImageDk/15',
    text: 'text-typeImage dark:text-typeImageDk',
  },
}

export type TypePillStatus = 'processing' | 'failed'

interface TypePillProps {
  type: JournalType
  /** Omit for the default solid capsule; pass to render the muted
   * "processing" (spinner) or "failed" (warning) status-badge variant. */
  status?: TypePillStatus
  className?: string
}

/**
 * Journal-type capsule (design A.7 "Type pill"): a capsule filled with the
 * per-type tint, a white icon, and the type label. Passing `status` swaps in
 * the status-badge variant — `tint @12%` fill, tint-colored text, and a
 * spinner (`processing`) or warning glyph (`failed`) in place of the type icon.
 */
export default function TypePill({ type, status, className }: TypePillProps) {
  const meta = TYPE_META[type]

  if (status) {
    const StatusIcon = status === 'failed' ? TriangleAlert : Loader2
    return (
      <span
        className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold ${meta.tint} ${meta.text} ${className ?? ''}`}
      >
        <StatusIcon size={10} strokeWidth={2.25} className={status === 'processing' ? 'animate-spin' : ''} />
        {status === 'failed' ? 'Failed' : 'Analyzing…'}
      </span>
    )
  }

  const Icon = meta.Icon
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold text-white ${meta.solid} ${className ?? ''}`}
    >
      <Icon size={10} strokeWidth={2.25} />
      {meta.label}
    </span>
  )
}
