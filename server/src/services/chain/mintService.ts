import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseAbiItem,
  parseEventLogs,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'
import { config } from '../../config'
import { db } from '../../middleware/firebaseAuth'

/** The soulbound token minted to a user, stored on `users/{uid}.nft`. */
export interface UserNft {
  tokenId: string
  contract: string
  chain: string
  txHash?: string
  mintedAt: string
}

// v1 targets Base Sepolia. Bump to 'base' + mainnet chain when we promote.
const CHAIN = 'base-sepolia'
const DEFAULT_RPC = 'https://sepolia.base.org'

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
    chain: baseSepolia,
    transport: http(config.BASE_RPC_URL || DEFAULT_RPC),
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
    chain: baseSepolia,
    transport: http(config.BASE_RPC_URL || DEFAULT_RPC),
  })
}
let _wallet: ReturnType<typeof makeWalletClient> | undefined
function walletClient() {
  return (_wallet ??= makeWalletClient())
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
export async function ensureMinted(uid: string): Promise<{ tokenId: string; txHash?: string }> {
  const userRef = db.collection('users').doc(uid)
  const snap = await userRef.get()
  const data = snap.data()

  const existing = data?.nft as UserNft | undefined
  if (existing?.tokenId) return { tokenId: existing.tokenId, txHash: existing.txHash }

  const address = (data?.wallet as { address?: string } | undefined)?.address
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
    const logs = await pub.getLogs({
      address: contract,
      event: TRANSFER_EVENT,
      args: { to: address as `0x${string}` },
      fromBlock: 0n,
      toBlock: 'latest',
    })
    if (!logs.length) throw new Error(`ensureMinted: ${address} holds a token but no Transfer log found`)
    tokenId = logs[logs.length - 1].args.tokenId as bigint
  } else {
    // account + chain come from the wallet client itself.
    txHash = await walletClient().writeContract({
      address: contract,
      abi: SOUL_ABI,
      functionName: 'mint',
      args: [address as `0x${string}`],
    })
    const receipt = await pub.waitForTransactionReceipt({ hash: txHash as `0x${string}` })
    const events = parseEventLogs({ abi: SOUL_ABI, logs: receipt.logs, eventName: 'Transfer' })
    const minted = events.find((e: any) => (e.args.to as string)?.toLowerCase() === address.toLowerCase())
    if (!minted) throw new Error('ensureMinted: mint succeeded but no Transfer event to the user was found')
    tokenId = (minted as any).args.tokenId as bigint
  }

  const nft: UserNft = {
    tokenId: tokenId.toString(),
    contract,
    chain: CHAIN,
    txHash,
    mintedAt: new Date().toISOString(),
  }
  await userRef.set({ nft }, { merge: true })
  return { tokenId: nft.tokenId, txHash }
}
