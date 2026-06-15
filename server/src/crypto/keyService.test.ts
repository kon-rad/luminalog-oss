// vi.mock calls are hoisted by vitest to BEFORE all imports.
// We mock config and firebaseAuth so their module-level side effects
// (env validation → process.exit, Firebase Admin init) never run.
import { vi } from 'vitest'

vi.mock('../config', () => ({
  config: {
    MASTER_KEY: Buffer.alloc(32).toString('base64'),
    PORT: '3200',
    NODE_ENV: 'test',
    FIREBASE_SERVICE_ACCOUNT_JSON: '{}',
    TOGETHER_AI_API_KEY: 'dummy',
    AWS_ACCESS_KEY_ID: 'dummy',
    AWS_SECRET_ACCESS_KEY: 'dummy',
    AWS_S3_BUCKET: 'dummy',
    AWS_REGION: 'us-east-1',
    VAPI_PUBLIC_KEY: 'dummy',
    VAPI_ASSISTANT_ID: 'dummy',
    VAPI_WEBHOOK_SECRET: 'dummy',
  },
}))

vi.mock('../middleware/firebaseAuth', () => ({
  db: {},
}))

import { describe, it, expect } from 'vitest'
import { randomBytes } from 'crypto'
import { wrapDEK, unwrapDEK } from './keyService'

describe('keyService wrap', () => {
  const master = randomBytes(32)
  it('wrap/unwrap round-trips a 32B DEK', () => {
    const dek = randomBytes(32)
    const wrapped = wrapDEK(master, dek)
    expect(unwrapDEK(master, wrapped).equals(dek)).toBe(true)
  })
  it('wrong master fails closed', () => {
    const wrapped = wrapDEK(master, randomBytes(32))
    expect(() => unwrapDEK(randomBytes(32), wrapped)).toThrow()
  })
})
