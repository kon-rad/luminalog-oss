import type { CSSProperties } from 'react'

interface SkeletonProps {
  className?: string
  style?: CSSProperties
}

/**
 * Shimmer/redacted block primitive. Uses Tailwind's built-in `animate-pulse`
 * (no custom `@keyframes` needed — `globals.css` is off-limits to this
 * feature) over a warm hairline fill so it reads correctly in both themes.
 */
export function Skeleton({ className = '', style }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md ${className}`}
      style={{ background: 'var(--hairline2)', ...style }}
    />
  )
}

/** A redacted placeholder shaped like an `EntryRow`/`DraftRow`. */
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={`card flex items-start justify-between gap-3 p-4 ${className ?? ''}`}>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-full" />
      </div>
      <Skeleton className="h-5 w-14 shrink-0 rounded-full" />
    </div>
  )
}

/** A redacted placeholder shaped like a `StatCard`/`GoalProgressCard`. */
export function SkeletonStat({ className }: { className?: string }) {
  return (
    <div className={`card flex flex-col gap-2 p-4 ${className ?? ''}`}>
      <Skeleton className="h-4 w-4 rounded-full" />
      <Skeleton className="h-5 w-16" />
      <Skeleton className="h-3 w-20" />
    </div>
  )
}
