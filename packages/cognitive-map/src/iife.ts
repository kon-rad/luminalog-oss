// Entry point for the iOS bundle. Exposes exactly what map.html and pyramid.html
// need on the `CognitiveMap` global and nothing else, so the bundle stays small and
// the surface the WebView can reach stays deliberate.
export { mountCognitiveMap } from './mount'
export { mountZoomPyramid } from './pyramid'
export { DEFAULT_LIGHT, DEFAULT_DARK, DOMAIN_VARS, INK_VARS, PYRAMID_VARS } from './theme'
