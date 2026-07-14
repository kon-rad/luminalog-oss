/**
 * Decorative "end of page" colophon mark, the web twin of the iOS
 * `ColophonEndpiece`. The source asset is dark line-art on a transparent
 * background (3000×600, a 5:1 divider). We render it as a CSS mask over a
 * solid colour — the web equivalent of iOS `renderingMode(.template)` — so it
 * tints to a quiet, theme-aware ink in both light and dark mode instead of
 * disappearing on the dark background. Purely ornamental.
 */
export default function ColophonEndpiece({
  maxWidth = 300,
  marginTop = 56,
}: {
  maxWidth?: number
  marginTop?: number
}) {
  const src = 'url(/luminalog-colophon-endpiece.png)'
  return (
    <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'center', marginTop }}>
      <div
        style={{
          width: '100%',
          maxWidth,
          aspectRatio: '5 / 1',
          backgroundColor: 'var(--text3)',
          opacity: 0.6,
          WebkitMaskImage: src,
          maskImage: src,
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
        }}
      />
    </div>
  )
}
