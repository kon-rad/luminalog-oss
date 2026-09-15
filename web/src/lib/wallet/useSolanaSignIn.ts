import { useEffect, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { useAuth } from '@/lib/auth-context'

/** `WalletSignMessageError` (thrown by @solana/wallet-adapter-base) wraps
 *  whatever the underlying wallet threw, copying its `message` verbatim (see
 *  StandardWalletAdapter's signMessage: `new WalletSignMessageError(error?.message,
 *  error)`). Wallets reject a declined signature with a message along the
 *  lines of "User rejected the request", so matching on both the wrapper
 *  type and that wording distinguishes "user said no" from an actual
 *  signing failure without guessing at an unrelated error shape. */
export function isSolanaUserRejection(err: unknown): boolean {
  return err instanceof Error && err.name === 'WalletSignMessageError' && /reject/i.test(err.message)
}

/** Connect-then-sign: opens the wallet picker if nothing is connected yet, and
 *  runs the SIWS sign-in the moment `connected` flips true afterward. If a
 *  wallet is already connected, signs in immediately with no picker.
 *
 *  Connecting is two steps in wallet-adapter: the picker's `select()` only
 *  chooses an adapter, it never connects it. So `start()` also calls
 *  `connect()` itself, either immediately (a wallet is already selected,
 *  e.g. persisted from a prior visit) or via the effect below once the
 *  picker lands a selection.
 *
 *  `onCancel` covers the picker-dismissed-without-connecting path: if the
 *  user closes the wallet-adapter modal without ever selecting a wallet,
 *  `connected` never changes and `signInWithSolana()` is never called, so
 *  `onError` never fires either. Watching `visible` catches that transition
 *  (true -> false while still disconnected), gated on no wallet having been
 *  selected so it doesn't also fire on a legitimate "just selected, now
 *  connecting" transition (the picker closes ~150ms after `select()`, well
 *  before `connected` can flip true). */
export function useSolanaSignIn(
  onError: (message: string) => void,
  onCancel: () => void,
  onSuccess?: () => void,
) {
  const { connected, connecting, wallet, connect } = useWallet()
  const { setVisible, visible } = useWalletModal()
  const { signInWithSolana } = useAuth()
  const pending = useRef(false)
  const wasVisible = useRef(false)

  const signIn = () => {
    signInWithSolana()
      .then(() => onSuccess?.())
      .catch((err) => {
        console.error('[SignIn] Solana sign-in failed', err)
        if (isSolanaUserRejection(err)) {
          onCancel()
        } else {
          onError('Sign-in failed. Please try again.')
        }
      })
  }

  const start = () => {
    if (connected) {
      signIn()
      return
    }
    pending.current = true
    if (wallet) {
      connect().catch(() => {
        pending.current = false
        onCancel()
      })
    } else {
      setVisible(true)
    }
  }

  // The picker only selects a wallet; this actually connects it once selected.
  useEffect(() => {
    if (pending.current && wallet && !connected && !connecting) {
      connect().catch(() => {
        pending.current = false
        onCancel()
      })
    }
  }, [wallet, connected, connecting, connect, onCancel])

  useEffect(() => {
    if (connected && pending.current) {
      pending.current = false
      signIn()
    }
  }, [connected, signInWithSolana, onError, onCancel])

  useEffect(() => {
    if (wasVisible.current && !visible && pending.current && !connected && !wallet) {
      pending.current = false
      onCancel()
    }
    wasVisible.current = visible
  }, [visible, connected, wallet, onCancel])

  return start
}
