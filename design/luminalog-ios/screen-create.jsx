// screen-create.jsx — Create Journal Entry: prompt banner, editor, STT, media row.

function MediaBtn({ icon, label, onClick }) {
  const t = useTheme();
  return (
    <button onClick={onClick} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
      border: 'none', background: 'transparent', cursor: 'pointer', color: t.text2, padding: '4px 0' }}>
      <div style={{ width: 48, height: 48, borderRadius: 15, background: t.surfaceAlt, color: t.text,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={23} /></div>
      <span style={{ fontFamily: UI_FONT, fontSize: 11.5, fontWeight: 500 }}>{label}</span>
    </button>
  );
}

function CreateScreen({ promptText, onClose, onSave }) {
  const t = useTheme();
  const [text, setText] = React.useState('');
  const [listening, setListening] = React.useState(false);
  const [photoSheet, setPhotoSheet] = React.useState(false);
  const [media, setMedia] = React.useState([]); // {kind,label}
  const [saving, setSaving] = React.useState(false);
  const taRef = React.useRef(null);

  // simulate live speech-to-text
  React.useEffect(() => {
    if (!listening) return;
    const chunks = [' I keep coming back to', ' the way the light', ' moved across the wall', ' before I was fully awake,', ' how it asked nothing of me.'];
    let i = 0;
    const id = setInterval(() => {
      if (i >= chunks.length) { setListening(false); return; }
      setText(prev => prev + chunks[i]); i++;
    }, 900);
    return () => clearInterval(id);
  }, [listening]);

  React.useEffect(() => { const el = taRef.current; if (el) { el.style.height = 'auto'; el.style.height = Math.max(el.scrollHeight, 120) + 'px'; } }, [text]);

  const hasContent = text.trim().length > 0 || media.length > 0;
  const save = () => { setSaving(true); setTimeout(() => onSave && onSave(), 1100); };

  const addPhoto = () => setMedia(m => [...m, { kind: 'image', label: 'Photo ' + (m.filter(x=>x.kind==='image').length+1) }]);
  const addVideo = () => setMedia(m => [...m, { kind: 'video', label: 'Video clip' }]);

  return (
    <div style={{ position: 'absolute', inset: 0, background: t.bg, display: 'flex', flexDirection: 'column', zIndex: 100 }}>
      {/* top bar */}
      <div style={{ paddingTop: 46, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '46px 16px 12px',
        borderBottom: `1px solid ${t.hairline}` }}>
        <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: t.accent,
          fontFamily: UI_FONT, fontSize: 17, fontWeight: 500, padding: 0 }}>Cancel</button>
        <span style={{ fontFamily: UI_FONT, fontSize: 17, fontWeight: 600, color: t.text }}>Journal Entry</span>
        <button onClick={save} disabled={!hasContent || saving} style={{ border: 'none', background: 'transparent',
          cursor: hasContent ? 'pointer' : 'default', color: hasContent ? t.accent : t.text3,
          fontFamily: UI_FONT, fontSize: 17, fontWeight: 700, padding: 0, minWidth: 50, textAlign: 'right',
          display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
          {saving ? <><Spinner color={t.accent} size={16} /></> : 'Save'}
        </button>
      </div>

      {/* scroll body */}
      <div className="ll-scroll" style={{ flex: 1, overflowY: 'auto', padding: `16px ${PAD}px 8px` }}>
        {promptText && (
          <div style={{ display: 'flex', gap: 12, background: t.accentTint, borderRadius: 16, padding: '15px 16px', marginBottom: 18,
            border: `1px solid ${t.isDark ? 'transparent' : 'rgba(206,127,68,0.14)'}` }}>
            <Icon name="quote" size={20} color={t.accent} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontFamily: UI_FONT, fontSize: 11.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: t.accent, marginBottom: 4 }}>Responding to</div>
              <p style={{ margin: 0, fontFamily: SERIF, fontSize: 17.5, lineHeight: 1.35, color: t.text, fontWeight: 500, textWrap: 'pretty' }}>{promptText}</p>
            </div>
          </div>
        )}

        <textarea ref={taRef} value={text} onChange={e => setText(e.target.value)} placeholder="Write what's on your mind…"
          style={{ width: '100%', minHeight: 120, border: 'none', outline: 'none', resize: 'none', background: 'transparent',
            fontFamily: SERIF, fontSize: 19, lineHeight: 1.6, color: t.text, padding: 0, boxSizing: 'border-box' }} />

        {/* attached media strip */}
        {media.length > 0 && (
          <div className="ll-scroll" style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '14px 0 4px' }}>
            {media.map((m, i) => (
              <div key={i} style={{ position: 'relative', flexShrink: 0 }}>
                <Placeholder label={m.kind} h={84} radius={12} style={{ width: 84 }} />
                <button onClick={() => setMedia(media.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -6, right: -6,
                  width: 22, height: 22, borderRadius: '50%', border: `2px solid ${t.bg}`, background: '#2B2722', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}><Icon name="close" size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* speech-to-text + media row (above keyboard) */}
      <div style={{ borderTop: `1px solid ${t.hairline}`, background: t.bgElev, padding: `12px ${PAD}px 14px` }}>
        {/* STT button */}
        <button onClick={() => setListening(l => !l)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          border: 'none', borderRadius: 14, padding: '13px', cursor: 'pointer', marginBottom: 12,
          background: listening ? t.accent : t.surfaceAlt, color: listening ? t.onAccent : t.text,
          fontFamily: UI_FONT, fontSize: 15.5, fontWeight: 600, transition: 'background .2s' }}>
          {listening ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 18 }}>
                {[0,1,2,3,4].map(i => <div key={i} style={{ width: 3, borderRadius: 2, background: t.onAccent,
                  height: 18, animation: `ll-wave 0.9s ease-in-out ${i * 0.12}s infinite` }} />)}
              </div>
              Listening… tap to stop
            </>
          ) : (<><Icon name="mic" size={20} /> Dictate with speech-to-text</>)}
        </button>
        {/* media capture row */}
        <div style={{ display: 'flex', gap: 6 }}>
          <MediaBtn icon="mic" label="Record" onClick={() => {}} />
          <MediaBtn icon="photo" label="Photo" onClick={() => setPhotoSheet(true)} />
          <MediaBtn icon="video" label="Video" onClick={addVideo} />
        </div>
      </div>

      <ActionSheet open={photoSheet} onClose={() => setPhotoSheet(false)} title="Add a photo of a journal page — OCR will transcribe it"
        actions={[
          { label: 'Take Photo', icon: 'camera', onClick: addPhoto },
          { label: 'Choose from Library', icon: 'photo', onClick: addPhoto },
        ]} />
    </div>
  );
}

Object.assign(window, { CreateScreen });
