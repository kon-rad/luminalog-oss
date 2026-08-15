import { APP_STORE_URL } from '@/lib/appStore'

/**
 * Single download CTA used everywhere the pre-launch waitlist CTA used to sit.
 *
 * Variants map onto the button classes already in `globals.css` so the button
 * inherits the surface it lands on:
 *   store  dark Apple-style pill, for light page backgrounds
 *   white  white pill, for the accent-gradient CTA panels
 *   full   full-width amber, for the pricing cards
 *   nav    compact, for the navbar
 */
type Variant = 'store' | 'white' | 'full' | 'nav'

const CLASS: Record<Variant, string> = {
  store: 'btn-store',
  white: 'btn-white',
  full: 'btn-amber-full',
  nav: 'nav-cta',
}

const GLYPH_SIZE: Record<Variant, number> = { store: 19, white: 20, full: 18, nav: 15 }

function AppleGlyph({ size }: { size: number }) {
  return (
    <svg
      width={size * (20 / 24)}
      height={size}
      viewBox="0 0 20 24"
      fill="currentColor"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d="M16.4 12.7c0-2.6 2.1-3.9 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.1 2.5-1.8 3-.5 7.5 1.2 9.9.8 1.2 1.8 2.5 3.1 2.4 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.5-1-2.5-3.7zM13.9 3.5c.7-.8 1.1-2 1-3.2-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.3z" />
    </svg>
  )
}

export default function AppStoreButton({
  variant = 'store',
  label = 'Download on the App Store',
  className = '',
  style,
}: {
  variant?: Variant
  label?: string
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener"
      className={`${CLASS[variant]} ${className}`.trim()}
      style={style}
      aria-label="Download Argo Private AI Journal on the App Store"
    >
      <AppleGlyph size={GLYPH_SIZE[variant]} />
      {label}
    </a>
  )
}
