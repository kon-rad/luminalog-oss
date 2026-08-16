// Entry point for the iOS bundle. Exposes exactly what map.html needs on the
// `CognitiveMap` global and nothing else, so the bundle stays small and the surface
// the WebView can reach stays deliberate.
export { mountCognitiveMap } from './mount'
export { DEFAULT_LIGHT, DEFAULT_DARK, DOMAIN_VARS, INK_VARS } from './theme'
