// screen-chats.jsx — Chats list: history, new-chat disclosure, swipe-to-delete, states.

function ChatRow({ chat, onOpen, onDelete }) {
  const t = useTheme();
  const [offset, setOffset] = React.useState(0);
  const start = React.useRef(null);
  const isVoice = chat.kind === 'voice';
  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderBottom: `1px solid ${t.hairline}` }}>
      {/* delete action behind */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'flex-end', alignItems: 'stretch', background: '#E5544B' }}>
        <button onClick={() => onDelete(chat.id)} style={{ width: 76, border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
          <Icon name="trash" size={20} /><span style={{ fontFamily: UI_FONT, fontSize: 12, fontWeight: 600 }}>Delete</span>
        </button>
      </div>
      <div
        onPointerDown={e => start.current = e.clientX}
        onPointerMove={e => { if (start.current != null) { const d = e.clientX - start.current; if (d < 0) setOffset(Math.max(d, -76)); } }}
        onPointerUp={e => { const d = e.clientX - start.current; setOffset(d < -38 ? -76 : 0); start.current = null; }}
        onClick={() => { if (offset === 0) onOpen(chat); else setOffset(0); }}
        style={{ position: 'relative', background: t.bg, transform: `translateX(${offset}px)`, transition: start.current == null ? 'transform .25s' : 'none',
          display: 'flex', gap: 13, padding: '14px 0', cursor: 'pointer', alignItems: 'center' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, background: isVoice ? t.accentTint : t.surfaceAlt,
          color: isVoice ? t.accent : t.text2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={isVoice ? 'mic' : 'chat'} size={22} filled={!isVoice} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
            <span style={{ fontFamily: UI_FONT, fontSize: 16.5, fontWeight: 600, color: t.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chat.title}</span>
            <span style={{ fontFamily: UI_FONT, fontSize: 13, color: t.text3, flexShrink: 0 }}>{relDay(chat.date)}</span>
          </div>
          <p style={{ margin: '3px 0 0', fontFamily: UI_FONT, fontSize: 14.5, lineHeight: 1.4, color: t.text2,
            display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{chat.snippet}</p>
        </div>
      </div>
    </div>
  );
}

function ChatsScreen({ empty, loading, onOpenChat, onStartText, onStartVoice, scrollRef, onScroll }) {
  const t = useTheme();
  const [list, setList] = React.useState(CHATS);
  const [menu, setMenu] = React.useState(false);

  return (
    <Screen scrollRef={scrollRef} onScroll={onScroll}>
      <div style={{ padding: `8px ${PAD}px 0` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ margin: 0, fontFamily: UI_FONT, fontSize: 34, fontWeight: 700, color: t.text, letterSpacing: -0.6 }}>Chats</h1>
          <button onClick={() => setMenu(true)} aria-label="New chat" style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: t.accent, color: t.onAccent, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: t.shadowSoft }}>
            <Icon name="plus" size={24} />
          </button>
        </div>
        <p style={{ margin: '6px 0 0', fontFamily: UI_FONT, fontSize: 15, color: t.text2, lineHeight: 1.45 }}>
          A companion that knows your journal and remembers what matters to you.
        </p>

        {loading ? (
          <div style={{ marginTop: 16 }}>{[0,1,2,3].map(i => <SkeletonRow key={i} />)}</div>
        ) : (empty || list.length === 0) ? (
          <ChatsEmpty onStartText={onStartText} onStartVoice={onStartVoice} />
        ) : (
          <div style={{ marginTop: 12 }}>
            {list.map(c => <ChatRow key={c.id} chat={c} onOpen={onOpenChat} onDelete={id => setList(l => l.filter(x => x.id !== id))} />)}
          </div>
        )}
      </div>

      <ActionSheet open={menu} onClose={() => setMenu(false)} title="Start a new conversation"
        actions={[
          { label: 'Start Text Chat', icon: 'chat', bold: true, onClick: onStartText },
          { label: 'Start Voice Chat', icon: 'mic', bold: true, onClick: onStartVoice },
        ]} />
    </Screen>
  );
}

function ChatsEmpty({ onStartText, onStartVoice }) {
  const t = useTheme();
  return (
    <div style={{ marginTop: 40, textAlign: 'center' }}>
      <div style={{ width: 96, height: 96, margin: '0 auto', borderRadius: '50%', position: 'relative',
        background: `linear-gradient(150deg, ${t.accent}, ${t.accentDeep})`, color: t.onAccent,
        display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: t.shadow }}>
        <Icon name="chat" size={42} filled />
      </div>
      <h2 style={{ margin: '22px 0 0', fontFamily: SERIF, fontSize: 25, fontWeight: 600, color: t.text }}>Talk to your journal</h2>
      <p style={{ margin: '10px auto 0', maxWidth: 290, fontFamily: UI_FONT, fontSize: 16, lineHeight: 1.5, color: t.text2 }}>
        Ask a question, think out loud, or just say hello. Your companion already knows your story.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 26 }}>
        <button onClick={onStartText} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, border: 'none', cursor: 'pointer',
          background: t.accent, color: t.onAccent, padding: '15px', borderRadius: 16, fontFamily: UI_FONT, fontSize: 16.5, fontWeight: 600, boxShadow: t.shadowSoft }}>
          <Icon name="chat" size={20} /> Start Text Chat
        </button>
        <button onClick={onStartVoice} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, cursor: 'pointer',
          background: t.surface, color: t.accent, border: `1px solid ${t.hairline}`, padding: '15px', borderRadius: 16, fontFamily: UI_FONT, fontSize: 16.5, fontWeight: 600, boxShadow: t.shadowSoft }}>
          <Icon name="mic" size={20} /> Start Voice Chat
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { ChatsScreen });
