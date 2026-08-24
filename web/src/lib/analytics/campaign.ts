/**
 * The campaign slug is the ONLY join key between the four measurement surfaces
 * (Meta/Google ad platforms, PostHog, App Store Connect, RevenueCat). Nothing
 * joins a web visitor to an app installer, so the slug has to be used verbatim
 * in all five places: the Meta campaign name, the Google Ads campaign name,
 * `utm_campaign` on the landing URL, Apple's `ct` token, and the `campaign`
 * property on every PostHog event.
 *
 * Format: <channel>-<audience>-<creative>-<yyyymm>
 * Example: meta-privacy-founders-v3-202609
 */

/** Closed set, so grouping never depends on how someone typed it last time. */
export const CAMPAIGN_CHANNELS = ['meta', 'yt', 'organic', 'email', 'podcast'] as const

export type CampaignChannel = (typeof CAMPAIGN_CHANNELS)[number]

/**
 * Apple's `ct` token has a documented length limit that we have not verified
 * against the live App Store Connect console. 40 is a deliberately conservative
 * ceiling; raise it only after confirming against a real minted campaign link.
 */
export const CAMPAIGN_SLUG_MAX_LENGTH = 40

const SLUG_RE = new RegExp(`^(${CAMPAIGN_CHANNELS.join('|')})(-[a-z0-9]+)+-\\d{6}$`)

export function isValidCampaignSlug(slug: string): boolean {
  if (slug.length > CAMPAIGN_SLUG_MAX_LENGTH) return false
  return SLUG_RE.test(slug)
}

/**
 * Slug to the campaign token App Store Connect mints for it.
 *
 * Empty until the first campaign link is created in App Store Connect. An
 * unregistered slug falls through to being passed as `ct` verbatim, which App
 * Analytics still reports, so measurement works before the console work is done.
 */
export const CAMPAIGN_TOKENS: Record<string, string> = {}

export function appleCampaignToken(slug: string | null | undefined): string | null {
  if (!slug) return null
  if (!isValidCampaignSlug(slug)) return null
  return CAMPAIGN_TOKENS[slug] ?? slug
}
