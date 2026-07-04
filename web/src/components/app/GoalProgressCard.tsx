import { BadgeCheck } from 'lucide-react'
import Card from '@/components/app/Card'
import { SkeletonStat } from '@/components/app/Skeleton'

/** The daily journaling goal, in words (design §8). */
export const DAILY_GOAL_WORDS = 750

interface GoalProgressCardProps {
  goalDayWords: number
  className?: string
  /** Renders the skeleton-redacted variant instead. */
  loading?: boolean
}

/**
 * Progress toward the 750-word daily goal (design B.7 `GoalProgressCard`): a
 * bar showing `goalDayWords / 750` plus the `"N / 750 words today"` label,
 * with a `BadgeCheck` once the goal is met.
 */
export default function GoalProgressCard({ goalDayWords, className, loading }: GoalProgressCardProps) {
  if (loading) return <SkeletonStat className={className} />

  const met = goalDayWords >= DAILY_GOAL_WORDS
  const pct = Math.max(0, Math.min(100, Math.round((goalDayWords / DAILY_GOAL_WORDS) * 100)))

  return (
    <Card className={`flex flex-col gap-3 ${className ?? ''}`}>
      <div className="flex items-center justify-between">
        <span
          className="font-sans text-xs font-semibold uppercase tracking-wide"
          style={{ color: 'var(--text2)' }}
        >
          Daily goal
        </span>
        {met && <BadgeCheck size={16} strokeWidth={2} style={{ color: 'var(--accent)' }} />}
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--surfaceAlt)' }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: 'var(--accent)' }}
        />
      </div>

      <span className="font-sans text-sm font-medium" style={{ color: 'var(--text)' }}>
        {goalDayWords.toLocaleString()} / {DAILY_GOAL_WORDS} words today
      </span>
    </Card>
  )
}
