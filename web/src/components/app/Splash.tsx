import Image from 'next/image'

// Brief loading state during first auth resolution (design B.1). A near-empty
// ink screen — the Argo emblem centered over a faint amber breathing glow, no
// spinner chrome. Ink in both themes on purpose: the emblem is a dark-surface
// asset (its gold wordmark has no contrast on warm paper), so the momentary
// splash is the one branded, theme-independent screen in the app.
export default function Splash() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center"
      style={{ background: 'var(--dark-bg)' }}
    >
      <div className="relative flex items-center justify-center">
        <div
          className="absolute rounded-full"
          style={{
            width: 240,
            height: 240,
            background: 'radial-gradient(circle, rgba(229,160,99,0.22), rgba(229,160,99,0) 70%)',
            animation: 'orb-breathe 3.2s ease-in-out infinite',
          }}
        />
        <Image
          src="/argo-emblem-alpha.png"
          alt="Argo"
          width={176}
          height={220}
          className="relative"
          priority
        />
      </div>
    </div>
  )
}
