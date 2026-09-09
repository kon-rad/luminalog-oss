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
  connecting: false,
  wallet: null as null | { adapter: { name: string } },
  connect: vi.fn(async () => {}),
  visible: false,
  setVisible: vi.fn(),
  signInWithSolana: vi.fn(async () => {}),
}

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({
    connected: world.connected,
    connecting: world.connecting,
    wallet: world.wallet,
    connect: world.connect,
  }),
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
  world.connecting = false
  world.wallet = null
  world.connect.mockClear()
  world.connect.mockImplementation(async () => {})
  world.visible = false
  world.setVisible.mockClear()
  world.signInWithSolana.mockClear()
})

describe('SignIn: Connect Solana Wallet', () => {
  it('opens the wallet picker when no wallet is selected yet', () => {
    render(<SignIn />)
    screen.getByText('Connect Solana Wallet').click()
    expect(world.setVisible).toHaveBeenCalledWith(true)
    expect(world.connect).not.toHaveBeenCalled()
    expect(world.signInWithSolana).not.toHaveBeenCalled()
  })

  it('signs in immediately when a wallet is already connected', async () => {
    world.connected = true
    render(<SignIn />)
    screen.getByText('Connect Solana Wallet').click()
    await waitFor(() => expect(world.signInWithSolana).toHaveBeenCalled())
    expect(world.setVisible).not.toHaveBeenCalled()
    expect(world.connect).not.toHaveBeenCalled()
  })

  it('connects directly (no picker) when a wallet is already selected but not connected', () => {
    world.wallet = { adapter: { name: 'Phantom' } }
    render(<SignIn />)
    screen.getByText('Connect Solana Wallet').click()
    expect(world.connect).toHaveBeenCalled()
    expect(world.setVisible).not.toHaveBeenCalled()
  })

  it('drives the full connect-then-sign-in state machine: picker opens, selecting a wallet triggers connect(), connecting resolving triggers sign-in', async () => {
    const { rerender } = render(<SignIn />)

    // 1. No wallet selected: clicking opens the picker, does not connect yet.
    fireEvent.click(screen.getByText('Connect Solana Wallet'))
    expect(world.setVisible).toHaveBeenCalledWith(true)
    expect(world.connect).not.toHaveBeenCalled()

    // 2. User picks a wallet in the picker: wallet-adapter's `select()` lands
    // a wallet, but does NOT connect it. Simulate that here.
    world.wallet = { adapter: { name: 'Phantom' } }
    rerender(<SignIn />)
    await waitFor(() => expect(world.connect).toHaveBeenCalled())
    expect(world.signInWithSolana).not.toHaveBeenCalled()

    // 3. connect() resolves and `connected` flips true: sign-in fires.
    world.connected = true
    rerender(<SignIn />)
    await waitFor(() => expect(world.signInWithSolana).toHaveBeenCalled())
  })

  it('resets loading state silently (no error) when the picker is closed without selecting a wallet', async () => {
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

    // ...then the user closes it without ever selecting a wallet (`wallet`
    // stays null, `connected` stays false).
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
    expect(world.connect).not.toHaveBeenCalled()
    expect(world.signInWithSolana).not.toHaveBeenCalled()
  })

  it('does not treat the picker closing as a cancel once a wallet has been selected', async () => {
    const { rerender } = render(<SignIn />)
    fireEvent.click(screen.getByText('Connect Solana Wallet'))

    world.visible = true
    rerender(<SignIn />)

    // User selects a wallet: `wallet` lands, and shortly after the modal
    // closes itself (wallet-adapter's own ~150ms close-after-select timer).
    world.wallet = { adapter: { name: 'Phantom' } }
    rerender(<SignIn />)
    await waitFor(() => expect(world.connect).toHaveBeenCalled())

    world.visible = false
    rerender(<SignIn />)

    // This is NOT a cancellation: the spinner stays up, connect() was called,
    // and no error is surfaced.
    expect(screen.queryByText('Connect Solana Wallet')).toBeNull()
    expect(screen.queryByText(/Sign-in failed/)).toBeNull()
  })
})
