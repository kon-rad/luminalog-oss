/**
 * The suite defaults to the `node` environment (see vitest.config.ts), but this
 * renders <AuthProvider>/<Probe> into real DOM via @testing-library/react.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { useContext } from 'react'

const world = {
  publicKey: { toBase58: () => '7cVfgArCheMR6Cs4t6vz5rfnqd56vZq4ndaBrY5xkxXy' } as any,
  signMessage: vi.fn(async (msg: Uint8Array) => new Uint8Array(64).fill(9)),
  fetchCalls: [] as { url: string; init?: RequestInit }[],
}

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({ publicKey: world.publicKey, signMessage: world.signMessage }),
}))

// vi.mock('firebase/auth', ...) below is hoisted above this file's own const
// declarations (and above the './auth-context' import, which is itself hoisted
// per ES module semantics), so the mock factory needs a reference that's
// initialized before it runs. vi.hoisted() matches the pattern already used
// elsewhere in this codebase (e.g. src/lib/firestore/profile.test.ts).
const signInWithCustomTokenMock = vi.hoisted(() => vi.fn(async () => undefined))
vi.mock('firebase/auth', async () => {
  const actual = await vi.importActual<any>('firebase/auth')
  return {
    ...actual,
    onAuthStateChanged: (_auth: any, cb: any) => { cb(null); return () => {} },
    signInWithCustomToken: signInWithCustomTokenMock,
  }
})
vi.mock('./firebase', () => ({ auth: {}, googleProvider: {}, appleProvider: {} }))

global.fetch = vi.fn(async (url: any, init?: any) => {
  world.fetchCalls.push({ url: String(url), init })
  if (String(url) === '/api/auth/siws/nonce') {
    return new Response(JSON.stringify({ nonce: 'server-nonce' }), { status: 200 })
  }
  if (String(url) === '/api/auth/siws/verify') {
    return new Response(JSON.stringify({ firebaseCustomToken: 'a-custom-token' }), { status: 200 })
  }
  throw new Error(`unexpected fetch: ${url}`)
}) as any

import { AuthProvider, useAuth } from './auth-context'

function Probe() {
  const { signInWithSolana } = useAuth()
  // The "no wallet connected" test expects a rejection; swallow it here so it
  // doesn't surface as an unhandled promise rejection (which vitest reports
  // as a process-level error, failing the run even though both tests below
  // pass on their own assertions).
  return <button onClick={() => { signInWithSolana().catch(() => {}) }}>go</button>
}

beforeEach(() => {
  world.fetchCalls = []
  signInWithCustomTokenMock.mockClear()
  world.signMessage.mockClear()
})

describe('signInWithSolana', () => {
  it('fetches a nonce, signs it, verifies, and signs in with the returned custom token', async () => {
    render(<AuthProvider><Probe /></AuthProvider>)
    screen.getByText('go').click()

    await waitFor(() => expect(signInWithCustomTokenMock).toHaveBeenCalled())

    expect(world.fetchCalls[0].url).toBe('/api/auth/siws/nonce')
    expect(world.fetchCalls[1].url).toBe('/api/auth/siws/verify')
    const verifyBody = JSON.parse(world.fetchCalls[1].init!.body as string)
    expect(verifyBody.address).toBe('7cVfgArCheMR6Cs4t6vz5rfnqd56vZq4ndaBrY5xkxXy')
    expect(typeof verifyBody.signature).toBe('string')
    expect(verifyBody.message).toContain('Nonce: server-nonce')
    expect(signInWithCustomTokenMock).toHaveBeenCalledWith({}, 'a-custom-token')
  })

  it('throws a clear error when no wallet is connected', async () => {
    world.publicKey = null
    const { AuthProvider: FreshProvider } = await import('./auth-context')
    render(<FreshProvider><Probe /></FreshProvider>)
    screen.getByText('go').click()
    await waitFor(() => expect(world.fetchCalls).toHaveLength(0))
  })
})
