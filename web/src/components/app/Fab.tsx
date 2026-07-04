import Link from 'next/link'
import { Plus } from 'lucide-react'

// The raised create affordance (design A.7 / B.0): a 64px amber-gradient
// circle with a white plus, amber glow, floating half above the bottom nav
// bar, wrapped in an app-bg ring so it reads as "punched through" the bar.
// Always links to /create (T9 owns the actual Create screen).
export default function Fab() {
  return (
    <Link
      href="/create"
      aria-label="Create entry"
      className="flex items-center justify-center rounded-full transition-transform duration-150 hover:-translate-y-0.5"
      style={{
        width: 64,
        height: 64,
        marginTop: -32,
        background: 'linear-gradient(135deg, #E8A05A, var(--accentDeep))',
        boxShadow: '0 0 0 6px var(--bg), 0 6px 20px rgba(206,127,68,0.45), 0 0 30px rgba(206,127,68,0.35)',
      }}
    >
      <Plus size={28} color="#fff" strokeWidth={2.25} />
    </Link>
  )
}
