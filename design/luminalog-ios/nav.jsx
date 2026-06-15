// nav.jsx — bottom navigation (with raised + FAB), screen wrapper, push top bar.

const NAV_H = 60;          // bar height
const HOME_IND = 26;       // space reserved for home indicator
const FAB_D = 60;          // FAB diameter

// ─────────────────────────────────────────────────────────────
// Bottom navigation bar with raised center FAB
// ─────────────────────────────────────────────────────────────
function BottomNav({ active, onTab, onCreate, hidden }) {
  const t = useTheme();
  const items = [
    { key: 'home',    icon: 'home',    label: 'Home' },
    { key: 'journal', icon: 'journal', label: 'Journal' },
    null, // FAB slot
    { key: 'chats',   icon: 'chat',    label: 'Chats' },
    { key: 'profile', icon: 'person',  label: 'Profile' },
  ];
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 90,
      transform: hidden ? 'translateY(140%)' : 'translateY(0)',
      transition: 'transform .3s cubic-bezier(.32,.72,0,1)',
      paddingBottom: HOME_IND, pointerEvents: hidden ? 'none' : 'auto',
    }}>
      {/* glass bar */}
      <div style={{ position: 'relative', height: NAV_H,
        background: t.glass, backdropFilter: 'blur(22px) saturate(180%)', WebkitBackdropFilter: 'blur(22px) saturate(180%)',
        borderTop: `1px solid ${t.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)'}`,
        display: 'flex', alignItems: 'flex-start', paddingTop: 9 }}>
        {items.map((it, i) => {
          if (!it) return <div key="fab" style={{ flex: 1 }} />;
          const on = active === it.key;
          return (
            <button key={it.key} onClick={() => onTab(it.key)}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
                color: on ? t.accent : t.text3, transition: 'color .15s' }}>
              <Icon name={it.icon} size={25} filled={on} />
              <span style={{ fontFamily: UI_FONT, fontSize: 10.5, fontWeight: on ? 600 : 500, letterSpacing: 0.1 }}>{it.label}</span>
            </button>
          );
        })}
      </div>
      {/* raised FAB — center, top half above the bar */}
      <button onClick={onCreate} aria-label="Create journal entry"
        style={{ position: 'absolute', left: '50%', top: -FAB_D / 2, transform: 'translateX(-50%)',
          width: FAB_D, height: FAB_D, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: `linear-gradient(155deg, ${t.accent}, ${t.accentDeep})`, color: t.onAccent,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 4px 12px ${t.isDark ? 'rgba(0,0,0,0.5)' : 'rgba(180,110,50,0.4)'}, 0 1px 3px rgba(0,0,0,0.2)`,
          outline: `4px solid ${t.bg}` }}
        onPointerDown={e => e.currentTarget.style.transform = 'translateX(-50%) scale(0.92)'}
        onPointerUp={e => e.currentTarget.style.transform = 'translateX(-50%) scale(1)'}
        onPointerLeave={e => e.currentTarget.style.transform = 'translateX(-50%) scale(1)'}>
        <Icon name="plus" size={30} />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Tab screen wrapper — scrollable, clears status bar + nav
// ─────────────────────────────────────────────────────────────
function Screen({ children, navSpace = true, scrollRef, onScroll, style }) {
  const t = useTheme();
  return (
    <div ref={scrollRef} onScroll={onScroll} className="ll-scroll" style={{
      position: 'absolute', inset: 0, overflowY: 'auto', background: t.bg,
      paddingTop: 50, paddingBottom: navSpace ? NAV_H + HOME_IND + 16 : HOME_IND + 8, ...style,
    }}>
      {children}
    </div>
  );
}

// horizontal page padding helper
const PAD = 20;

// ─────────────────────────────────────────────────────────────
// Push view top bar (back + title + optional trailing)
// ─────────────────────────────────────────────────────────────
function TopBar({ title, onBack, trailing, dark, scrolled, transparent }) {
  const t = useTheme();
  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 30, paddingTop: 46,
      background: scrolled ? t.glass : (transparent ? 'transparent' : t.bg),
      backdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none', WebkitBackdropFilter: scrolled ? 'blur(20px) saturate(180%)' : 'none',
      borderBottom: scrolled ? `1px solid ${t.hairline}` : '1px solid transparent', transition: 'background .2s, border-color .2s' }}>
      <div style={{ height: 44, display: 'flex', alignItems: 'center', padding: '0 8px 0 6px' }}>
        <button onClick={onBack} aria-label="Back" style={{ display: 'flex', alignItems: 'center', gap: 1, border: 'none',
          background: 'transparent', cursor: 'pointer', color: t.accent, padding: '6px 8px', fontFamily: UI_FONT, fontSize: 17, fontWeight: 500 }}>
          <Icon name="chevL" size={24} />
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontFamily: UI_FONT, fontSize: 17, fontWeight: 600, color: t.text,
          opacity: scrolled || !title ? 1 : 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0 4px' }}>
          {scrolled ? title : (transparent ? '' : title)}
        </div>
        <div style={{ minWidth: 44, display: 'flex', justifyContent: 'flex-end', paddingRight: 4 }}>{trailing}</div>
      </div>
    </div>
  );
}

Object.assign(window, { BottomNav, Screen, TopBar, NAV_H, HOME_IND, FAB_D, PAD });
