import type { Domain } from './types'

/**
 * Every colour the map uses is a CSS custom property, and the HOST sets it. iOS
 * injects values resolved from Theme.swift for the current trait collection; the web
 * injects the Tailwind equivalents. Neither the palette nor the light-versus-dark
 * decision lives in this package, so the map follows the app's theme without this
 * code knowing what a theme is.
 */
export const DOMAIN_VARS: Record<Domain, string> = {
  craft: '--cm-craft',
  body: '--cm-body',
  people: '--cm-people',
  place: '--cm-place',
  mind: '--cm-mind',
  money: '--cm-money',
  other: '--cm-other',
}

export const INK_VARS = {
  text: '--cm-text',
  textMuted: '--cm-text-muted',
  surface: '--cm-surface',
  edge: '--cm-edge',
  keeper: '--cm-keeper',
} as const

/**
 * Fallback palette, used when the host sets nothing (tests, previews, a plain
 * browser). Warm-shifted into Argo's register rather than a generic chart palette:
 * the app lives on parchment #F4F0E9 and ink #16130E, and its existing type tints
 * (#C16C6C, #897BA8, #6E8C77) are desaturated. Hue separation is what carries the
 * domain coding, and that survives desaturation intact.
 *
 * These are starting values. Tune them against the real screens; do not replace them
 * with saturated primaries.
 */
export const DEFAULT_LIGHT: Record<string, string> = {
  [DOMAIN_VARS.craft]: '#4F6F94',
  [DOMAIN_VARS.body]: '#6E8C77',
  [DOMAIN_VARS.people]: '#C16C6C',
  [DOMAIN_VARS.place]: '#B07C3E',
  [DOMAIN_VARS.mind]: '#897BA8',
  [DOMAIN_VARS.money]: '#8A7A55',
  [DOMAIN_VARS.other]: '#9A9287',
  [INK_VARS.text]: '#2B2722',
  [INK_VARS.textMuted]: '#7C7468',
  [INK_VARS.surface]: '#FFFDFA',
  [INK_VARS.edge]: '#7C7468',
  [INK_VARS.keeper]: '#9C7C2A',
}

export const DEFAULT_DARK: Record<string, string> = {
  [DOMAIN_VARS.craft]: '#86A3C4',
  [DOMAIN_VARS.body]: '#90AE97',
  [DOMAIN_VARS.people]: '#D98C8C',
  [DOMAIN_VARS.place]: '#D3A263',
  [DOMAIN_VARS.mind]: '#A89BC4',
  [DOMAIN_VARS.money]: '#B8A97F',
  [DOMAIN_VARS.other]: '#7E786D',
  [INK_VARS.text]: '#F3EEE4',
  [INK_VARS.textMuted]: '#A89E8F',
  [INK_VARS.surface]: '#221E17',
  [INK_VARS.edge]: '#A89E8F',
  [INK_VARS.keeper]: '#F2CB4C',
}
