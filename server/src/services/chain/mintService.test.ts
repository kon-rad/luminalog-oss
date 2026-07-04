import { describe, it, expect, vi, beforeEach } from 'vitest'

const { chainEnabled } = vi.hoisted(() => ({ chainEnabled: vi.fn(() => true) }))
vi.mock('../../config', () => ({
  config: {
    SOULBOUND_CONTRACT_ADDRESS: '0xC0nTRAcT000000000000000000000000000000001',
    BASE_MINTER_PRIVATE_KEY: '0x' + '1'.repeat(64),
    BASE_RPC_URL: 'https://sepolia.base.org',
  },
  chainEnabled,
}))

// viem seam — all network ops are mocked; abi builders pass through.
const {
  readContract,
  waitForTransactionReceipt,
  getLogs,
  getBlockNumber,
  writeContract,
  parseEventLogs,
} = vi.hoisted(() => ({
  readContract: vi.fn(),
  waitForTransactionReceipt: vi.fn(),
  getLogs: vi.fn(),
  getBlockNumber: vi.fn(),
  writeContract: vi.fn(),
  parseEventLogs: vi.fn(),
}))
vi.mock('viem', () => ({
  createPublicClient: vi.fn(() => ({
    readContract,
    waitForTransactionReceipt,
    getLogs,
    getBlockNumber,
  })),
  createWalletClient: vi.fn(() => ({ writeContract })),
  http: vi.fn(),
  parseAbi: (x: any) => x,
  parseAbiItem: (x: any) => x,
  parseEventLogs,
}))
vi.mock('viem/accounts', () => ({
  privateKeyToAccount: vi.fn(() => ({ address: '0xMINTER0000000000000000000000000000000001' })),
}))
vi.mock('viem/chains', () => ({ baseSepolia: { id: 84532 } }))

let store: Record<string, any> = {}
const docRef = (c: string, id: string) => ({
  get: async () => ({ data: () => store[`${c}/${id}`] }),
  set: async (data: any, opts: any) => {
    const key = `${c}/${id}`
    store[key] = opts?.merge ? { ...(store[key] || {}), ...data } : data
    return undefined
  },
})
vi.mock('../../middleware/firebaseAuth', () => ({
  db: {
    collection: (c: string) => ({ doc: (id: string) => docRef(c, id) }),
    // Minimal transaction double: get/set proxy straight to the doc ref. No
    // isolation/retry — tests drive concurrency deterministically via the store.
    runTransaction: async (fn: any) =>
      fn({
        get: (ref: any) => ref.get(),
        set: (ref: any, data: any, opts: any) => ref.set(data, opts),
      }),
  },
}))

import { ensureMinted } from './mintService'

const USER_ADDR = '0xUsER00000000000000000000000000000000A001'
const ZERO = '0x0000000000000000000000000000000000000000'

beforeEach(() => {
  store = {}
  vi.clearAllMocks()
  chainEnabled.mockReturnValue(true)
})

describe('ensureMinted', () => {
  it('mints when the address holds no token and persists nft from the Transfer event', async () => {
    store['users/uid1'] = { wallet: { provider: 'cdp', address: USER_ADDR } }
    readContract.mockResolvedValue(0n) // balanceOf == 0
    writeContract.mockResolvedValue('0xTXHASH')
    waitForTransactionReceipt.mockResolvedValue({ logs: ['rawlog'], status: 'success' })
    parseEventLogs.mockReturnValue([{ args: { from: ZERO, to: USER_ADDR, tokenId: 7n } }])

    const res = await ensureMinted('uid1')

    expect(writeContract).toHaveBeenCalledOnce()
    const call = writeContract.mock.calls[0][0]
    expect(call.functionName).toBe('mint')
    expect(call.args).toEqual([USER_ADDR])
    expect(res!.tokenId).toBe('7')
    expect(store['users/uid1'].nft).toMatchObject({
      tokenId: '7',
      contract: '0xC0nTRAcT000000000000000000000000000000001',
      chain: 'base-sepolia',
      txHash: '0xTXHASH',
      walletAddress: USER_ADDR,
      status: 'minted',
    })
  })

  it('is idempotent: returns the stored tokenId without any chain calls', async () => {
    store['users/uid1'] = {
      wallet: { address: USER_ADDR },
      nft: { tokenId: '42', contract: '0xC', chain: 'base-sepolia' },
    }
    const res = await ensureMinted('uid1')
    expect(res!.tokenId).toBe('42')
    expect(readContract).not.toHaveBeenCalled()
    expect(writeContract).not.toHaveBeenCalled()
  })

  it('recovers tokenId from Transfer logs when already minted but not persisted', async () => {
    store['users/uid1'] = { wallet: { address: USER_ADDR } }
    readContract.mockResolvedValue(1n) // balanceOf == 1 → already minted
    getBlockNumber.mockResolvedValue(10_000n)
    getLogs.mockResolvedValue([{ args: { from: ZERO, to: USER_ADDR, tokenId: 3n } }])

    const res = await ensureMinted('uid1')

    expect(writeContract).not.toHaveBeenCalled()
    expect(res!.tokenId).toBe('3')
    expect(store['users/uid1'].nft.tokenId).toBe('3')
    // I2: getLogs must be bounded — never fromBlock 0 when a wide history exists.
    expect(getLogs).toHaveBeenCalledOnce()
    expect(getLogs.mock.calls[0][0].fromBlock).toBe(1_000n) // 10_000 - 9_000 lookback
  })

  it('throws when the user has no provisioned wallet', async () => {
    store['users/uid1'] = {}
    await expect(ensureMinted('uid1')).rejects.toThrow(/wallet/i)
    expect(writeContract).not.toHaveBeenCalled()
    // C1: the failed claim is released so a later call can retry.
    expect(store['users/uid1'].nft.status).toBe('failed')
  })

  it('C1: backs off without submitting when another worker holds a fresh mint claim', async () => {
    store['users/uid1'] = {
      wallet: { address: USER_ADDR },
      nft: { status: 'minting', mintStartedAt: Date.now() },
    }
    const res = await ensureMinted('uid1')
    expect(res).toBeUndefined()
    expect(readContract).not.toHaveBeenCalled()
    expect(writeContract).not.toHaveBeenCalled()
  })

  it('C1: reclaims a STALE mint claim (older than the TTL) and proceeds to mint', async () => {
    store['users/uid1'] = {
      wallet: { address: USER_ADDR },
      nft: { status: 'minting', mintStartedAt: Date.now() - 5 * 60 * 1000 },
    }
    readContract.mockResolvedValue(0n)
    writeContract.mockResolvedValue('0xTXHASH')
    waitForTransactionReceipt.mockResolvedValue({ logs: ['rawlog'], status: 'success' })
    parseEventLogs.mockReturnValue([{ args: { from: ZERO, to: USER_ADDR, tokenId: 9n } }])

    const res = await ensureMinted('uid1')
    expect(writeContract).toHaveBeenCalledOnce()
    expect(res!.tokenId).toBe('9')
  })

  it('I1: throws (and does not persist a token) when the receipt reverted', async () => {
    store['users/uid1'] = { wallet: { address: USER_ADDR } }
    readContract.mockResolvedValue(0n)
    writeContract.mockResolvedValue('0xREVERTED')
    waitForTransactionReceipt.mockResolvedValue({ logs: [], status: 'reverted' })

    await expect(ensureMinted('uid1')).rejects.toThrow(/revert/i)
    expect(parseEventLogs).not.toHaveBeenCalled()
    expect(store['users/uid1'].nft.tokenId).toBeUndefined()
    expect(store['users/uid1'].nft.status).toBe('failed')
  })

  it('guard: returns early without any chain/CDP work when chain is disabled', async () => {
    chainEnabled.mockReturnValue(false)
    store['users/uid1'] = { wallet: { address: USER_ADDR } }
    const res = await ensureMinted('uid1')
    expect(res).toBeUndefined()
    expect(readContract).not.toHaveBeenCalled()
    expect(writeContract).not.toHaveBeenCalled()
  })
})
