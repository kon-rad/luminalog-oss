/**
 * The complete web event taxonomy. Five events, deliberately. Adding a sixth
 * means editing this file, which is the point: an unbounded event list becomes
 * unreadable within a month and nobody notices until the funnel stops joining.
 *
 * NEVER add an event or property carrying journal content.
 */
export const EVENTS = {
  PAGE_VIEW: 'page_view',
  LANDING_SCROLL_50: 'landing_scroll_50',
  /** The primary conversion. Google Ads' conversion action points at this too. */
  APP_STORE_CLICK: 'app_store_click',
  WEB_SIGNUP: 'web_signup',
  WEB_PURCHASE: 'web_purchase',
} as const

export type EventName = (typeof EVENTS)[keyof typeof EVENTS]

/** Only scalars. Objects and arrays are how content leaks into analytics. */
export type EventProps = Record<string, string | number | boolean | null>

/**
 * Meta standard events. Mapping to standard events rather than custom ones
 * measurably improves Meta's optimization, which matters at low spend where the
 * algorithm has very little signal to learn from.
 */
export const META_EVENT_MAP: Record<EventName, string> = {
  [EVENTS.PAGE_VIEW]: 'PageView',
  [EVENTS.LANDING_SCROLL_50]: 'ViewContent',
  [EVENTS.APP_STORE_CLICK]: 'Lead',
  [EVENTS.WEB_SIGNUP]: 'CompleteRegistration',
  [EVENTS.WEB_PURCHASE]: 'Purchase',
}
