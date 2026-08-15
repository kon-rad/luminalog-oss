/* ──────────────────────────────────────────────────────────────────────────
 * Shared tokens for the final demo day deck.
 *
 * The deck renders on a fixed 1280×720 stage so the web version and the
 * exported PowerPoint (scripts/build-demo-day-pptx.js) stay in sync. Colours
 * are the Argo palette from globals.css, hard-coded here rather than read from
 * CSS variables because the deck must look identical whatever theme the rest
 * of the site is in — a projector is not a place for a light/dark surprise.
 * ────────────────────────────────────────────────────────────────────────── */

export const STAGE_W = 1280
export const STAGE_H = 720

export const C = {
  ink: '#16130E',
  inkElev: '#221E18',
  cream: '#F3EEE4',
  creamMuted: '#A89E8F',
  paper: '#F4F0E9',
  paperElev: '#FBF8F3',
  text: '#2B2722',
  textMuted: '#7C7468',
  accent: '#CE7F44',
  accentDeep: '#B96B33',
  accentLight: '#E5A063',
  gold: '#F5C842',
  hairInk: 'rgba(255,240,220,0.12)',
  hairPaper: 'rgba(60,50,40,0.12)',
} as const

export const SERIF = '"Newsreader", "New York", ui-serif, Georgia, serif'
export const SANS = '-apple-system, "SF Pro Text", system-ui, "Segoe UI", sans-serif'
