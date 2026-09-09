// src/lib/wallet/WalletProvider.tsx
'use client'

// Must be the first import: its module-body side effect (polyfilling
// `window.Buffer`) needs to run before any `@solana/*` package is evaluated.
// See bufferPolyfill.ts for why.
import './bufferPolyfill'

import { ComponentType, PropsWithChildren, ReactNode, useMemo } from 'react'
import {
  ConnectionProvider,
  WalletProvider as AdapterWalletProvider,
  type ConnectionProviderProps,
} from '@solana/wallet-adapter-react'
import { WalletModalProvider, type WalletModalProviderProps } from '@solana/wallet-adapter-react-ui'
import { clusterApiUrl } from '@solana/web3.js'
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

// autoConnect is deliberately OFF: connecting is always an explicit user
// action (spec section 5.2), never silent on page load. No wallet list is
// passed to AdapterWalletProvider: Wallet Standard auto-detection finds any
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
