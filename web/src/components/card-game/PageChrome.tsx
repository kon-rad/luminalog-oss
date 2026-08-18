import Navbar from '@/components/Navbar'
import SiteFooter from '@/components/SiteFooter'

/* Shared chrome for the card game pages, matching CourseLayout: warm paper,
 * Newsreader headings, the same nav and footer as the rest of the site. */
export default function PageChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
      <SiteFooter />
    </>
  )
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full"
      style={{
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        padding: '5px 12px',
        color: 'var(--accentDeep)',
        background: 'var(--accentSoft)',
        border: '1px solid var(--accentTint)',
      }}
    >
      {children}
    </span>
  )
}
