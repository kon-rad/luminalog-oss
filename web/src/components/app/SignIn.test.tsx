/**
 * The suite defaults to the `node` environment (see vitest.config.ts), but this
 * renders <SignIn> into real DOM via @testing-library/react and clicks buttons.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const world = { connected: false, setVisible: vi.fn(), signInWithSolana: vi.fn(async () => {}) }

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({ connected: world.connected }),
}))
vi.mock('@solana/wallet-adapter-react-ui', () => ({
  useWalletModal: () => ({ setVisible: world.setVisible }),
}))
vi.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    signInWithApple: vi.fn(),
    signInWithGoogle: vi.fn(),
    signInWithSolana: world.signInWithSolana,
  }),
}))

import SignIn from './SignIn'

beforeEach(() => {
  world.connected = false
  world.setVisible.mockClear()
  world.signInWithSolana.mockClear()
})

describe('SignIn: Connect Solana Wallet', () => {
  it('opens the wallet picker when no wallet is connected yet', () => {
    render(<SignIn />)
    screen.getByText('Connect Solana Wallet').click()
    expect(world.setVisible).toHaveBeenCalledWith(true)
    expect(world.signInWithSolana).not.toHaveBeenCalled()
  })

  it('signs in immediately when a wallet is already connected', async () => {
    world.connected = true
    render(<SignIn />)
    screen.getByText('Connect Solana Wallet').click()
    await waitFor(() => expect(world.signInWithSolana).toHaveBeenCalled())
    expect(world.setVisible).not.toHaveBeenCalled()
  })
})
