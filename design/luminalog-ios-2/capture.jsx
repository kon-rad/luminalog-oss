// capture.jsx — renders a single screen in a clean device for screenshotting.
const { useState } = React;

function noop() {}

function Frame({ dark, children }) {
  const theme = dark ? DARK : LIGHT;
  return (
    <ThemeContext.Provider value={theme}>
      <IOSDevice dark={dark}>
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: theme.bg }}>
          {children}
        </div>
      </IOSDevice>
    </ThemeContext.Provider>
  );
}

function CaptureApp() {
  const hash = (location.hash.replace('#', '') || 'home').split(',');
  const has = (k) => hash.includes(k);
  const dark = has('dark');
  const which = hash.find(h => ['home','journal','chats','profile','create','detail','chat','voice'].includes(h)) || 'home';

  let screen = null;
  if (which === 'home')    screen = <><HomeScreen loading={false} onOpenEntry={noop} onStartPrompt={noop} /><BottomNav active="home" onTab={noop} onCreate={noop} /></>;
  if (which === 'journal') screen = <><JournalListScreen loading={false} grouped={true} onToggleGroup={noop} onOpenEntry={noop} /><BottomNav active="journal" onTab={noop} onCreate={noop} /></>;
  if (which === 'chats')   screen = <><ChatsScreen loading={false} onOpenChat={noop} onStartText={noop} onStartVoice={noop} /><BottomNav active="chats" onTab={noop} onCreate={noop} /></>;
  if (which === 'profile') screen = <><ProfileScreen isDark={dark} onThemeToggle={noop} onSignOut={noop} /><BottomNav active="profile" onTab={noop} onCreate={noop} /></>;
  if (which === 'create')  screen = <CreateScreen promptText={DAILY_PROMPT} onClose={noop} onSave={noop} />;
  if (which === 'detail')  screen = <JournalDetailScreen entry={ENTRIES[0]} onBack={noop} onUsePrompt={noop} />;
  if (which === 'chat')    screen = <ChatConversationScreen title="Companion" onBack={noop} />;
  if (which === 'voice')   screen = <VoiceCallScreen onEnd={noop} />;

  return (
    <div style={{ display: 'inline-block' }}>
      <Frame dark={dark}>{screen}</Frame>
    </div>
  );
}

const capRoot = ReactDOM.createRoot(document.getElementById('cap'));
function renderCap() { capRoot.render(<CaptureApp key={location.hash} />); }
renderCap();
window.addEventListener('hashchange', renderCap);
