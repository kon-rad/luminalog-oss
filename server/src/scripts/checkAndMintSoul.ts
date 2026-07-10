/**
 * Diagnose + (re)mint a user's LuminaSoul on the configured chain (BASE_CHAIN).
 *
 * Reports the user's current custodial wallet + NFT, and if they are not minted
 * on the CONFIGURED chain, triggers wallet provisioning + mint. Stale testnet
 * data (an nft on a different chain) is cleared first to match the documented
 * mainnet migration; a wedged/failed mint (nft doc with no tokenId) is released.
 *
 * Run:  npx tsx src/scripts/checkAndMintSoul.ts <email>
 */
import 'dotenv/config'
import admin from 'firebase-admin'
import { db } from '../middleware/firebaseAuth'
import { config, chainEnabled } from '../config'
import { ensureUserWallet } from '../services/chain/walletService'
import { ensureMinted } from '../services/chain/mintService'

const EMAIL = process.argv[2]
if (!EMAIL) {
  console.error('Usage: npx tsx src/scripts/checkAndMintSoul.ts <email>')
  process.exit(1)
}

async function snapshot(uid: string): Promise<{ wallet: any; nft: any }> {
  const d = (await db.collection('users').doc(uid).get()).data() ?? {}
  return { wallet: d.wallet ?? null, nft: d.nft ?? null }
}

async function main(): Promise<void> {
  console.log(`[mint] chainEnabled=${chainEnabled()} BASE_CHAIN=${config.BASE_CHAIN} contract=${config.SOULBOUND_CONTRACT_ADDRESS ?? '(unset)'}`)
  if (!chainEnabled()) {
    console.error('[mint] chain is DISABLED (missing CDP/RPC/minter env) — cannot mint. Aborting.')
    process.exit(1)
  }

  const user = await admin.auth().getUserByEmail(EMAIL)
  const uid = user.uid
  console.log(`[mint] ${EMAIL} → uid=${uid}`)

  let { wallet, nft } = await snapshot(uid)
  console.log('[mint] BEFORE wallet =', JSON.stringify(wallet))
  console.log('[mint] BEFORE nft    =', JSON.stringify(nft))

  const nftChain = nft?.chain as string | undefined
  const mainnetMinted = Boolean(nft?.tokenId) && nftChain === config.BASE_CHAIN
  const staleChain = Boolean(nft?.tokenId) && nftChain !== config.BASE_CHAIN
  const wedged = Boolean(nft) && !nft?.tokenId // e.g. status 'minting'/'failed', no token

  if (mainnetMinted) {
    console.log(`[mint] ✅ already minted on ${config.BASE_CHAIN}: tokenId=${nft.tokenId}, wallet=${wallet?.address}. Nothing to do.`)
    return
  }

  if (staleChain) {
    console.log(`[mint] clearing STALE testnet data (nft.chain=${nftChain} ≠ ${config.BASE_CHAIN}); wiping wallet+nft to re-provision on mainnet`)
    await db.collection('users').doc(uid).set(
      { wallet: admin.firestore.FieldValue.delete(), nft: admin.firestore.FieldValue.delete() },
      { merge: true },
    )
  } else if (wedged) {
    console.log(`[mint] releasing WEDGED mint (nft has no tokenId): clearing nft, keeping wallet`)
    await db.collection('users').doc(uid).set(
      { nft: admin.firestore.FieldValue.delete() },
      { merge: true },
    )
  } else {
    console.log('[mint] no existing mainnet mint and no stale/wedged data — provisioning fresh')
  }

  console.log('[mint] provisioning wallet (ensureUserWallet)…')
  const address = await ensureUserWallet(uid)
  console.log('[mint] wallet address =', address)

  console.log('[mint] minting (ensureMinted)…')
  const res = await ensureMinted(uid)
  console.log('[mint] ensureMinted →', JSON.stringify(res))

  ;({ wallet, nft } = await snapshot(uid))
  console.log('[mint] AFTER wallet =', JSON.stringify(wallet))
  console.log('[mint] AFTER nft    =', JSON.stringify(nft))

  if (nft?.tokenId && nft?.chain === config.BASE_CHAIN) {
    console.log(`[mint] ✅ SUCCESS — tokenId=${nft.tokenId} on ${nft.chain}, tx=${nft.txHash ?? '(none)'}`)
  } else {
    console.log('[mint] ⚠️ not fully minted yet — inspect nft above (may be mid-mint or failed).')
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[mint] FAILED', e)
    process.exit(1)
  })
