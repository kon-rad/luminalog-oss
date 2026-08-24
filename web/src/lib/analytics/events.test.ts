import { describe, it, expect } from 'vitest'
import { EVENTS, META_EVENT_MAP, type EventName } from './events'

describe('event taxonomy', () => {
  it('holds exactly the five approved events', () => {
    expect(Object.values(EVENTS).sort()).toEqual(
      ['app_store_click', 'landing_scroll_50', 'page_view', 'web_purchase', 'web_signup'].sort(),
    )
  })

  it('maps every event to a Meta standard event', () => {
    for (const name of Object.values(EVENTS) as EventName[]) {
      expect(META_EVENT_MAP[name], `missing Meta mapping for ${name}`).toBeTruthy()
    }
  })

  it('maps the primary conversion to the standard Lead event', () => {
    expect(META_EVENT_MAP[EVENTS.APP_STORE_CLICK]).toBe('Lead')
  })
})
