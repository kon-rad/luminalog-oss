import { appleCampaignToken } from './analytics/campaign'

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

/**
 * Apple's provider token, from App Store Connect. Optional: without it the `ct`
 * campaign token is still reported in App Analytics, so measurement degrades
 * rather than breaking when the console work has not happened yet.
 */
const APPLE_PROVIDER_TOKEN = process.env.NEXT_PUBLIC_APPLE_PROVIDER_TOKEN || ''

/**
 * App Store URL carrying the campaign token for a given slug.
 *
 * Falls back to the untagged URL whenever the slug is missing or does not match
 * the convention, because a download link that still works and is untracked
 * beats one that is tracked and broken.
 */
export function appStoreUrlFor(slug?: string | null): string {
  const token = appleCampaignToken(slug)
  if (!token) return APP_STORE_URL

  const url = new URL(APP_STORE_URL)
  url.searchParams.set('ct', token)
  url.searchParams.set('mt', '8')
  if (APPLE_PROVIDER_TOKEN) url.searchParams.set('pt', APPLE_PROVIDER_TOKEN)
  return url.toString()
}
