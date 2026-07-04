import Image from 'next/image'

// Brief loading state during first auth resolution (design B.1). Near-empty
// warm-paper screen: centered aperture logo + serif wordmark, a faint amber
// breathing glow behind it. No spinner chrome — calm and momentary.
export default function Splash() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-5"
      style={{ background: 'var(--bg)' }}
    >
      <div className="relative flex items-center justify-center">
        <div
          className="absolute rounded-full"
          style={{
            width: 140,
            height: 140,
            background: 'radial-gradient(circle, rgba(206,127,68,0.30), rgba(206,127,68,0) 70%)',
            animation: 'orb-breathe 3.2s ease-in-out infinite',
          }}
        />
        <Image src="/logo.svg" alt="LuminaLog" width={64} height={64} className="relative" priority />
      </div>
      <p className="serif text-xl font-semibold" style={{ color: 'var(--text)' }}>
        LuminaLog
      </p>
    </div>
  )
}
