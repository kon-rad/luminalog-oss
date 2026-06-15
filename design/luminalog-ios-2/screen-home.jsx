// screen-home.jsx — Home: header, hero prompt card, stat cards, recent entries.

function PromptCard({ prompt, onStart }) {
  const t = useTheme();
  return (
    <div style={{ position: 'relative', borderRadius: 26, overflow: 'hidden',
      background: `linear-gradient(160deg, ${t.accent}, ${t.accentDeep})`, color: t.onAccent,
      boxShadow: `0 8px 26px ${t.isDark ? 'rgba(0,0,0,0.45)' : 'rgba(180,110,50,0.28)'}`, padding: '22px 22px 20px' }}>
      {/* soft glow accents */}
      <div style={{ position: 'absolute', top: -50, right: -30, width: 160, height: 160, borderRadius: '50%',
        background: 'rgba(255,255,255,0.14)', filter: 'blur(8px)' }} />
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, opacity: 0.92, marginBottom: 14 }}>
          <Icon name="sparkle" size={17} />
          <span style={{ fontFamily: UI_FONT, fontSize: 12.5, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase' }}>Today's prompt</span>
        </div>
        <p style={{ margin: 0, fontFamily: SERIF, fontSize: 25, lineHeight: 1.28, fontWeight: 500, letterSpacing: -0.2, textWrap: 'pretty' }}>
          "{prompt}"
        </p>
        <button onClick={onStart}
          onPointerDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
          onPointerUp={e => e.currentTarget.style.transform = 'scale(1)'}
          onPointerLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          style={{ marginTop: 18, display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', cursor: 'pointer',
            background: t.onAccent, color: t.accentDeep, padding: '13px 20px', borderRadius: 14,
            fontFamily: UI_FONT, fontSize: 16, fontWeight: 600, letterSpacing: -0.1, transition: 'transform .12s',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
          <Icon name="edit" size={18} /> Start journaling
        </button>
      </div>
    </div>
  );
}

function HomeScreen({ empty, loading, onOpenEntry, onStartPrompt, onShowAll, scrollRef, onScroll }) {
  const t = useTheme();
  const [count, setCount] = React.useState(6);
  const greeting = (() => {
    const h = 9; return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  })();

  return (
    <Screen scrollRef={scrollRef} onScroll={onScroll}>
      <div style={{ padding: `8px ${PAD}px 0` }}>
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <Icon name="bookOpen" size={18} color={t.accent} />
              <span style={{ fontFamily: UI_FONT, fontSize: 13, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase', color: t.accent }}>LuminaLog</span>
            </div>
            <h1 style={{ margin: '8px 0 0', fontFamily: SERIF, fontSize: 30, fontWeight: 600, color: t.text, letterSpacing: -0.4 }}>
              {greeting},<br/>{USER.first}
            </h1>
          </div>
          <Avatar name={USER.name} size={46} />
        </div>

        {empty ? (
          <EmptyHome onStart={onStartPrompt} />
        ) : (
          <>
            <div style={{ marginTop: 22 }}>
              <PromptCard prompt={DAILY_PROMPT} onStart={() => onStartPrompt(DAILY_PROMPT)} />
            </div>

            {/* stat cards */}
            <div style={{ display: 'flex', gap: 12, marginTop: 14 }}>
              <StatCard icon="flame" value={`${USER.streak} days`} label="Current streak" accent />
              <StatCard icon="quote" value={USER.words.toLocaleString()} label="Words written" />
            </div>

            {/* recent entries */}
            <div style={{ marginTop: 26 }}>
              <SectionHeader>Recent entries</SectionHeader>
              {loading ? (
                <div>{[0,1,2,3].map(i => <SkeletonRow key={i} />)}</div>
              ) : (
                <>
                  <div>
                    {ENTRIES.slice(0, count).map((e, i) =>
                      <EntryRow key={e.id} e={e} onOpen={onOpenEntry} last={i === Math.min(count, ENTRIES.length) - 1} />)}
                  </div>
                  {count < ENTRIES.length && (
                    <button onClick={() => setCount(c => Math.min(c + 4, ENTRIES.length))}
                      style={{ width: '100%', marginTop: 14, padding: '13px', borderRadius: 14, cursor: 'pointer',
                        border: `1px solid ${t.hairline}`, background: t.surface, color: t.accent, boxShadow: t.shadowSoft,
                        fontFamily: UI_FONT, fontSize: 15, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      Show more <Icon name="chevD" size={16} />
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>
    </Screen>
  );
}

function EmptyHome({ onStart }) {
  const t = useTheme();
  return (
    <div style={{ marginTop: 30, textAlign: 'center', padding: '10px 6px 0' }}>
      <div style={{ width: 96, height: 96, margin: '0 auto', borderRadius: '50%', background: t.accentTint,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: t.accent }}>
        <Icon name="bookOpen" size={44} />
      </div>
      <h2 style={{ margin: '22px 0 0', fontFamily: SERIF, fontSize: 25, fontWeight: 600, color: t.text, letterSpacing: -0.3 }}>
        Your journal begins here
      </h2>
      <p style={{ margin: '10px auto 0', maxWidth: 290, fontFamily: UI_FONT, fontSize: 16, lineHeight: 1.5, color: t.text2 }}>
        A quiet space that's entirely yours. Start with a single moment from today.
      </p>
      <div style={{ marginTop: 22, background: t.surface, borderRadius: 22, padding: '20px', boxShadow: t.shadowSoft,
        border: `1px solid ${t.hairline}`, textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: t.accent, marginBottom: 10 }}>
          <Icon name="sparkle" size={16} />
          <span style={{ fontFamily: UI_FONT, fontSize: 12, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase' }}>A gentle start</span>
        </div>
        <p style={{ margin: 0, fontFamily: SERIF, fontSize: 21, lineHeight: 1.3, color: t.text, fontWeight: 500 }}>"{DAILY_PROMPT}"</p>
        <button onClick={() => onStart(DAILY_PROMPT)} style={{ marginTop: 16, width: '100%', border: 'none', cursor: 'pointer',
          background: t.accent, color: t.onAccent, padding: '14px', borderRadius: 14, fontFamily: UI_FONT, fontSize: 16, fontWeight: 600,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Icon name="edit" size={18} /> Write your first entry
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { HomeScreen, PromptCard });
