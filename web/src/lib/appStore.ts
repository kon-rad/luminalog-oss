/**
 * Canonical App Store listing for the iOS app.
 *
 * Argo Private AI Journal shipped 2026-08-11 (Apple ID 6781137459). The URL is
 * overridable through `NEXT_PUBLIC_APP_STORE_URL` so a preview/staging build can
 * point somewhere else, but it falls back to the real listing: the env var is
 * baked in at build time and is not guaranteed to be present in every
 * deployment's `.env.local`, and a download button that silently links to `#`
 * is worse than one that ignores a missing override.
 */
export const APP_STORE_URL =
  process.env.NEXT_PUBLIC_APP_STORE_URL ||
  'https://apps.apple.com/us/app/argo-private-ai-journal/id6781137459'
