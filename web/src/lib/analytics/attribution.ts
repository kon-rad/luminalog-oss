import { isValidCampaignSlug } from './campaign'

/**
 * Ad attribution captured on the landing page and held for the session.
 *
 * A visitor commonly scrolls, opens /privacy, comes back, and only then taps
 * download. Without persistence the campaign is lost on that second page and
 * every conversion lands in "direct", which is the most common way a funnel
 * like this breaks silently.
 */
export type Attribution = {
  campaign: string | null
  source: string | null
  medium: string | null
  fbclid: string | null
  gclid: string | null
}

export const ATTRIBUTION_STORAGE_KEY = 'argo_attribution'

const EMPTY: Attribution = { campaign: null, source: null, medium: null, fbclid: null, gclid: null }

function safeRead(storage: Storage): Attribution {
  try {
    const raw = storage.getItem(ATTRIBUTION_STORAGE_KEY)
    if (!raw) return { ...EMPTY }
    const parsed = JSON.parse(raw) as Partial<Attribution>
    return { ...EMPTY, ...parsed }
  } catch {
    return { ...EMPTY }
  }
}

export function readAttribution(storage: Storage): Attribution {
  return safeRead(storage)
}

/**
 * Reads UTM and click-id params off a location search string and merges them
 * into session storage. First touch wins for `campaign` unless a later visit
 * carries a different valid campaign, so an untagged internal navigation never
 * erases the campaign that brought the visitor here.
 */
export function captureAttribution(search: string, storage: Storage): Attribution {
  const params = new URLSearchParams(search)
  const stored = safeRead(storage)

  const incomingCampaign = params.get('utm_campaign')
  const validCampaign =
    incomingCampaign && isValidCampaignSlug(incomingCampaign) ? incomingCampaign : null

  const next: Attribution = {
    campaign: validCampaign ?? stored.campaign,
    source: params.get('utm_source') ?? stored.source,
    medium: params.get('utm_medium') ?? stored.medium,
    fbclid: params.get('fbclid') ?? stored.fbclid,
    gclid: params.get('gclid') ?? stored.gclid,
  }

  try {
    storage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Private-mode browsers can throw on write. Attribution is best-effort.
  }
  return next
}
