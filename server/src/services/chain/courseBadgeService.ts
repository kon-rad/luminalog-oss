import { createPublicClient, createWalletClient, http, parseAbi, parseEventLogs } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, baseSepolia } from 'viem/chains'
import { config, courseChainEnabled } from '../../config'
import { db } from '../../middleware/firebaseAuth'
import { ensureUserWallet } from './walletService'
import { runExclusiveMint } from './minterQueue'

const activeChain = config.BASE_CHAIN === 'base' ? base : baseSepolia

const BADGE_ABI = parseAbi([
  'function mint(address to, uint256 classId) returns (uint256)',
  'event BadgeMinted(address indexed to, uint256 indexed classId, uint256 indexed tokenId)',
])

export interface CourseBadge {
  tokenId: string
  contract: string
  chain: string
  txHash?: string
  walletAddress?: string
  mintedAt?: string
  status?: 'minting' | 'minted' | 'failed'
}

function contractAddress(): `0x${string}` {
  const addr = config.COURSE_BADGE_CONTRACT_ADDRESS
  if (!addr) throw new Error('COURSE_BADGE_CONTRACT_ADDRESS not configured')
  return addr as `0x${string}`
}

// Capture ReturnType of the concrete builders so the Base-specialized client
// types (which include 'deposit' tx types) match the cached singletons — this is
// what keeps writeContract from demanding an explicit `chain` per call.
function makePublicClient() {
  return createPublicClient({ chain: activeChain, transport: http(config.BASE_RPC_URL || undefined) })
}
let _public: ReturnType<typeof makePublicClient> | undefined
function publicClient() {
  return (_public ??= makePublicClient())
}

function makeWalletClient() {
  if (!config.BASE_MINTER_PRIVATE_KEY) throw new Error('BASE_MINTER_PRIVATE_KEY not configured')
  const account = privateKeyToAccount(config.BASE_MINTER_PRIVATE_KEY as `0x${string}`)
  return createWalletClient({ account, chain: activeChain, transport: http(config.BASE_RPC_URL || undefined) })
}
let _wallet: ReturnType<typeof makeWalletClient> | undefined
function walletClient() {
  return (_wallet ??= makeWalletClient())
}

function participantRef(classId: string, uid: string) {
  return db.collection('courseBadges').doc(classId).collection('participants').doc(uid)
}

/**
 * Mint the soulbound course badge for (uid, classId) and return the token.
 * Idempotent: a stored `badge.tokenId` short-circuits with no chain work. The
 * on-chain `minted[classId][to]` mapping is the final anti-duplicate backstop.
 * Requires a saved submission (participant.submittedAt).
 */
export async function mintCourseBadge(
  uid: string,
  classId: string,
): Promise<{ tokenId: string; txHash?: string; contract: string; chain: string }> {
  if (!courseChainEnabled()) throw new Error('course badge minting disabled (missing chain env)')

  const pRef = participantRef(classId, uid)
  const pSnap = await pRef.get()
  const p = pSnap.data() as { submittedAt?: unknown; badge?: CourseBadge } | undefined
  if (!p?.submittedAt) throw new Error('no submission: complete the quiz before minting')
  if (p.badge?.tokenId) {
    return {
      tokenId: p.badge.tokenId,
      txHash: p.badge.txHash,
      contract: contractAddress(),
      chain: config.BASE_CHAIN,
    }
  }

  const courseSnap = await db.collection('courseBadges').doc(classId).get()
  const chainClassId = (courseSnap.data() as { chainClassId?: number } | undefined)?.chainClassId
  if (typeof chainClassId !== 'number') throw new Error(`course ${classId} has no chainClassId`)

  const address = await ensureUserWallet(uid)
  if (!address) throw new Error('wallet provisioning failed')

  const contract = contractAddress()
  await pRef.set({ badge: { status: 'minting' } }, { merge: true })

  try {
    const pub = publicClient()
    const { hash, receipt } = await runExclusiveMint(async () => {
      const h = await walletClient().writeContract({
        address: contract,
        abi: BADGE_ABI,
        functionName: 'mint',
        args: [address as `0x${string}`, BigInt(chainClassId)],
      })
      const r = await pub.waitForTransactionReceipt({ hash: h as `0x${string}` })
      return { hash: h, receipt: r }
    })
    if (receipt.status !== 'success') throw new Error('mint reverted: ' + hash)
    const events = parseEventLogs({ abi: BADGE_ABI, logs: receipt.logs, eventName: 'BadgeMinted' })
    const minted = events.find(
      (e: any) => (e.args.to as string)?.toLowerCase() === address.toLowerCase(),
    )
    if (!minted) throw new Error('mint succeeded but no BadgeMinted event for the user')
    const tokenId = ((minted as any).args.tokenId as bigint).toString()

    const badge: CourseBadge = {
      tokenId,
      contract,
      chain: config.BASE_CHAIN,
      txHash: hash,
      walletAddress: address,
      mintedAt: new Date().toISOString(),
      status: 'minted',
    }
    await pRef.set({ badge }, { merge: true })
    await db.collection('courseBadgeTokens').doc(tokenId).set({ classId, uid })
    return { tokenId, txHash: hash, contract, chain: config.BASE_CHAIN }
  } catch (err: any) {
    console.error('[courseBadge] mint failed', err?.message ?? String(err))
    await pRef.set({ badge: { status: 'failed' } }, { merge: true }).catch(() => {})
    throw err
  }
}
