import { C, SANS, SERIF } from './theme'

/* The go-to-market diagram for slide 11: four spokes, arrows pointing inward,
 * a hexagon centre marked Argo, and the content ring wrapping the outside.
 * Drawn rather than photographed so it scales cleanly on a projector and can
 * be rasterised straight into the PowerPoint export. */
export default function Flywheel({ size = 430 }: { size?: number }) {
  const cx = 250
  const cy = 250
  const spokes = [
    { label: 'Podcast', angle: -90 },
    { label: 'Kids class', angle: 0 },
    { label: 'Community', angle: 90 },
    { label: 'AI course', angle: 180 },
  ]

  const hex = (r: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 180) * (60 * i - 30)
      return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
    }).join(' ')

  return (
    /* The viewBox is wider than tall so the left and right spoke labels have
     * room to sit outside the ring without being clipped. */
    <svg
      width={size * (600 / 500)}
      height={size}
      viewBox="-50 0 600 500"
      fill="none"
      aria-label="The Argo flywheel"
    >
      <defs>
        <marker id="fw-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill={C.accent} />
        </marker>
      </defs>

      {/* Content ring: everything the spokes produce, which feeds them again. */}
      <circle cx={cx} cy={cy} r={222} stroke={C.accent} strokeOpacity={0.3} strokeWidth={1.5} strokeDasharray="5 8" />
      {/* Rides the ring on the upper-left diagonal, clear of the four spokes. */}
      <text
        x={cx - 157}
        y={cy - 152}
        textAnchor="middle"
        fontFamily={SANS}
        fontSize={15}
        fontWeight={700}
        letterSpacing="0.16em"
        fill={C.accent}
      >
        CONTENT
      </text>

      {spokes.map(({ label, angle }) => {
        const rad = (Math.PI / 180) * angle
        const outer = 176
        const inner = 92
        const x1 = cx + outer * Math.cos(rad)
        const y1 = cy + outer * Math.sin(rad)
        const x2 = cx + inner * Math.cos(rad)
        const y2 = cy + inner * Math.sin(rad)
        const lx = cx + 196 * Math.cos(rad)
        const ly = cy + 196 * Math.sin(rad)
        return (
          <g key={label}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.accent} strokeWidth={2.5} markerEnd="url(#fw-arrow)" />
            <text
              x={lx}
              y={angle === -90 ? ly - 6 : angle === 90 ? ly + 20 : ly + 5}
              textAnchor={angle === 180 ? 'end' : angle === 0 ? 'start' : 'middle'}
              fontFamily={SANS}
              fontSize={19}
              fontWeight={600}
              fill={C.cream}
            >
              {label}
            </text>
          </g>
        )
      })}

      <polygon points={hex(82)} fill={C.inkElev} stroke={C.gold} strokeWidth={2} />
      <text x={cx} y={cy + 13} textAnchor="middle" fontFamily={SERIF} fontSize={40} fill={C.gold}>
        Argo
      </text>
    </svg>
  )
}
