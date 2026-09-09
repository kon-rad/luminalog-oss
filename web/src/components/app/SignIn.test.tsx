/**
 * The suite defaults to the `node` environment (see vitest.config.ts), but this
 * renders <SignIn> into real DOM via @testing-library/react and clicks buttons.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'

const world = {
  connected: false,
  visible: false,
  setVisible: vi.fn(),
  signInWithSolana: vi.fn(async () => {}),
}

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({ connected: world.connected }),
}))
vi.mock('@solana/wallet-adapter-react-ui', () => ({
  useWalletModal: () => ({ setVisible: world.setVisible, visible: world.visible }),
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
  world.visible = false
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

  it('resets loading state silently (no error) when the picker is closed without connecting', async () => {
    const { rerender } = render(<SignIn />)
    fireEvent.click(screen.getByText('Connect Solana Wallet'))
    expect(world.setVisible).toHaveBeenCalledWith(true)

    // Solana button now shows its spinner, and all three buttons are disabled.
    expect(screen.queryByText('Connect Solana Wallet')).toBeNull()
    expect((screen.getByText('Continue with Google').closest('button') as HTMLButtonElement).disabled).toBe(
      true,
    )

    // Simulate the wallet-adapter modal actually opening...
    world.visible = true
    rerender(<SignIn />)

    // ...then the user closes it without ever connecting (`connected` stays false).
    world.visible = false
    rerender(<SignIn />)

    // The spinner clears and every button re-enables, with no error surfaced.
    await waitFor(() => expect(screen.queryByText('Connect Solana Wallet')).not.toBeNull())
    expect((screen.getByText('Continue with Google').closest('button') as HTMLButtonElement).disabled).toBe(
      false,
    )
    expect((screen.getByText('Sign in with Apple').closest('button') as HTMLButtonElement).disabled).toBe(
      false,
    )
    expect((screen.getByText('Connect Solana Wallet').closest('button') as HTMLButtonElement).disabled).toBe(
      false,
    )
    expect(screen.queryByText(/Sign-in failed/)).toBeNull()
    expect(world.signInWithSolana).not.toHaveBeenCalled()
  })
})
