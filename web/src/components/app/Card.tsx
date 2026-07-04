import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

/**
 * The signature surface card (design A.7 "Card"): `.card` (24px radius,
 * 1px hairline, warm shadow, hover-lift `translateY(-3px)`) with the
 * standard 16px padding baked in. Pass `className` to extend/override layout
 * (e.g. flex direction, gap) — it is appended after `card p-4` so Tailwind
 * utilities in `className` win over the default padding when they conflict.
 */
export default function Card({ children, className }: CardProps) {
  return <div className={`card p-4 ${className ?? ''}`}>{children}</div>
}
