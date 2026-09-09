'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, onAuthStateChanged, signInWithPopup, signInWithCustomToken, signOut } from 'firebase/auth'
import { useWallet } from '@solana/wallet-adapter-react'
import bs58 from 'bs58'
import { auth, googleProvider, appleProvider } from './firebase'
import { buildSiwsMessage } from './wallet/siwsMessage'

interface AuthContextType {
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithApple: () => Promise<void>
  signInWithSolana: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signInWithApple: async () => {},
  signInWithSolana: async () => {},
  signOut: async () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const { publicKey, signMessage } = useWallet()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const handleSignIn = async () => {
    await signInWithPopup(auth, googleProvider)
  }

  const handleSignInWithApple = async () => {
    await signInWithPopup(auth, appleProvider)
  }

  // Two independent things happen with one wallet: this signs ONE nonce'd
  // message for sign-in only. It never touches the fixed key-wrap-derivation
  // message (stage 3) -- see spec section 3.
  const handleSignInWithSolana = async () => {
    if (!publicKey || !signMessage) {
      throw new Error('No Solana wallet connected')
    }
    const address = publicKey.toBase58()

    const nonceRes = await fetch('/api/auth/siws/nonce', { cache: 'no-store' })
    if (!nonceRes.ok) throw new Error('Could not fetch a sign-in nonce')
    const { nonce } = (await nonceRes.json()) as { nonce: string }

    const message = buildSiwsMessage({
      domain: window.location.hostname,
      address,
      statement: 'Sign in to Argo.',
      uri: window.location.origin,
      nonce,
      issuedAt: new Date().toISOString(),
    })

    const signatureBytes = await signMessage(new TextEncoder().encode(message))
    const signature = bs58.encode(signatureBytes)

    const verifyRes = await fetch('/api/auth/siws/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message, signature, address }),
    })
    if (!verifyRes.ok) throw new Error('Solana sign-in failed')
    const { firebaseCustomToken } = (await verifyRes.json()) as { firebaseCustomToken: string }

    await signInWithCustomToken(auth, firebaseCustomToken)
  }

  const handleSignOut = async () => {
    await signOut(auth)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signInWithGoogle: handleSignIn,
        signInWithApple: handleSignInWithApple,
        signInWithSolana: handleSignInWithSolana,
        signOut: handleSignOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
