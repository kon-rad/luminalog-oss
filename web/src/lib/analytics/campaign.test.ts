import { describe, it, expect } from 'vitest'
import {
  CAMPAIGN_CHANNELS,
  CAMPAIGN_SLUG_MAX_LENGTH,
  CAMPAIGN_TOKENS,
  appleCampaignToken,
  isValidCampaignSlug,
} from './campaign'

describe('isValidCampaignSlug', () => {
  it('accepts a well-formed slug', () => {
    expect(isValidCampaignSlug('meta-privacy-founders-v3-202609')).toBe(true)
    expect(isValidCampaignSlug('yt-journaling-howto-v1-202609')).toBe(true)
  })

  it('rejects an unknown channel', () => {
    expect(isValidCampaignSlug('tiktok-privacy-v1-202609')).toBe(false)
  })

  it('rejects uppercase, underscores, and spaces', () => {
    expect(isValidCampaignSlug('Meta-Privacy-202609')).toBe(false)
    expect(isValidCampaignSlug('meta_privacy_202609')).toBe(false)
    expect(isValidCampaignSlug('meta privacy 202609')).toBe(false)
  })

  it('requires a trailing yyyymm', () => {
    expect(isValidCampaignSlug('meta-privacy-founders')).toBe(false)
    expect(isValidCampaignSlug('meta-privacy-2026')).toBe(false)
  })

  it('rejects slugs longer than the max length', () => {
    const long = `meta-${'a'.repeat(CAMPAIGN_SLUG_MAX_LENGTH)}-202609`
    expect(long.length).toBeGreaterThan(CAMPAIGN_SLUG_MAX_LENGTH)
    expect(isValidCampaignSlug(long)).toBe(false)
  })

  it('exposes the closed channel set', () => {
    expect(CAMPAIGN_CHANNELS).toContain('meta')
    expect(CAMPAIGN_CHANNELS).toContain('yt')
  })
})

describe('CAMPAIGN_TOKENS', () => {
  it('every registered slug conforms to the convention', () => {
    for (const slug of Object.keys(CAMPAIGN_TOKENS)) {
      expect(isValidCampaignSlug(slug), `bad slug: ${slug}`).toBe(true)
    }
  })
})

describe('appleCampaignToken', () => {
  it('returns null for a missing slug', () => {
    expect(appleCampaignToken(null)).toBeNull()
    expect(appleCampaignToken(undefined)).toBeNull()
  })

  it('returns null for a slug that does not conform', () => {
    expect(appleCampaignToken('not a slug')).toBeNull()
  })

  it('falls back to the slug itself when no token is registered', () => {
    expect(appleCampaignToken('meta-privacy-founders-v3-202609')).toBe(
      'meta-privacy-founders-v3-202609',
    )
  })
})
