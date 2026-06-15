// screen-voice.jsx — Voice call: audio-reactive orb, transcript mode, call states.

const VOICE_TRANSCRIPT = [
  { from: 'ai',   text: "Hi Anna. I'm here. No screen to look at — just talk to me. How are you arriving tonight?" },
  { from: 'user', text: "Tired, honestly. But a good kind of tired." },
  { from: 'ai',   text: "A good kind of tired. That sounds like a day that asked something of you and you gave it. What filled it?" },
];

// the calming audio-reactive orb
function Orb({ state, accent }) {
  // state: connecting | listening | speaking
  const speaking = state === 'speaking';
  const listening = state === 'listening';
  return (
    <div style={{ position: 'relative', width: 240, height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* outer rings react to who's speaking */}
      {[0,1,2].map(i => (
        <div key={i} style={{ position: 'absolute', inset: 0, borderRadius: '50%',
          border: `1.5px solid ${accent}`, opacity: 0.25 - i * 0.06,
          animation: `ll-ring ${speaking ? 2.2 : 3.4}s ease-out ${i * 0.5}s infinite` }} />
      ))}
      {/* core orb */}
      <div style={{ position: 'relative', width: 150, height: 150, borderRadius: '50%',
        background: `radial-gradient(circle at 38% 32%, ${accent}, ${accent}cc 45%, ${accent}55 100%)`,
        boxShadow: `0 0 60px ${accent}88, inset 0 0 40px rgba(255,255,255,0.25)`,
        animation: `${speaking ? 'll-orb-speak 0.9s' : 'll-orb-breathe 4s'} ease-in-out infinite`,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* inner waveform when speaking */}
        {speaking && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 40 }}>
            {[0,1,2,3,4].map(i => <div key={i} style={{ width: 5, borderRadius: 3, background: 'rgba(255,255,255,0.9)',
              height: 40, animation: `ll-wave 0.7s ease-in-out ${i * 0.1}s infinite` }} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function VoiceCallScreen({ onEnd }) {
  const accent = '#E5A063';
  const [phase, setPhase] = React.useState('connecting'); // connecting | live | ended
  const [speaker, setSpeaker] = React.useState('listening'); // listening | speaking
  const [muted, setMuted] = React.useState(false);
  const [mode, setMode] = React.useState('orb'); // orb | transcript
  const [secs, setSecs] = React.useState(0);

  React.useEffect(() => { const id = setTimeout(() => setPhase('live'), 1900); return () => clearTimeout(id); }, []);
  React.useEffect(() => {
    if (phase !== 'live') return;
    const tick = setInterval(() => setSecs(s => s + 1), 1000);
    const turn = setInterval(() => setSpeaker(s => s === 'speaking' ? 'listening' : 'speaking'), 3600);
    return () => { clearInterval(tick); clearInterval(turn); };
  }, [phase]);

  const fmt = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
  const stateLabel = phase === 'connecting' ? 'Connecting…'
    : speaker === 'speaking' ? 'Lumina is speaking' : 'Listening…';

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 110, display: 'flex', flexDirection: 'column',
      background: 'radial-gradient(130% 90% at 50% 8%, #2A2218 0%, #16120C 55%, #0C0A07 100%)', color: '#F3EEE4' }}>
      {/* top status */}
      <div style={{ paddingTop: 58, textAlign: 'center' }}>
        <div style={{ fontFamily: UI_FONT, fontSize: 13, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: accent, opacity: 0.9 }}>
          Voice companion
        </div>
        <div style={{ fontFamily: UI_FONT, fontSize: 15, color: 'rgba(243,238,228,0.6)', marginTop: 5 }}>
          {phase === 'live' ? fmt(secs) : stateLabel}
        </div>
      </div>

      {/* main area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        {mode === 'orb' ? (
          <>
            <Orb state={phase === 'connecting' ? 'connecting' : speaker} accent={accent} />
            <div style={{ marginTop: 38, fontFamily: SERIF, fontSize: 22, fontWeight: 500, color: '#F3EEE4', letterSpacing: -0.2,
              transition: 'opacity .3s' }}>{stateLabel}</div>
          </>
        ) : (
          <div className="ll-scroll" style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: '10px 20px 20px' }}>
            {VOICE_TRANSCRIPT.map((m, i) => {
              const ai = m.from === 'ai';
              return (
                <div key={i} style={{ display: 'flex', justifyContent: ai ? 'flex-start' : 'flex-end', marginBottom: 12 }}>
                  <div style={{ maxWidth: '84%', padding: '11px 15px', borderRadius: 20, borderBottomLeftRadius: ai ? 6 : 20, borderBottomRightRadius: ai ? 20 : 6,
                    background: ai ? 'rgba(255,255,255,0.07)' : accent, color: ai ? '#F3EEE4' : '#221608',
                    fontFamily: ai ? SERIF : UI_FONT, fontSize: 16, lineHeight: 1.5 }}>{m.text}</div>
                </div>
              );
            })}
            {speaker === 'speaking' && <div style={{ display: 'flex', gap: 5, padding: '4px 4px' }}>
              {[0,1,2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.5)',
                animation: `ll-dot 1.2s ease-in-out ${i*0.18}s infinite` }} />)}</div>}
          </div>
        )}
      </div>

      {/* controls */}
      <div style={{ paddingBottom: HOME_IND + 22, paddingTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 26 }}>
          <CallBtn icon={muted ? 'muted' : 'mic'} label={muted ? 'Unmute' : 'Mute'} active={muted} onClick={() => setMuted(m => !m)} />
          <button onClick={onEnd} aria-label="End call" style={{ width: 72, height: 72, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: '#E5544B', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 20px rgba(229,84,75,0.5)' }}>
            <Icon name="phoneDown" size={30} />
          </button>
          <CallBtn icon={mode === 'orb' ? 'chat' : 'waveform'} label={mode === 'orb' ? 'Transcript' : 'Animation'} onClick={() => setMode(m => m === 'orb' ? 'transcript' : 'orb')} />
        </div>
      </div>
    </div>
  );
}

function CallBtn({ icon, label, active, onClick }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <button onClick={onClick} aria-label={label} style={{ width: 60, height: 60, borderRadius: '50%', cursor: 'pointer',
        border: '1px solid rgba(255,255,255,0.16)', background: active ? '#F3EEE4' : 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)',
        color: active ? '#16120C' : '#F3EEE4', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={25} />
      </button>
      <span style={{ fontFamily: UI_FONT, fontSize: 12.5, color: 'rgba(243,238,228,0.7)', fontWeight: 500 }}>{label}</span>
    </div>
  );
}

Object.assign(window, { VoiceCallScreen });
