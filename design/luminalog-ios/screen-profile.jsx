// screen-profile.jsx — Profile & Settings: bio view/edit, photo sheet, delete confirm.

function SettingsRow({ icon, iconBg, title, detail, destructive, onClick, last }) {
  const t = useTheme();
  const [press, setPress] = React.useState(false);
  return (
    <button onClick={onClick}
      onPointerDown={() => setPress(true)} onPointerUp={() => setPress(false)} onPointerLeave={() => setPress(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 13, width: '100%', border: 'none', cursor: 'pointer', textAlign: 'left',
        background: press ? t.surfaceAlt : 'transparent', padding: '13px 16px', position: 'relative' }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: iconBg || t.accentTint,
        color: destructive ? '#E5544B' : t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} />
      </div>
      <span style={{ flex: 1, fontFamily: UI_FONT, fontSize: 16.5, color: destructive ? '#E5544B' : t.text, fontWeight: destructive ? 600 : 400 }}>{title}</span>
      {detail && <span style={{ fontFamily: UI_FONT, fontSize: 15, color: t.text3 }}>{detail}</span>}
      {!destructive && <Icon name="chevR" size={16} color={t.text3} />}
      {!last && <div style={{ position: 'absolute', left: 59, right: 0, bottom: 0, height: 1, background: t.hairline }} />}
    </button>
  );
}

function ProfileScreen({ onThemeToggle, isDark, onSignOut, scrollRef, onScroll }) {
  const t = useTheme();
  const [editingBio, setEditingBio] = React.useState(false);
  const [bio, setBio] = React.useState(USER.bio);
  const [draft, setDraft] = React.useState(USER.bio);
  const [photoSheet, setPhotoSheet] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  return (
    <Screen scrollRef={scrollRef} onScroll={onScroll}>
      <div style={{ padding: `8px ${PAD}px 0` }}>
        <h1 style={{ margin: 0, fontFamily: UI_FONT, fontSize: 34, fontWeight: 700, color: t.text, letterSpacing: -0.6 }}>Profile</h1>

        {/* profile card */}
        <div style={{ marginTop: 16, background: t.surface, borderRadius: 22, border: `1px solid ${t.hairline}`, boxShadow: t.shadowSoft,
          padding: '22px 20px', textAlign: 'center' }}>
          <div style={{ position: 'relative', width: 92, height: 92, margin: '0 auto' }}>
            <Avatar name={USER.name} size={92} />
            <button onClick={() => setPhotoSheet(true)} aria-label="Change photo" style={{ position: 'absolute', right: -2, bottom: -2,
              width: 32, height: 32, borderRadius: '50%', border: `3px solid ${t.surface}`, background: t.accent, color: t.onAccent, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="camera" size={16} /></button>
          </div>
          <h2 style={{ margin: '14px 0 0', fontFamily: UI_FONT, fontSize: 22, fontWeight: 700, color: t.text, letterSpacing: -0.3,
            display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            {USER.name} <Icon name="edit" size={16} color={t.text3} />
          </h2>
          <div style={{ fontFamily: UI_FONT, fontSize: 14, color: t.text3, marginTop: 3 }}>{USER.streak}-day streak · {USER.words.toLocaleString()} words</div>
        </div>

        {/* bio */}
        <div style={{ marginTop: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px 8px' }}>
            <span style={{ fontFamily: UI_FONT, fontSize: 13, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: t.text3 }}>About you</span>
            {editingBio
              ? <button onClick={() => { setBio(draft); setEditingBio(false); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: t.accent, fontFamily: UI_FONT, fontSize: 14, fontWeight: 700 }}>Done</button>
              : <button onClick={() => { setDraft(bio); setEditingBio(true); }} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: t.accent, fontFamily: UI_FONT, fontSize: 14, fontWeight: 600 }}>Edit</button>}
          </div>
          <div style={{ background: t.surface, borderRadius: 18, border: `1px solid ${t.hairline}`, boxShadow: t.shadowSoft, padding: '16px' }}>
            {editingBio ? (
              <textarea autoFocus value={draft} onChange={e => setDraft(e.target.value)} rows={5}
                style={{ width: '100%', border: 'none', outline: 'none', resize: 'none', background: 'transparent',
                  fontFamily: SERIF, fontSize: 16.5, lineHeight: 1.55, color: t.text, boxSizing: 'border-box' }} />
            ) : (
              <p style={{ margin: 0, fontFamily: SERIF, fontSize: 16.5, lineHeight: 1.55, color: t.text, textWrap: 'pretty' }}>{bio}</p>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '8px 6px 0', color: t.text3 }}>
            <Icon name="sparkle" size={14} style={{ marginTop: 1, flexShrink: 0 }} />
            <span style={{ fontFamily: UI_FONT, fontSize: 12.5, lineHeight: 1.45 }}>Your bio helps your AI companion know you better. It's private and never shared.</span>
          </div>
        </div>

        {/* appearance */}
        <div style={{ marginTop: 22, background: t.surface, borderRadius: 16, border: `1px solid ${t.hairline}`, boxShadow: t.shadowSoft, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 16px' }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: t.accentTint, color: t.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="sparkle" size={18} />
            </div>
            <span style={{ flex: 1, fontFamily: UI_FONT, fontSize: 16.5, color: t.text }}>Dark mode</span>
            <Toggle on={isDark} onChange={onThemeToggle} />
          </div>
        </div>

        {/* settings group */}
        <div style={{ marginTop: 18, background: t.surface, borderRadius: 16, border: `1px solid ${t.hairline}`, boxShadow: t.shadowSoft, overflow: 'hidden' }}>
          <SettingsRow icon="crown" title="Subscription" detail={USER.plan} onClick={() => {}} />
          <SettingsRow icon="signout" title="Sign Out" onClick={onSignOut} last />
        </div>
        <div style={{ marginTop: 18, background: t.surface, borderRadius: 16, border: `1px solid ${t.hairline}`, boxShadow: t.shadowSoft, overflow: 'hidden' }}>
          <SettingsRow icon="trash" iconBg={t.isDark ? 'rgba(229,84,75,0.16)' : 'rgba(229,84,75,0.1)'} title="Delete Account" destructive onClick={() => setDeleteOpen(true)} last />
        </div>
        <p style={{ textAlign: 'center', fontFamily: UI_FONT, fontSize: 12.5, color: t.text3, marginTop: 22 }}>LuminaLog · version 1.0</p>
      </div>

      <ActionSheet open={photoSheet} onClose={() => setPhotoSheet(false)} title="Update profile photo"
        actions={[{ label: 'Take Photo', icon: 'camera' }, { label: 'Choose from Library', icon: 'photo' }]} />

      <DeleteAccountSheet open={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={onSignOut} />
    </Screen>
  );
}

function Toggle({ on, onChange }) {
  const t = useTheme();
  return (
    <button onClick={onChange} role="switch" aria-checked={on} style={{ width: 51, height: 31, borderRadius: 999, border: 'none', cursor: 'pointer',
      background: on ? t.accent : (t.isDark ? '#3A352C' : '#E4DFD5'), padding: 2, transition: 'background .2s', position: 'relative' }}>
      <div style={{ width: 27, height: 27, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        transform: on ? 'translateX(20px)' : 'translateX(0)', transition: 'transform .22s cubic-bezier(.32,.72,0,1)' }} />
    </button>
  );
}

// type-to-confirm delete
function DeleteAccountSheet({ open, onClose, onConfirm }) {
  const t = useTheme();
  const [val, setVal] = React.useState('');
  const ok = val.trim().toUpperCase() === 'DELETE';
  React.useEffect(() => { if (!open) setVal(''); }, [open]);
  return (
    <Sheet open={open} onClose={onClose}>
      <div style={{ background: t.surface, borderRadius: 22, padding: '24px 22px', marginBottom: 8 }}>
        <div style={{ width: 56, height: 56, margin: '0 auto 14px', borderRadius: '50%', background: 'rgba(229,84,75,0.12)', color: '#E5544B',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="trash" size={26} /></div>
        <h2 style={{ margin: 0, textAlign: 'center', fontFamily: UI_FONT, fontSize: 21, fontWeight: 700, color: t.text }}>Delete your account?</h2>
        <p style={{ margin: '10px auto 0', textAlign: 'center', maxWidth: 300, fontFamily: UI_FONT, fontSize: 15, lineHeight: 1.5, color: t.text2 }}>
          This permanently erases your journal, insights, and conversations. This cannot be undone. Type <b style={{ color: t.text }}>DELETE</b> to confirm.
        </p>
        <input value={val} onChange={e => setVal(e.target.value)} placeholder="DELETE" style={{ width: '100%', marginTop: 16, textAlign: 'center',
          border: `1.5px solid ${ok ? '#E5544B' : t.hairline}`, borderRadius: 13, padding: '13px', background: t.bg, color: t.text, boxSizing: 'border-box',
          fontFamily: UI_FONT, fontSize: 17, fontWeight: 600, letterSpacing: 2, outline: 'none' }} />
        <button onClick={() => ok && onConfirm()} disabled={!ok} style={{ width: '100%', marginTop: 14, border: 'none', borderRadius: 14, padding: '15px', cursor: ok ? 'pointer' : 'default',
          background: ok ? '#E5544B' : t.surfaceAlt, color: ok ? '#fff' : t.text3, fontFamily: UI_FONT, fontSize: 16.5, fontWeight: 700, transition: 'background .2s' }}>
          Permanently delete account
        </button>
      </div>
      <button onClick={onClose} style={{ width: '100%', padding: '17px', border: 'none', borderRadius: 18, cursor: 'pointer',
        background: t.surface, fontFamily: UI_FONT, fontSize: 19, fontWeight: 600, color: t.accent }}>Cancel</button>
    </Sheet>
  );
}

Object.assign(window, { ProfileScreen });
