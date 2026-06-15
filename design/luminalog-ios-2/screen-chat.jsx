// screen-chat.jsx — Text conversation with the AI companion (streaming, retry).

function Bubble({ from, children, error }) {
  const t = useTheme();
  const ai = from === 'ai';
  return (
    <div style={{ display: 'flex', justifyContent: ai ? 'flex-start' : 'flex-end', marginBottom: 12 }}>
      <div style={{ maxWidth: '82%', padding: '11px 15px', borderRadius: 22,
        borderBottomLeftRadius: ai ? 7 : 22, borderBottomRightRadius: ai ? 22 : 7,
        background: ai ? t.surface : t.accent, color: ai ? t.text : t.onAccent,
        border: ai ? `1px solid ${t.hairline}` : 'none', boxShadow: ai ? t.shadowSoft : 'none',
        fontFamily: ai ? SERIF : UI_FONT, fontSize: ai ? 16.5 : 16, lineHeight: 1.5, letterSpacing: ai ? 0 : -0.1, textWrap: 'pretty' }}>
        {children}
        {error && <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, fontFamily: UI_FONT, fontSize: 12.5, opacity: 0.9 }}>
          <Icon name="refresh" size={13} /> Failed to send · Tap to retry</div>}
      </div>
    </div>
  );
}

function TypingDots() {
  const t = useTheme();
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
      <div style={{ padding: '14px 16px', borderRadius: 22, borderBottomLeftRadius: 7, background: t.surface, border: `1px solid ${t.hairline}`,
        display: 'flex', gap: 5 }}>
        {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: t.text3,
          animation: `ll-dot 1.2s ease-in-out ${i * 0.18}s infinite` }} />)}
      </div>
    </div>
  );
}

function ChatConversationScreen({ onBack, title }) {
  const t = useTheme();
  const [msgs, setMsgs] = React.useState(CHAT_THREAD);
  const [input, setInput] = React.useState('');
  const [typing, setTyping] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const bodyRef = React.useRef(null);

  React.useEffect(() => { const el = bodyRef.current; if (el) el.scrollTop = el.scrollHeight; }, [msgs, typing]);

  const send = () => {
    if (!input.trim()) return;
    const txt = input.trim(); setInput('');
    setMsgs(m => [...m, { from: 'user', text: txt }]);
    setTyping(true);
    setTimeout(() => {
      setTyping(false);
      setMsgs(m => [...m, { from: 'ai', text: "I hear you. Let's stay with that for a moment — what does it bring up when you say it out loud?" }]);
    }, 1900);
  };

  return (
    <div style={{ position: 'absolute', inset: 0, background: t.bg, display: 'flex', flexDirection: 'column', zIndex: 100 }}>
      <TopBar title={title || 'Companion'} onBack={onBack} scrolled={scrolled} />
      <div ref={bodyRef} className="ll-scroll" onScroll={e => setScrolled(e.target.scrollTop > 8)}
        style={{ flex: 1, overflowY: 'auto', padding: `12px ${PAD}px 8px` }}>
        <div style={{ textAlign: 'center', margin: '4px 0 18px' }}>
          <Avatar name="Lumina AI" size={56} />
          <p style={{ margin: '10px auto 0', maxWidth: 260, fontFamily: UI_FONT, fontSize: 13, color: t.text3, lineHeight: 1.45 }}>
            Your companion has read your journal and remembers your bio. Conversations stay private.
          </p>
        </div>
        {msgs.map((m, i) => <Bubble key={i} from={m.from} error={m.error}>{m.text}</Bubble>)}
        {typing && <TypingDots />}
      </div>

      {/* input bar */}
      <div style={{ borderTop: `1px solid ${t.hairline}`, background: t.bgElev, padding: `10px ${PAD}px`, paddingBottom: HOME_IND + 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 9 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, background: t.surface, borderRadius: 22,
            border: `1px solid ${t.hairline}`, padding: '7px 8px 7px 16px', minHeight: 42, boxSizing: 'border-box' }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="Share what's on your mind…" style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontFamily: UI_FONT, fontSize: 16, color: t.text, minWidth: 0 }} />
            <button aria-label="Dictate" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: t.text3, padding: 0, display: 'flex' }}>
              <Icon name="mic" size={21} />
            </button>
          </div>
          <button onClick={send} aria-label="Send" disabled={!input.trim()} style={{ width: 42, height: 42, borderRadius: '50%', border: 'none',
            cursor: input.trim() ? 'pointer' : 'default', background: input.trim() ? t.accent : t.surfaceAlt, color: input.trim() ? t.onAccent : t.text3,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background .2s' }}>
            <Icon name="send" size={20} style={{ marginLeft: -1 }} />
          </button>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { ChatConversationScreen });
