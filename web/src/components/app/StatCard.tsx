import type { LucideIcon } from 'lucide-react'
import Card from '@/components/app/Card'
import { SkeletonStat } from '@/components/app/Skeleton'

interface StatCardProps {
  icon: LucideIcon
  value: string | number
  label: string
  className?: string
  /** Renders the skeleton-redacted variant instead. */
  loading?: boolean
}

/**
 * A small stat tile (design A.7/B.7 stats row): an icon + a big **sans**
 * value (~22px/700) + a secondary label — e.g. streak `"N-day"` with
 * `Flame`, total words with `BookText`.
 */
export default function StatCard({ icon: Icon, value, label, className, loading }: StatCardProps) {
  if (loading) return <SkeletonStat className={className} />

  return (
    <Card className={`flex flex-col gap-2 ${className ?? ''}`}>
      <Icon size={18} strokeWidth={2} style={{ color: 'var(--accent)' }} />
      <span className="font-sans text-[22px] font-bold leading-none" style={{ color: 'var(--text)' }}>
        {value}
      </span>
      <span className="font-sans text-xs font-medium" style={{ color: 'var(--text2)' }}>
        {label}
      </span>
    </Card>
  )
}
