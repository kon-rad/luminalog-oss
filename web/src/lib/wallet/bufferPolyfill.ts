// src/lib/wallet/bufferPolyfill.ts
//
// Next.js 14 (webpack 5) does not polyfill Node's `Buffer` global in the
// client bundle. `@solana/web3.js` (used internally by `PublicKey`, and
// transitively by the wallet-adapter packages) references `Buffer` at
// runtime, so without this the first wallet connection throws
// `ReferenceError: Buffer is not defined` in the browser: a runtime error
// `npm run build` cannot catch. Guarded for SSR since this can run
// server-side before hydration, where `window` does not exist.
//
// This lives in its own module, imported FIRST (before any `@solana/*`
// import) in WalletProvider.tsx, so the polyfill's side effect is guaranteed
// to run before those packages are evaluated. ES import evaluation hoists
// imports above module-body code, so a same-file polyfill placed after
// `@solana/*` imports would only work by luck (today, none of those packages
// touch `Buffer` at module scope; a version bump could change that silently).
import { Buffer } from 'buffer'

if (typeof window !== 'undefined' && !window.Buffer) {
  window.Buffer = Buffer
}
