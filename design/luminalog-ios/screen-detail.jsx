// screen-detail.jsx — Journal Detail: type-tag, Main/Insights/Prompts tabs, 4 content variants.

// ── summary card (expandable + regenerate) ──
function SummaryCard({ entry }) {
  const t = useTheme();
  const [open, setOpen] = React.useState(false);
  const [regen, setRegen] = React.useState(false);
  const regenerate = () => { setRegen(true); setTimeout(() => setRegen(false), 1700); };
  return (
    <div style={{ background: t.surface, borderRadius: 18, border: `1px solid ${t.hairline}`, boxShadow: t.shadowSoft,
      padding: '15px 16px', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: t.accent }}>
          <Icon name="sparkle" size={16} />
          <span style={{ fontFamily: UI_FONT, fontSize: 12.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>AI summary</span>
        </div>
        <button onClick={regenerate} disabled={regen} style={{ display: 'flex', alignItems: 'center', gap: 5, border: 'none',
          background: 'transparent', cursor: regen ? 'default' : 'pointer', color: t.text3, fontFamily: UI_FONT, fontSize: 13, fontWeight: 600, padding: 0 }}>
          {regen ? <Spinner color={t.text3} size={15} /> : <Icon name="refresh" size={15} />}{regen ? 'Regenerating' : 'Regenerate'}
        </button>
      </div>
      <p style={{ margin: 0, fontFamily: SERIF, fontSize: 16, lineHeight: 1.55, color: regen ? t.text3 : t.text2,
        display: open ? 'block' : '-webkit-box', WebkitLineClamp: open ? 'none' : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        transition: 'color .3s', opacity: regen ? 0.5 : 1 }}>
        {entry.summary}
      </p>
      <button onClick={() => setOpen(o => !o)} style={{ marginTop: 8, border: 'none', background: 'transparent', cursor: 'pointer',
        color: t.accent, fontFamily: UI_FONT, fontSize: 13.5, fontWeight: 600, padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}>
        {open ? 'Show less' : 'Show more'} <Icon name="chevD" size={14} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>
    </div>
  );
}

// ── audio player ──
function AudioPlayer({ duration }) {
  const t = useTheme();
  const [playing, setPlaying] = React.useState(false);
  const [pos, setPos] = React.useState(0);
  React.useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setPos(p => { if (p >= duration) { setPlaying(false); return duration; } return p + 1; }), 1000);
    return () => clearInterval(id);
  }, [playing, duration]);
  const fmt = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  const pct = (pos / duration) * 100;
  return (
    <div style={{ background: t.surface, borderRadius: 18, border: `1px solid ${t.hairline}`, boxShadow: t.shadowSoft, padding: '16px 16px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <button onClick={() => setPlaying(p => !p)} style={{ width: 50, height: 50, borderRadius: '50%', border: 'none', cursor: 'pointer',
          background: t.accent, color: t.onAccent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: t.shadowSoft }}>
          <Icon name={playing ? 'pause' : 'play'} size={22} style={{ marginLeft: playing ? 0 : 2 }} />
        </button>
        <div style={{ flex: 1 }}>
          {/* waveform track */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2.5, height: 34 }}>
            {Array.from({ length: 38 }).map((_, i) => {
              const h = 8 + Math.abs(Math.sin(i * 1.3) * 22) + (i % 4) * 3;
              const played = (i / 38) * 100 <= pct;
              return <div key={i} style={{ flex: 1, height: Math.min(h, 32), borderRadius: 2,
                background: played ? t.accent : t.surfaceAlt, transition: 'background .2s' }} />;
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, color: t.text3 }}>
            <span>{fmt(pos)}</span><span>{fmt(duration)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── transcript / OCR block ──
function TranscriptBlock({ label, text }) {
  const t = useTheme();
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontFamily: UI_FONT, fontSize: 12.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
        color: t.text3, marginBottom: 8 }}>{label}</div>
      <p style={{ margin: 0, fontFamily: SERIF, fontSize: 18, lineHeight: 1.62, color: t.text, textWrap: 'pretty' }}>{text}</p>
    </div>
  );
}

// ── Main tab content per type ──
function MainTab({ entry }) {
  const t = useTheme();
  return (
    <div>
      <h1 style={{ margin: 0, fontFamily: SERIF, fontSize: 28, fontWeight: 600, color: t.text, letterSpacing: -0.4, lineHeight: 1.18, textWrap: 'pretty' }}>{entry.title}</h1>
      <div style={{ fontFamily: UI_FONT, fontSize: 14, color: t.text3, fontWeight: 500, marginTop: 7 }}>
        {fullDate(entry.date)} · {clockTime(entry.date)}
      </div>

      <div style={{ marginTop: 18 }}><SummaryCard entry={entry} /></div>

      <div style={{ marginTop: 20 }}>
        {entry.type === 'text' && (
          <p style={{ margin: 0, fontFamily: SERIF, fontSize: 18.5, lineHeight: 1.62, color: t.text, textWrap: 'pretty', whiteSpace: 'pre-wrap' }}>{entry.body}</p>
        )}
        {entry.type === 'voice' && (
          <>
            <AudioPlayer duration={entry.duration} />
            <TranscriptBlock label="Transcript" text={entry.body} />
          </>
        )}
        {entry.type === 'video' && (
          <>
            <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden' }}>
              <Placeholder label="video · 16:9" h={206} radius={18} />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}><Icon name="play" size={26} style={{ marginLeft: 3 }} /></div>
              </div>
              <button style={{ position: 'absolute', right: 10, bottom: 10, width: 34, height: 34, borderRadius: 9, border: 'none',
                background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="expand" size={18} /></button>
            </div>
            <TranscriptBlock label="Transcript" text={entry.body} />
          </>
        )}
        {entry.type === 'image' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Array.from({ length: entry.pages || 1 }).map((_, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <Placeholder label={`handwritten page ${i + 1} · tap to zoom`} h={240} radius={16} />
                  <div style={{ position: 'absolute', right: 10, top: 10, width: 32, height: 32, borderRadius: 8,
                    background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="expand" size={16} /></div>
                </div>
              ))}
            </div>
            <TranscriptBlock label="Transcribed text" text={entry.body} />
          </>
        )}
      </div>
    </div>
  );
}

// ── Insights tab ──
const INSIGHTS = [
  { head: 'Themes', icon: 'sparkle', body: 'Presence and the tension between experiencing a moment and documenting it. A recurring pull toward stillness as a deliberate practice rather than a default.' },
  { head: 'Emotions', icon: 'quote', body: 'A grounded contentment threaded with quiet vigilance — you notice beauty but stay aware of how easily it slips past. The tone is gentle, unforced, self-aware.' },
  { head: 'An observation', icon: 'bookOpen', body: 'You frame attention as resistance — "a small act of rebellion." That reframing turns a calm morning into something with stakes, which may be why these entries feel meaningful to you.' },
];

function InsightsTab({ entry }) {
  const t = useTheme();
  const [state, setState] = React.useState(entry.type === 'text' && entry.id === 'e1' ? 'result' : 'empty');
  const generate = () => { setState('loading'); setTimeout(() => setState('result'), 2200); };

  if (state === 'empty') return (
    <GenerateEmpty icon="sparkle" title="Insights for this entry"
      body="Let your companion read this entry and reflect back the themes, emotions, and patterns it notices."
      button="Generate insights" onGenerate={generate} />
  );
  if (state === 'loading') return <GenerateLoading label="Analyzing your entry…" />;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontFamily: UI_FONT, fontSize: 13, color: t.text3, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon name="check" size={15} color={t.accent} /> Saved to this entry
        </span>
        <button onClick={generate} style={{ display: 'flex', alignItems: 'center', gap: 5, border: 'none', background: 'transparent', cursor: 'pointer',
          color: t.accent, fontFamily: UI_FONT, fontSize: 13.5, fontWeight: 600, padding: 0 }}><Icon name="refresh" size={15} /> Regenerate</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {INSIGHTS.map((c, i) => (
          <div key={i} style={{ background: t.surface, borderRadius: 18, border: `1px solid ${t.hairline}`, boxShadow: t.shadowSoft, padding: '16px 17px',
            animation: `ll-rise .5s cubic-bezier(.2,.7,.2,1) ${i * 0.08}s both` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: t.accent, marginBottom: 8 }}>
              <Icon name={c.icon} size={17} />
              <span style={{ fontFamily: UI_FONT, fontSize: 12.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>{c.head}</span>
            </div>
            <p style={{ margin: 0, fontFamily: SERIF, fontSize: 16.5, lineHeight: 1.55, color: t.text, textWrap: 'pretty' }}>{c.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Prompts tab ──
const GEN_PROMPTS = [
  'When was the last time you let a moment simply be, without trying to keep it?',
  'What does "rebellion" against your own habits look like on an ordinary day?',
  'Describe a recent morning in the kind of detail you usually rush past.',
  'What are you afraid you\u2019ll forget if you don\u2019t write it down?',
  'Where in your life are you reaching for the phone instead of the moment?',
];

function PromptsTab({ entry, onUsePrompt }) {
  const t = useTheme();
  const [state, setState] = React.useState('empty');
  const generate = () => { setState('loading'); setTimeout(() => setState('result'), 2000); };

  if (state === 'empty') return (
    <GenerateEmpty icon="quote" title="Prompts from this entry"
      body="Generate five journaling prompts inspired by the themes in this entry — for wherever your reflection wants to go next."
      button="Generate prompts" onGenerate={generate} />
  );
  if (state === 'loading') return <GenerateLoading label="Finding threads to pull…" />;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <span style={{ fontFamily: UI_FONT, fontSize: 13, color: t.text3, fontWeight: 500 }}>5 prompts · tap to write</span>
        <button onClick={generate} style={{ display: 'flex', alignItems: 'center', gap: 5, border: 'none', background: 'transparent', cursor: 'pointer',
          color: t.accent, fontFamily: UI_FONT, fontSize: 13.5, fontWeight: 600, padding: 0 }}><Icon name="refresh" size={15} /> Regenerate</button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
        {GEN_PROMPTS.map((p, i) => (
          <button key={i} onClick={() => onUsePrompt(p)} style={{ display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', width: '100%',
            background: t.surface, borderRadius: 18, border: `1px solid ${t.hairline}`, boxShadow: t.shadowSoft, padding: '16px 16px', cursor: 'pointer',
            animation: `ll-rise .5s cubic-bezier(.2,.7,.2,1) ${i * 0.07}s both` }}>
            <p style={{ margin: 0, flex: 1, fontFamily: SERIF, fontSize: 17, lineHeight: 1.42, color: t.text, fontWeight: 500, textWrap: 'pretty' }}>{p}</p>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: t.accentTint, color: t.accent, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="arrowR" size={19} /></div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── shared generate empty / loading ──
function GenerateEmpty({ icon, title, body, button, onGenerate }) {
  const t = useTheme();
  return (
    <div style={{ textAlign: 'center', padding: '34px 14px 0' }}>
      <div style={{ width: 84, height: 84, margin: '0 auto', borderRadius: '50%', background: t.accentTint, color: t.accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <Icon name={icon} size={38} />
        <div style={{ position: 'absolute', inset: -6, borderRadius: '50%', border: `1.5px dashed ${t.accent}`, opacity: 0.35 }} />
      </div>
      <h2 style={{ margin: '20px 0 0', fontFamily: SERIF, fontSize: 23, fontWeight: 600, color: t.text }}>{title}</h2>
      <p style={{ margin: '10px auto 22px', maxWidth: 300, fontFamily: UI_FONT, fontSize: 15.5, lineHeight: 1.55, color: t.text2 }}>{body}</p>
      <AIButton label={button} loadingLabel="Working…" onClick={onGenerate} />
    </div>
  );
}

function GenerateLoading({ label }) {
  const t = useTheme();
  return (
    <div style={{ textAlign: 'center', padding: '44px 14px 0' }}>
      <div style={{ width: 84, height: 84, margin: '0 auto', borderRadius: '50%', background: t.accentTint, color: t.accent,
        display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'll-pulse 1.6s ease-in-out infinite' }}>
        <Icon name="sparkle" size={38} />
      </div>
      <h2 style={{ margin: '22px 0 0', fontFamily: SERIF, fontSize: 21, fontWeight: 600, color: t.text }}>{label}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 26 }}>
        {[ '92%','78%','85%' ].map((w, i) => (
          <div key={i} className="ll-shimmer" style={{ height: 13, width: w, borderRadius: 7, background: t.surfaceAlt, margin: '0 auto' }} />
        ))}
      </div>
    </div>
  );
}

// ── detail screen ──
function DetailTab({ id, active, onClick, children }) {
  const t = useTheme();
  return (
    <button onClick={onClick} style={{ flex: 1, position: 'relative', border: 'none', background: 'transparent', cursor: 'pointer',
      padding: '12px 0 11px', fontFamily: UI_FONT, fontSize: 15, fontWeight: 600, letterSpacing: -0.1,
      color: active ? t.text : t.text3, transition: 'color .2s' }}>
      {children}
      <div style={{ position: 'absolute', left: '20%', right: '20%', bottom: 0, height: 2.5, borderRadius: 3,
        background: t.accent, transform: active ? 'scaleX(1)' : 'scaleX(0)', transition: 'transform .25s', transformOrigin: 'center' }} />
    </button>
  );
}

function JournalDetailScreen({ entry, onBack, onUsePrompt }) {
  const t = useTheme();
  const [tab, setTab] = React.useState('main');
  const [scrolled, setScrolled] = React.useState(false);
  return (
    <div className="ll-scroll" onScroll={e => setScrolled(e.target.scrollTop > 8)}
      style={{ position: 'absolute', inset: 0, overflowY: 'auto', background: t.bg }}>
      <TopBar title={entry.title} onBack={onBack} scrolled={scrolled}
        trailing={<TypePill type={entry.type} />} />
      {/* tab bar */}
      <div style={{ position: 'sticky', top: 90, zIndex: 25, background: t.bg, display: 'flex', padding: `0 ${PAD}px`,
        borderBottom: `1px solid ${t.hairline}` }}>
        <DetailTab active={tab === 'main'} onClick={() => setTab('main')}>Main</DetailTab>
        <DetailTab active={tab === 'insights'} onClick={() => setTab('insights')}>Insights</DetailTab>
        <DetailTab active={tab === 'prompts'} onClick={() => setTab('prompts')}>Prompts</DetailTab>
      </div>
      <div style={{ padding: `20px ${PAD}px ${HOME_IND + 30}px` }}>
        {tab === 'main' && <MainTab entry={entry} />}
        {tab === 'insights' && <InsightsTab entry={entry} />}
        {tab === 'prompts' && <PromptsTab entry={entry} onUsePrompt={onUsePrompt} />}
      </div>
    </div>
  );
}

Object.assign(window, { JournalDetailScreen });
