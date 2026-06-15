// core.jsx — theme tokens, ThemeContext, and the SF-Symbol-style icon set.

// ─────────────────────────────────────────────────────────────
// Theme tokens — warm, calm, reflective. One amber accent.
// ─────────────────────────────────────────────────────────────
const LIGHT = {
  isDark: false,
  bg:        '#F4F0E9',   // warm paper
  bgElev:    '#FBF8F3',
  surface:   '#FFFDFA',   // warm white card
  surfaceAlt:'#F0EBE1',
  text:      '#2B2722',
  text2:     '#7C7468',
  text3:     '#A89F92',
  sep:       'rgba(60,50,40,0.10)',
  hairline:  'rgba(60,50,40,0.07)',
  accent:    '#CE7F44',   // amber / terracotta
  accentDeep:'#B96B33',
  onAccent:  '#FFFFFF',
  accentSoft:'#F5E7D5',
  accentTint:'rgba(206,127,68,0.10)',
  glass:     'rgba(255,253,250,0.72)',
  shadow:    '0 1px 2px rgba(70,50,30,0.05), 0 8px 24px rgba(70,50,30,0.07)',
  shadowSoft:'0 1px 2px rgba(70,50,30,0.04), 0 4px 14px rgba(70,50,30,0.05)',
  scrim:     'rgba(40,33,26,0.32)',
};
const DARK = {
  isDark: true,
  bg:        '#16130E',
  bgElev:    '#1D1913',
  surface:   '#221E17',
  surfaceAlt:'#2B261E',
  text:      '#F3EEE4',
  text2:     '#A89E8F',
  text3:     '#776F61',
  sep:       'rgba(255,245,230,0.10)',
  hairline:  'rgba(255,245,230,0.07)',
  accent:    '#E5A063',
  accentDeep:'#D98C49',
  onAccent:  '#221608',
  accentSoft:'#3A2D1E',
  accentTint:'rgba(229,160,99,0.14)',
  glass:     'rgba(34,30,23,0.72)',
  shadow:    '0 1px 2px rgba(0,0,0,0.4), 0 10px 28px rgba(0,0,0,0.45)',
  shadowSoft:'0 1px 2px rgba(0,0,0,0.3), 0 5px 16px rgba(0,0,0,0.35)',
  scrim:     'rgba(0,0,0,0.55)',
};

const UI_FONT = '-apple-system, "SF Pro Text", system-ui, sans-serif';
const SERIF   = '"Newsreader", "New York", ui-serif, Georgia, serif';

// per-entry-type accent metadata (kept low-chroma, warm-leaning)
function typeMeta(dark) {
  return {
    text:  { label: 'Text',  icon: 'text',   hue: dark ? '#E5A063' : '#CE7F44' },
    voice: { label: 'Voice', icon: 'mic',    hue: dark ? '#D98C8C' : '#C16C6C' },
    video: { label: 'Video', icon: 'video',  hue: dark ? '#A89BC4' : '#897BA8' },
    image: { label: 'Image', icon: 'image',  hue: dark ? '#90AE97' : '#6E8C77' },
  };
}

const ThemeContext = React.createContext(LIGHT);
const useTheme = () => React.useContext(ThemeContext);

// ─────────────────────────────────────────────────────────────
// Icon set — clean line icons (SF-Symbol flavour). 24px grid.
// ─────────────────────────────────────────────────────────────
const PATHS = {
  home:    (f) => f
    ? <path d="M3 10.7 12 3l9 7.7V21a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" fill="currentColor"/>
    : <path d="M3.5 10.8 12 3.5l8.5 7.3V20a1 1 0 0 1-1 1H15v-6H9v6H4.5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round"/>,
  journal: (f) => f
    ? <path d="M6 3h11a2 2 0 0 1 2 2v15a1 1 0 0 1-1.4.9L17 20H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm3 5h6M9 11.5h6" stroke="#fff" strokeWidth="0" fill="currentColor"/>
    : <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 4h11a1.5 1.5 0 0 1 1.5 1.5V20l-2.2-1.3H6.5A1.5 1.5 0 0 1 5 17.2V5.5A1.5 1.5 0 0 1 6.5 4z"/><path d="M9 8.5h6M9 12h4.5"/></g>,
  chat:    (f) => f
    ? <path d="M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4.5 4V17H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" fill="currentColor"/>
    : <path d="M4.5 4.5h15A1.5 1.5 0 0 1 21 6v8.5a1.5 1.5 0 0 1-1.5 1.5H9l-4 3.4V16H4.5A1.5 1.5 0 0 1 3 14.5V6a1.5 1.5 0 0 1 1.5-1.5z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/>,
  person:  (f) => f
    ? <g fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z"/></g>
    : <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="12" cy="8" r="3.6"/><path d="M5 20.5c0-3.9 3.1-6.3 7-6.3s7 2.4 7 6.3"/></g>,
  plus:    () => <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"/>,
  mic:     (f) => f
    ? <g fill="currentColor"><rect x="9" y="2.5" width="6" height="11.5" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></g>
    : <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2.8" width="6" height="11.4" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></g>,
  video:   (f) => f
    ? <path d="M3 7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1.5l4.4-2.6A1 1 0 0 1 21 6.7v10.6a1 1 0 0 1-1.6.8L15 15.5V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="currentColor"/>
    : <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><rect x="3" y="5.5" width="12" height="13" rx="2"/><path d="M15 10l5-3v10l-5-3z"/></g>,
  image:   (f) => f
    ? <g fill="currentColor"><rect x="3" y="4.5" width="18" height="15" rx="2.5"/></g>
    : <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l4.5-4.2a1.5 1.5 0 0 1 2 0L20 19"/></g>,
  text:    () => <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M5 6.5h14M5 11.5h14M5 16.5h9"/></g>,
  flame:   () => <path d="M12 3c0 3-3 4.2-3 7.5C9 9 10.5 8 11 7c0 2.6 2.5 3.2 2.5 6.2A2.8 2.8 0 0 1 12 16M12 3c2.8 2.5 4.5 5 4.5 8.2a4.5 4.5 0 1 1-9 0c0-1.2.4-2.2 1-3.2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>,
  sparkle: () => <path d="M12 3.5c.5 3.6 1.9 5 5.5 5.5-3.6.5-5 1.9-5.5 5.5-.5-3.6-1.9-5-5.5-5.5 3.6-.5 5-1.9 5.5-5.5zM18.5 14.5c.3 1.8 1 2.5 2.8 2.8-1.8.3-2.5 1-2.8 2.8-.3-1.8-1-2.5-2.8-2.8 1.8-.3 2.5-1 2.8-2.8z" fill="currentColor"/>,
  search:  () => <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/></g>,
  chevR:   () => <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>,
  chevL:   () => <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>,
  chevD:   () => <path d="M5 9l7 7 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>,
  close:   () => <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>,
  play:    () => <path d="M7 4.5v15l13-7.5z" fill="currentColor"/>,
  pause:   () => <g fill="currentColor"><rect x="6" y="4.5" width="4.2" height="15" rx="1.4"/><rect x="13.8" y="4.5" width="4.2" height="15" rx="1.4"/></g>,
  camera:  () => <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2L8 4.8h8L17.5 7h2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5z"/><circle cx="12" cy="13" r="3.6"/></g>,
  photo:   () => <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"><rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l4.5-4.2a1.5 1.5 0 0 1 2 0L20 19"/></g>,
  send:    () => <path d="M4 12 20 4l-5 16-3.5-6.5L4 12z" fill="currentColor"/>,
  refresh: () => <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 11a8 8 0 0 0-14-4.5M4 5v3.5h3.5"/><path d="M4 13a8 8 0 0 0 14 4.5M20 19v-3.5h-3.5"/></g>,
  check:   () => <path d="M5 12.5l4.5 4.5L19 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>,
  trash:   () => <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6.5h16M9 6.5V4.5h6v2M6 6.5 7 20a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13.5"/></g>,
  signout: () => <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 7V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2M9 12h11m0 0-3.5-3.5M20 12l-3.5 3.5"/></g>,
  crown:   () => <path d="M3 8l4 3 5-6 5 6 4-3-2 11H5z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>,
  edit:    () => <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></g>,
  expand:  () => <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"/></g>,
  waveform:() => <g fill="currentColor"><rect x="3" y="10" width="2" height="4" rx="1"/><rect x="7" y="7" width="2" height="10" rx="1"/><rect x="11" y="4" width="2" height="16" rx="1"/><rect x="15" y="8" width="2" height="8" rx="1"/><rect x="19" y="10.5" width="2" height="3" rx="1"/></g>,
  muted:   () => <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M9 9v-.5a3 3 0 0 1 6 0V12M15 15a3 3 0 0 1-6 0M12 18.5V21M8.5 21h7M4 4l16 16"/></g>,
  phoneDown:() => <path d="M3 14c0-4 4-6 9-6s9 2 9 6c0 1.3-.6 2-1.8 2.2l-2.5.4c-1 .1-1.6-.4-1.8-1.2l-.3-1.5c-.1-.6-.5-1-1.1-1.1a14 14 0 0 0-3 0c-.6.1-1 .5-1.1 1.1l-.3 1.5c-.2.8-.8 1.3-1.8 1.2l-2.5-.4C3.6 16 3 15.3 3 14z" fill="currentColor" transform="rotate(135 12 12)"/>,
  filter:  () => <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 6.5h16M7 12h10M10 17.5h4"/></g>,
  arrowR:  () => <path d="M5 12h14m0 0-6-6m6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>,
  bookOpen:() => <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 6.5C10.5 5 8 4.5 4 5v13c4-.5 6.5 0 8 1.5 1.5-1.5 4-2 8-1.5V5c-4-.5-6.5 0-8 1.5zM12 6.5v13"/></g>,
  quote:   () => <path d="M9 6c-2.5 1-4 3.2-4 6.5V18h5v-6H7c0-2 1-3.5 3-4zM18 6c-2.5 1-4 3.2-4 6.5V18h5v-6h-3c0-2 1-3.5 3-4z" fill="currentColor"/>,
};

function Icon({ name, size = 24, filled = false, color, style, strokeWidth }) {
  const p = PATHS[name];
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ color: color || 'currentColor', display: 'block', flexShrink: 0, ...style }}>
      {p ? p(filled) : null}
    </svg>
  );
}

Object.assign(window, { LIGHT, DARK, UI_FONT, SERIF, typeMeta, ThemeContext, useTheme, Icon });
