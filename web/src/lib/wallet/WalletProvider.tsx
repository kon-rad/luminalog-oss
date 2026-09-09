// src/lib/wallet/WalletProvider.tsx
'use client'

import { ComponentType, PropsWithChildren, ReactNode, useMemo } from 'react'
import {
  ConnectionProvider,
  WalletProvider as AdapterWalletProvider,
  type ConnectionProviderProps,
} from '@solana/wallet-adapter-react'
import { WalletModalProvider, type WalletModalProviderProps } from '@solana/wallet-adapter-react-ui'
import { clusterApiUrl } from '@solana/web3.js'
import { Buffer } from 'buffer'
import '@solana/wallet-adapter-react-ui/styles.css'

// `ConnectionProvider` and `WalletModalProvider` are declared as `FC<Props>`
// in their upstream .d.ts files. The installed @types/react (18.3.31) types
// FunctionComponent's call signature more permissively than that FC alias
// checks against when used as a JSX tag under this project's TypeScript
// version, so tsc rejects them with "cannot be used as a JSX component" even
// though they are, at runtime, ordinary React function components. Re-typing
// them as plain `ComponentType` here is a type-only compatibility shim (no
// change to what actually renders) scoped to these two imports.
const SafeConnectionProvider = ConnectionProvider as unknown as ComponentType<
  PropsWithChildren<ConnectionProviderProps>
>
const SafeWalletModalProvider = WalletModalProvider as unknown as ComponentType<
  PropsWithChildren<WalletModalProviderProps>
>

// Next.js 14 (webpack 5) does not polyfill Node's `Buffer` global in the
// client bundle. `@solana/web3.js` (used internally by `PublicKey`, and
// transitively by the wallet-adapter packages) references `Buffer` at
// runtime, so without this the first wallet connection throws
// `ReferenceError: Buffer is not defined` in the browser -- a runtime error
// `npm run build` cannot catch. Guarded for SSR since this file can render
// server-side before hydration, where `window` does not exist.
if (typeof window !== 'undefined' && !window.Buffer) {
  window.Buffer = Buffer
}

// autoConnect is deliberately OFF: connecting is always an explicit user
// action (spec section 5.2), never silent on page load. No wallet list is
// passed to AdapterWalletProvider -- Wallet Standard auto-detection finds any
// installed conforming wallet (Phantom, Solflare, Backpack) without Argo
// hardcoding a list that goes stale.
export default function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => clusterApiUrl('mainnet-beta'), [])

  return (
    <SafeConnectionProvider endpoint={endpoint}>
      <AdapterWalletProvider wallets={[]} autoConnect={false}>
        <SafeWalletModalProvider>{children}</SafeWalletModalProvider>
      </AdapterWalletProvider>
    </SafeConnectionProvider>
  )
}
