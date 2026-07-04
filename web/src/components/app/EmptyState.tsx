import type { CSSProperties } from 'react'
import { BookOpen } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  /** Defaults to `BookOpen` (design A.5 empty-state icon: `book.closed`). */
  icon?: LucideIcon
  title: string
  message?: string
  actionLabel?: string
  onAction?: () => void
  className?: string
}

const iconStyle: CSSProperties = { color: 'var(--accent)', opacity: 0.8 }

/**
 * Centered empty state (design A.7): a 44px light monoline icon at
 * `accent @80%`, a serif/sans headline, an optional secondary message, and
 * an optional amber action button. Warm and inviting — never scolding.
 */
export default function EmptyState({
  icon: Icon = BookOpen,
  title,
  message,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center gap-3 px-6 py-14 text-center ${className ?? ''}`}>
      <Icon size={44} strokeWidth={1.5} style={iconStyle} />
      <p className="serif text-lg font-semibold" style={{ color: 'var(--text)' }}>
        {title}
      </p>
      {message && (
        <p className="max-w-xs text-sm" style={{ color: 'var(--text2)' }}>
          {message}
        </p>
      )}
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} className="btn-amber mt-2">
          {actionLabel}
        </button>
      )}
    </div>
  )
}
