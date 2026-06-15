// app.jsx — root: theme, navigation stack, device frame, demo controls.

const { useState, useEffect, useRef } = React;

function PushView({ kind, closing, children }) {
  // kind: 'push' (slide from right) | 'present' (rise from bottom)
  const [entered, setEntered] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setEntered(true)); return () => cancelAnimationFrame(id); }, []);
  const hidden = !entered || closing;
  const tf = kind === 'present'
    ? (hidden ? 'translateY(100%)' : 'translateY(0)')
    : (hidden ? 'translateX(100%)' : 'translateX(0)');
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 100, transform: tf,
      transition: 'transform .34s cubic-bezier(.32,.72,0,1)',
      boxShadow: kind === 'push' && !hidden ? '-8px 0 24px rgba(0,0,0,0.12)' : 'none' }}>
      {children}
    </div>
  );
}

function App() {
  const hash = (typeof location !== 'undefined' ? location.hash.replace('#','') : '').split(',');
  const has = (k) => hash.includes(k);
  const [dark, setDark] = useState(() => has('dark') || localStorage.getItem('ll-dark') === '1');
  const [newUser, setNewUser] = useState(has('empty'));
  const [tab, setTab] = useState(has('journal') ? 'journal' : has('chats') ? 'chats' : has('profile') ? 'profile' : 'home');
  const [loading, setLoading] = useState(true);
  const [grouped, setGrouped] = useState(true);
  const [modal, setModal] = useState(
    has('detail') ? { type: 'detail', entry: ENTRIES[0] } :
    has('create') ? { type: 'create', prompt: DAILY_PROMPT } :
    has('chat')   ? { type: 'chat', title: 'Companion' } :
    has('voice')  ? { type: 'voice' } : null
  );
  const [closing, setClosing] = useState(false);

  const theme = dark ? DARK : LIGHT;
  useEffect(() => { localStorage.setItem('ll-dark', dark ? '1' : '0'); }, [dark]);

  // scale device to fit viewport
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => {
      const sH = (window.innerHeight - 150) / 874;
      const sW = (window.innerWidth - 28) / 402;
      setScale(Math.min(1, sH, sW));
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  // simulate per-tab load (skeletons)
  useEffect(() => {
    setLoading(true);
    const id = setTimeout(() => setLoading(false), 850);
    return () => clearTimeout(id);
  }, [tab, newUser]);

  const closeModal = (then) => { setClosing(true); setTimeout(() => { setModal(null); setClosing(false); then && then(); }, 330); };
  const openDetail = (e) => setModal({ type: 'detail', entry: e });
  const openCreate = (prompt) => setModal({ type: 'create', prompt });
  const openChat = (chat) => chat.kind === 'voice' ? setModal({ type: 'voice' }) : setModal({ type: 'chat', title: chat.title });
  const usePrompt = (p) => closeModal(() => setTimeout(() => openCreate(p), 30));

  const navHidden = !!modal;

  return (
    <ThemeContext.Provider value={theme}>
      <div style={{ minHeight: '100vh', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
        background: dark ? '#0E0C09' : '#E9E3D8', padding: '22px 16px 30px', boxSizing: 'border-box',
        backgroundImage: dark ? 'radial-gradient(120% 80% at 50% 0%, #1a160f 0%, #0E0C09 60%)' : 'radial-gradient(120% 80% at 50% 0%, #F3EDE2 0%, #E4DDD0 60%)' }}>

        {/* demo control panel */}
        <DemoControls dark={dark} setDark={setDark} newUser={newUser} setNewUser={setNewUser} />

        {/* device */}
        <div style={{ marginTop: 16, height: 874 * scale, width: 402 * scale }}>
         <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <IOSDevice dark={dark}>
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: theme.bg }}>
              {/* active tab */}
              {tab === 'home' && <HomeScreen empty={newUser} loading={loading && !newUser} onOpenEntry={openDetail} onStartPrompt={openCreate} />}
              {tab === 'journal' && <JournalListScreen empty={newUser} loading={loading && !newUser} grouped={grouped} onToggleGroup={() => setGrouped(g => !g)} onOpenEntry={openDetail} />}
              {tab === 'chats' && <ChatsScreen empty={newUser} loading={loading && !newUser} onOpenChat={openChat} onStartText={() => openChat({ kind: 'text', title: 'Companion' })} onStartVoice={() => setModal({ type: 'voice' })} />}
              {tab === 'profile' && <ProfileScreen isDark={dark} onThemeToggle={() => setDark(d => !d)} onSignOut={() => { setNewUser(true); setTab('home'); }} />}

              {/* bottom nav */}
              <BottomNav active={tab} onTab={setTab} onCreate={() => openCreate(undefined)} hidden={navHidden} />

              {/* pushed / presented views */}
              {modal && modal.type === 'detail' && (
                <PushView kind="push" closing={closing}><JournalDetailScreen entry={modal.entry} onBack={() => closeModal()} onUsePrompt={usePrompt} /></PushView>
              )}
              {modal && modal.type === 'create' && (
                <PushView kind="present" closing={closing}><CreateScreen promptText={modal.prompt} onClose={() => closeModal()} onSave={() => closeModal(() => setTab('journal'))} /></PushView>
              )}
              {modal && modal.type === 'chat' && (
                <PushView kind="push" closing={closing}><ChatConversationScreen title={modal.title} onBack={() => closeModal()} /></PushView>
              )}
              {modal && modal.type === 'voice' && (
                <PushView kind="present" closing={closing}><VoiceCallScreen onEnd={() => closeModal()} /></PushView>
              )}
            </div>
          </IOSDevice>
         </div>
        </div>
      </div>
    </ThemeContext.Provider>
  );
}

function DemoControls({ dark, setDark, newUser, setNewUser }) {
  const seg = (active) => ({
    border: 'none', cursor: 'pointer', padding: '7px 14px', borderRadius: 9, fontFamily: UI_FONT, fontSize: 13.5, fontWeight: 600,
    background: active ? (dark ? '#E5A063' : '#CE7F44') : 'transparent', color: active ? (dark ? '#221608' : '#fff') : (dark ? '#A89E8F' : '#7C7468'),
    transition: 'all .15s',
  });
  const wrap = { display: 'inline-flex', gap: 3, padding: 3, borderRadius: 12, background: dark ? '#1D1913' : '#FBF8F3',
    border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: SERIF, fontSize: 21, fontWeight: 600, color: dark ? '#F3EEE4' : '#2B2722', letterSpacing: -0.3 }}>
          LuminaLog <span style={{ fontFamily: UI_FONT, fontSize: 13, fontWeight: 600, color: dark ? '#A89E8F' : '#7C7468', letterSpacing: 0 }}>· iOS prototype</span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <div style={wrap}>
          <button style={seg(!dark)} onClick={() => setDark(false)}>☀ Light</button>
          <button style={seg(dark)} onClick={() => setDark(true)}>☾ Dark</button>
        </div>
        <div style={wrap}>
          <button style={seg(!newUser)} onClick={() => setNewUser(false)}>Has history</button>
          <button style={seg(newUser)} onClick={() => setNewUser(true)}>New user</button>
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
