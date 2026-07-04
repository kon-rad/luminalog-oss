import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseAbiItem,
  parseEventLogs,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, baseSepolia } from 'viem/chains'
import { config, chainEnabled } from '../../config'
import { db } from '../../middleware/firebaseAuth'

/** The viem chain selected by BASE_CHAIN ('base' mainnet | 'base-sepolia' testnet). */
const activeChain = config.BASE_CHAIN === 'base' ? base : baseSepolia

/** The soulbound token minted to a user, stored on `users/{uid}.nft`. */
export interface UserNft {
  tokenId: string
  contract: string
  chain: string
  txHash?: string
  walletAddress?: string
  mintedAt: string
  /** Lifecycle marker: 'minting' (a worker holds the claim) | 'minted' | 'failed'. */
  status?: 'minting' | 'minted' | 'failed'
  /** Epoch ms when the current 'minting' claim was taken; used to expire stale claims. */
  mintStartedAt?: number
}

// Written to nft.chain — 'base' or 'base-sepolia', from config (BASE_CHAIN).
const CHAIN = config.BASE_CHAIN

// A 'minting' claim older than this is treated as stale/crashed and reclaimable,
// so a lost/failed worker can never wedge a user out of ever minting.
const MINT_CLAIM_TTL_MS = 3 * 60 * 1000

// Bounded recent window for orphan-recovery getLogs when no deploy block is set —
// public Base Sepolia RPC rejects very large ranges (and fromBlock: 0n).
const GETLOGS_LOOKBACK = 9000n

let _loggedDisabled = false
function logDisabledOnce(): void {
  if (_loggedDisabled) return
  _loggedDisabled = true
  console.debug('[chain] disabled (missing chain env) — ensureMinted is a no-op')
}

const SOUL_ABI = parseAbi([
  'function mint(address to) returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
])
const TRANSFER_EVENT = parseAbiItem(
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
)

function contractAddress(): `0x${string}` {
  const addr = config.SOULBOUND_CONTRACT_ADDRESS
  if (!addr) throw new Error('SOULBOUND_CONTRACT_ADDRESS not configured')
  return addr as `0x${string}`
}

// Capture ReturnType of the concrete builders so the Base-specialized client
// types (which include 'deposit' tx types) match the cached singletons.
function makePublicClient() {
  return createPublicClient({
    chain: activeChain,
    transport: http(config.BASE_RPC_URL || undefined),
  })
}
let _public: ReturnType<typeof makePublicClient> | undefined
function publicClient() {
  return (_public ??= makePublicClient())
}

function makeWalletClient() {
  if (!config.BASE_MINTER_PRIVATE_KEY) throw new Error('BASE_MINTER_PRIVATE_KEY not configured')
  const account = privateKeyToAccount(config.BASE_MINTER_PRIVATE_KEY as `0x${string}`)
  return createWalletClient({
    account,
    chain: activeChain,
    transport: http(config.BASE_RPC_URL || undefined),
  })
}
let _wallet: ReturnType<typeof makeWalletClient> | undefined
function walletClient() {
  return (_wallet ??= makeWalletClient())
}

// Single-flight queue (I3): the minter is one shared EOA, so concurrent
// writeContract calls would fetch the same pending nonce and collide. Serialize
// every submit+receipt so they run strictly one-at-a-time, process-wide.
let _mintChain: Promise<unknown> = Promise.resolve()
function runExclusiveMint<T>(fn: () => Promise<T>): Promise<T> {
  const result = _mintChain.then(fn, fn)
  // keep the chain alive but never let a rejection poison the next submission
  _mintChain = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

/**
 * Transactional per-user mint claim (C1). Concurrent callers (rag/ai/soul all
 * fire ensureSoulMinted) must not both observe balanceOf==0 and double-mint.
 * Atomically decides who owns the mint:
 *  - 'done'   → a tokenId is already persisted (return it, no chain work);
 *  - 'busy'   → another worker holds a FRESH 'minting' claim (back off);
 *  - 'winner' → we took the claim and must proceed with the mint.
 */
async function claimMint(
  uid: string,
): Promise<{ kind: 'done'; nft: UserNft } | { kind: 'busy' } | { kind: 'winner' }> {
  const userRef = db.collection('users').doc(uid)
  return db.runTransaction(async (tx: any) => {
    const snap = await tx.get(userRef)
    const nft = snap.data()?.nft as UserNft | undefined
    if (nft?.tokenId) return { kind: 'done' as const, nft }

    const now = Date.now()
    const fresh =
      nft?.status === 'minting' &&
      typeof nft.mintStartedAt === 'number' &&
      now - nft.mintStartedAt < MINT_CLAIM_TTL_MS
    if (fresh) return { kind: 'busy' as const }

    // We win the claim. Merge so any sibling fields (e.g. wallet) are untouched.
    tx.set(userRef, { nft: { status: 'minting', mintStartedAt: now } }, { merge: true })
    return { kind: 'winner' as const }
  })
}

/** Release a failed claim so a later call retries (C1 failure path). */
async function releaseClaim(uid: string): Promise<void> {
  await db
    .collection('users')
    .doc(uid)
    .set({ nft: { status: 'failed' } }, { merge: true })
    .catch((err: any) => console.error('[chain] releaseClaim failed', err?.message ?? String(err)))
}

/**
 * Ensure the user's wallet holds exactly one soulbound token, and return its id.
 * Idempotent and safe to re-run:
 *  - stored `nft.tokenId` → return it (no chain calls);
 *  - else if the address already holds a token on-chain (a prior mint whose
 *    persist failed) → recover the tokenId from `Transfer` logs;
 *  - else `mint(address)` via the minter EOA, parse the `Transfer` event for the
 *    tokenId, and persist `nft` on the user doc.
 */
export async function ensureMinted(
  uid: string,
): Promise<{ tokenId: string; txHash?: string } | undefined> {
  // Chain-disabled degradation: no-op when chain env is absent (shared server).
  if (!chainEnabled()) {
    logDisabledOnce()
    return undefined
  }

  const userRef = db.collection('users').doc(uid)

  // C1: atomically settle ownership before any chain work. If we don't win the
  // claim, another worker owns (or already finished) the mint — never submit.
  const claim = await claimMint(uid)
  if (claim.kind === 'done') {
    return { tokenId: claim.nft.tokenId, txHash: claim.nft.txHash }
  }
  if (claim.kind === 'busy') return undefined

  // We own the claim from here — on ANY failure we must release it (C1) so a
  // later call can retry rather than being wedged behind a dead 'minting' flag.
  try {
    const address = (await userRef.get()).data()?.wallet?.address as string | undefined
    if (!address) throw new Error(`ensureMinted: user ${uid} has no provisioned wallet`)

    const contract = contractAddress()
    const pub = publicClient()

    const balance = (await pub.readContract({
      address: contract,
      abi: SOUL_ABI,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    })) as bigint

    let tokenId: bigint
    let txHash: string | undefined

    if (balance > 0n) {
      // Already minted but not persisted — recover the tokenId from Transfer logs.
      // I2: bound the range — public Base Sepolia RPC rejects fromBlock: 0n.
      const latest = await pub.getBlockNumber()
      const fromBlock =
        config.SOULBOUND_DEPLOY_BLOCK !== undefined
          ? BigInt(config.SOULBOUND_DEPLOY_BLOCK)
          : latest > GETLOGS_LOOKBACK
            ? latest - GETLOGS_LOOKBACK
            : 0n
      const logs = await pub.getLogs({
        address: contract,
        event: TRANSFER_EVENT,
        args: { to: address as `0x${string}` },
        fromBlock,
        toBlock: 'latest',
      })
      if (!logs.length)
        throw new Error(`ensureMinted: ${address} holds a token but no Transfer log found`)
      tokenId = logs[logs.length - 1].args.tokenId as bigint
    } else {
      // I3: serialize submit + receipt across all users (shared minter nonce).
      const { hash, receipt } = await runExclusiveMint(async () => {
        const h = await walletClient().writeContract({
          address: contract,
          abi: SOUL_ABI,
          functionName: 'mint',
          args: [address as `0x${string}`],
        })
        const r = await pub.waitForTransactionReceipt({ hash: h as `0x${string}` })
        return { hash: h, receipt: r }
      })
      txHash = hash
      // I1: a mined-but-reverted tx still returns a receipt — do not treat as mint.
      if (receipt.status !== 'success') throw new Error('mint reverted: ' + txHash)
      const events = parseEventLogs({ abi: SOUL_ABI, logs: receipt.logs, eventName: 'Transfer' })
      const minted = events.find(
        (e: any) => (e.args.to as string)?.toLowerCase() === address.toLowerCase(),
      )
      if (!minted)
        throw new Error('ensureMinted: mint succeeded but no Transfer event to the user was found')
      tokenId = (minted as any).args.tokenId as bigint
    }

    const nft: UserNft = {
      tokenId: tokenId.toString(),
      contract,
      chain: CHAIN,
      txHash,
      walletAddress: address,
      mintedAt: new Date().toISOString(),
      status: 'minted',
    }
    await userRef.set({ nft }, { merge: true })
    return { tokenId: nft.tokenId, txHash }
  } catch (err: any) {
    // Scrub (I4): log the message, never the raw error (may echo the key).
    console.error('[chain] ensureMinted failed', err?.message ?? String(err))
    await releaseClaim(uid)
    throw err
  }
}
