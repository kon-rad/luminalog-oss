// ui.jsx — shared components + helpers for LuminaLog.

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function relDay(d) {
  const now = new Date('2026-06-13T09:41');
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((b - a) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return DAYS[d.getDay()];
  return `${MONTHS[d.getMonth()].slice(0,3)} ${d.getDate()}`;
}
function clockTime(d) {
  let h = d.getHours(), m = d.getMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2,'0')} ${ap}`;
}
function fullDate(d) {
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
function groupLabel(d) {
  const now = new Date('2026-06-13T09:41');
  const diff = Math.round((new Date(now.getFullYear(),now.getMonth(),now.getDate()) - new Date(d.getFullYear(),d.getMonth(),d.getDate())) / 86400000);
  if (diff < 7) return 'This week';
  if (diff < 14) return 'Last week';
  if (d.getFullYear() === now.getFullYear()) return MONTHS[d.getMonth()] + ' ' + d.getFullYear();
  return MONTHS[d.getMonth()] + ' ' + d.getFullYear();
}
const truncate = (s, n) => s.length > n ? s.slice(0, n).trimEnd() + '…' : s;

// ─────────────────────────────────────────────────────────────
// Striped image placeholder (no hand-drawn imagery)
// ─────────────────────────────────────────────────────────────
function Placeholder({ label, h = 180, radius = 16, style }) {
  const t = useTheme();
  const stripe = t.isDark ? 'rgba(255,245,230,0.05)' : 'rgba(60,50,40,0.045)';
  return (
    <div style={{
      height: h, borderRadius: radius, position: 'relative', overflow: 'hidden',
      background: `repeating-linear-gradient(135deg, ${t.surfaceAlt}, ${t.surfaceAlt} 11px, ${stripe} 11px, ${stripe} 22px)`,
      border: `1px solid ${t.hairline}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', ...style,
    }}>
      <span style={{ fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace', fontSize: 11, letterSpacing: 0.3,
        color: t.text3, background: t.bg, padding: '4px 9px', borderRadius: 6, border: `1px solid ${t.hairline}` }}>{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Type pill
// ─────────────────────────────────────────────────────────────
function TypePill({ type, size = 'sm' }) {
  const t = useTheme();
  const meta = typeMeta(t.isDark)[type];
  const big = size === 'lg';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: big ? 6 : 5,
      padding: big ? '6px 12px 6px 10px' : '3px 9px 3px 7px',
      borderRadius: 999, background: t.isDark ? meta.hue + '24' : meta.hue + '1A',
      color: meta.hue, fontFamily: UI_FONT, fontSize: big ? 14 : 12, fontWeight: 600,
      letterSpacing: 0.1, whiteSpace: 'nowrap',
    }}>
      <Icon name={meta.icon} size={big ? 16 : 13} />
      {meta.label}
    </span>
  );
}

// small circular type glyph (for list rows)
function TypeGlyph({ type, size = 38 }) {
  const t = useTheme();
  const meta = typeMeta(t.isDark)[type];
  return (
    <div style={{ width: size, height: size, borderRadius: size * 0.32, flexShrink: 0,
      background: t.isDark ? meta.hue + '20' : meta.hue + '16', color: meta.hue,
      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={meta.icon} size={size * 0.5} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Entry row (used on Home + List)
// ─────────────────────────────────────────────────────────────
function EntryRow({ e, showTime = false, onOpen, last = false }) {
  const t = useTheme();
  const [press, setPress] = React.useState(false);
  return (
    <div
      onClick={() => onOpen && onOpen(e)}
      onPointerDown={() => setPress(true)}
      onPointerUp={() => setPress(false)}
      onPointerLeave={() => setPress(false)}
      style={{
        display: 'flex', gap: 13, padding: '14px 0', cursor: 'pointer', alignItems: 'flex-start',
        background: press ? t.accentTint : 'transparent', borderRadius: 14,
        marginLeft: press ? -10 : 0, marginRight: press ? -10 : 0, paddingLeft: press ? 10 : 0, paddingRight: press ? 10 : 0,
        transition: 'background .15s, padding .12s, margin .12s',
        borderBottom: last ? 'none' : `1px solid ${t.hairline}`,
      }}>
      <TypeGlyph type={e.type} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontFamily: UI_FONT, fontSize: 16.5, fontWeight: 600, color: t.text, letterSpacing: -0.2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</span>
          <span style={{ fontFamily: UI_FONT, fontSize: 13, color: t.text3, fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>
            {relDay(e.date)}{showTime ? ' · ' + clockTime(e.date) : ''}
          </span>
        </div>
        <p style={{ margin: '3px 0 0', fontFamily: SERIF, fontSize: 14.5, lineHeight: 1.5, color: t.text2,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {truncate(e.body, 100)}
        </p>
      </div>
    </div>
  );
}

// skeleton row
function SkeletonRow() {
  const t = useTheme();
  const bar = (w) => <div style={{ height: 11, width: w, borderRadius: 6, background: t.surfaceAlt }} />;
  return (
    <div style={{ display: 'flex', gap: 13, padding: '15px 0', borderBottom: `1px solid ${t.hairline}`, alignItems: 'flex-start' }} className="ll-shimmer">
      <div style={{ width: 38, height: 38, borderRadius: 12, background: t.surfaceAlt, flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9, paddingTop: 3 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>{bar('48%')}{bar('46px')}</div>
        {bar('92%')}{bar('70%')}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Stat card
// ─────────────────────────────────────────────────────────────
function StatCard({ icon, value, label, accent = false }) {
  const t = useTheme();
  return (
    <div style={{ flex: 1, background: t.surface, borderRadius: 20, padding: '16px 16px 15px',
      boxShadow: t.shadowSoft, border: `1px solid ${t.hairline}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: accent ? t.accent : t.text2 }}>
        <Icon name={icon} size={18} />
        <span style={{ fontFamily: UI_FONT, fontSize: 13, fontWeight: 600, color: t.text2, letterSpacing: 0.1 }}>{label}</span>
      </div>
      <div style={{ fontFamily: UI_FONT, fontSize: 27, fontWeight: 700, color: t.text, marginTop: 8, letterSpacing: -0.6 }}>{value}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// AI action button — generate / regenerate w/ loading
// ─────────────────────────────────────────────────────────────
function AIButton({ label, loadingLabel, onClick, busy, variant = 'solid', icon = 'sparkle', full = true }) {
  const t = useTheme();
  const [press, setPress] = React.useState(false);
  const solid = variant === 'solid';
  return (
    <button
      onClick={onClick} disabled={busy}
      onPointerDown={() => setPress(true)} onPointerUp={() => setPress(false)} onPointerLeave={() => setPress(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9,
        width: full ? '100%' : 'auto', padding: '0 20px', height: 52, borderRadius: 16, border: 'none',
        cursor: busy ? 'default' : 'pointer', fontFamily: UI_FONT, fontSize: 16.5, fontWeight: 600, letterSpacing: -0.1,
        background: solid ? t.accent : t.accentTint, color: solid ? t.onAccent : t.accent,
        boxShadow: solid && !busy ? t.shadowSoft : 'none',
        transform: press ? 'scale(0.975)' : 'scale(1)', transition: 'transform .12s, opacity .2s',
        opacity: busy ? 0.92 : 1,
      }}>
      {busy
        ? <><Spinner color={solid ? t.onAccent : t.accent} /><span>{loadingLabel || 'Working…'}</span></>
        : <><Icon name={icon} size={20} /><span>{label}</span></>}
    </button>
  );
}

function Spinner({ color, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ animation: 'll-spin 0.8s linear infinite' }}>
      <circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeOpacity="0.25" strokeWidth="3" />
      <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────
// Avatar
// ─────────────────────────────────────────────────────────────
function Avatar({ name, size = 44, ring = false }) {
  const t = useTheme();
  const initials = name.split(' ').map(s => s[0]).slice(0,2).join('');
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(150deg, ${t.accent}, ${t.accentDeep})`, color: t.onAccent,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: UI_FONT, fontWeight: 600, fontSize: size * 0.38, letterSpacing: 0.2,
      boxShadow: ring ? `0 0 0 3px ${t.bg}, 0 0 0 4.5px ${t.accent}` : 'none' }}>
      {initials}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Bottom sheet / action sheet
// ─────────────────────────────────────────────────────────────
function Sheet({ open, onClose, children }) {
  const t = useTheme();
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 200, pointerEvents: open ? 'auto' : 'none' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: t.scrim,
        opacity: open ? 1 : 0, transition: 'opacity .25s' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, padding: '0 8px 8px',
        transform: open ? 'translateY(0)' : 'translateY(110%)', transition: 'transform .32s cubic-bezier(.32,.72,0,1)' }}>
        {children}
      </div>
    </div>
  );
}

function ActionSheet({ open, onClose, title, actions }) {
  const t = useTheme();
  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ background: t.isDark ? 'rgba(44,40,32,0.92)' : 'rgba(252,250,247,0.92)', backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)', borderRadius: 18, overflow: 'hidden', marginBottom: 8 }}>
        {title && <div style={{ padding: '14px 18px', textAlign: 'center', fontFamily: UI_FONT, fontSize: 13,
          color: t.text3, borderBottom: `1px solid ${t.sep}` }}>{title}</div>}
        {actions.map((a, i) => (
          <button key={i} onClick={() => { onClose(); a.onClick && a.onClick(); }}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, width: '100%',
              padding: '17px', border: 'none', background: 'transparent', cursor: 'pointer',
              borderTop: i && !title ? `1px solid ${t.sep}` : i ? `1px solid ${t.sep}` : 'none',
              fontFamily: UI_FONT, fontSize: 19, fontWeight: a.bold ? 600 : 400,
              color: a.destructive ? '#E5544B' : t.accent }}>
            {a.icon && <Icon name={a.icon} size={20} />}{a.label}
          </button>
        ))}
      </div>
      <button onClick={onClose} style={{ width: '100%', padding: '17px', border: 'none', borderRadius: 18, cursor: 'pointer',
        background: t.surface, fontFamily: UI_FONT, fontSize: 19, fontWeight: 600, color: t.accent }}>Cancel</button>
    </Sheet>
  );
}

// section header
function SectionHeader({ children, action }) {
  const t = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', margin: '4px 0 6px' }}>
      <h2 style={{ margin: 0, fontFamily: UI_FONT, fontSize: 20, fontWeight: 700, color: t.text, letterSpacing: -0.4 }}>{children}</h2>
      {action}
    </div>
  );
}

Object.assign(window, {
  relDay, clockTime, fullDate, groupLabel, truncate, MONTHS, DAYS,
  Placeholder, TypePill, TypeGlyph, EntryRow, SkeletonRow, StatCard,
  AIButton, Spinner, Avatar, Sheet, ActionSheet, SectionHeader,
});
