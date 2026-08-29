import { describe, it, expect, beforeAll } from 'vitest'

// The exact set of required (non-optional, non-defaulted) fields on the real Zod
// schema, confirmed by reading config.ts directly. Note this is 9 fields, not 8:
// AWS_S3_BUCKET has no `.default()` and no `.optional()`, so it is required too.
const minimalEnv = {
  FIREBASE_SERVICE_ACCOUNT_JSON: 'test',
  TOGETHER_AI_API_KEY: 'test',
  AWS_ACCESS_KEY_ID: 'test',
  AWS_SECRET_ACCESS_KEY: 'test',
  AWS_S3_BUCKET: 'test',
  VAPI_PUBLIC_KEY: 'test',
  VAPI_ASSISTANT_ID: 'test',
  VAPI_WEBHOOK_SECRET: 'test',
  REVENUECAT_WEBHOOK_SECRET: 'test',
}

describe('config schema defaults (ADR-0138)', () => {
  // `config.ts` runs `schema.safeParse(process.env)` (and exits on failure) at
  // module load time, so process.env must already hold the required fields BEFORE
  // the module is first evaluated. A dynamic import (not a static one, which ESM
  // hoists ahead of this file's own top-level code) lets us set them first.
  beforeAll(() => {
    Object.assign(process.env, minimalEnv)
  })

  it('defaults AI_PROVIDER to morpheus, unaffected by the Venice rollout', async () => {
    const { schema } = await import('./config.js')
    const parsed = schema.parse(minimalEnv)
    expect(parsed.AI_PROVIDER).toBe('morpheus')
  })

  it('defaults VOICE_AI_PROVIDER to venice as of ADR-0138', async () => {
    const { schema } = await import('./config.js')
    const parsed = schema.parse(minimalEnv)
    expect(parsed.VOICE_AI_PROVIDER).toBe('venice')
  })
})
