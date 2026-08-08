# Argo Course Badge NFT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a soulbound proof-of-participation NFT ("Course Badge") that class attendees mint by scanning a QR code and completing a quiz, delivered to their existing Coinbase wallet on Base mainnet.

**Architecture:** A new ERC-721 + ERC-5192 contract (`ArgoCourseBadge`) mirrors the shipped `LuminaSoul`. The existing CDP wallet + viem minter stack is reused; a new `courseBadgeService.mintCourseBadge(uid, classId)` mints `mint(to, classId)`. Class sessions live in a Firestore `courseBadges/{classId}` collection; attendees submit answers via an authed API and then mint. A public metadata endpoint serves per-token ERC-721 JSON (class facts + Luma image + participant first name; never answers). A Next.js `/badge/[classId]` page runs the QR → quiz → mint flow.

**Tech Stack:** Solidity 0.8.24 + Foundry; Node/TypeScript + Express + viem + `@coinbase/cdp-sdk` + firebase-admin; Vitest; Next.js (App Router) + Firebase Auth.

## Global Constraints

- Solidity pragma **`^0.8.24`**; foundry `solc = "0.8.24"`, optimizer on, 200 runs (matches `contracts/foundry.toml`).
- Contract must be **soulbound** via ERC-5192 (`_update` blocks all transfers; `locked()` returns true), `Ownable2Step`, `renounceOwnership` reverts — copy `LuminaSoul.sol` exactly for these.
- Base network is selected by **`BASE_CHAIN`** (`base` mainnet | `base-sepolia`); CDP creds, `BASE_RPC_URL`, `BASE_MINTER_PRIVATE_KEY` are **shared** with the Soul path. New env vars are **`.optional()`** so the server still boots pre-deploy.
- Server auth: authed routers call `.use(firebaseAuth)` and read `(req as any).uid`; public routers omit it. Mount new routers in `server/src/index.ts` beside `soulRouter`/`nftRouter`.
- Tests: **Vitest** (`cd server && npx vitest run <file>`); mock `../middleware/firebaseAuth` (see `server/src/routes/nft.test.ts`). Contract tests: `cd contracts && forge test`.
- **Privacy rule:** quiz/short answers are NEVER returned by the public metadata endpoint and never go on-chain. Only class facts + participant **first name** + the Luma image are public.
- One badge per (wallet, class): enforced on-chain (`minted[classId][to]`) AND off-chain (participant `badge.tokenId`).
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. Work on branch `feature/argo-course-badge-nft`.

---

### Task 1: `ArgoCourseBadge` contract + tests + deploy script

**Files:**
- Create: `contracts/src/ArgoCourseBadge.sol`
- Create: `contracts/test/ArgoCourseBadge.t.sol`
- Create: `contracts/script/DeployArgoCourseBadge.s.sol`

**Interfaces:**
- Produces (consumed by Task 3 ABI): `mint(address to, uint256 classId) returns (uint256 tokenId)`, `event BadgeMinted(address indexed to, uint256 indexed classId, uint256 indexed tokenId)`, `mapping classOf(uint256)->uint256`, `mapping minted(uint256 classId, address holder)->bool`, `function locked(uint256) view returns (bool)`, `function tokenURI(uint256) view returns (string)`, `setBaseURI(string)`.

- [ ] **Step 1: Write the failing test**

Create `contracts/test/ArgoCourseBadge.t.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ArgoCourseBadge} from "../src/ArgoCourseBadge.sol";

contract ArgoCourseBadgeTest is Test {
    ArgoCourseBadge badge;
    address owner = address(0xA11CE);
    address alice = address(0xB0B);
    address bob = address(0xCAFE);
    string constant BASE = "https://api.luminalog.com/v1/course-badge/";

    function setUp() public {
        badge = new ArgoCourseBadge("Argo Course Badge", "ARGOCB", BASE, owner);
    }

    function test_ownerMintsAndTracksClass() public {
        vm.prank(owner);
        uint256 id = badge.mint(alice, 7);
        assertEq(badge.ownerOf(id), alice);
        assertEq(badge.classOf(id), 7);
        assertTrue(badge.minted(7, alice));
        assertTrue(badge.locked(id));
    }

    function test_tokenURIFormat() public {
        vm.prank(owner);
        uint256 id = badge.mint(alice, 1);
        assertEq(badge.tokenURI(id), string.concat(BASE, vm.toString(id), ".json"));
    }

    function test_revertsOnSecondMintSameClass() public {
        vm.startPrank(owner);
        badge.mint(alice, 3);
        vm.expectRevert(bytes("BADGE: already minted"));
        badge.mint(alice, 3);
        vm.stopPrank();
    }

    function test_sameUserDifferentClassesOk() public {
        vm.startPrank(owner);
        uint256 a = badge.mint(alice, 1);
        uint256 b = badge.mint(alice, 2);
        vm.stopPrank();
        assertEq(badge.balanceOf(alice), 2);
        assertTrue(a != b);
    }

    function test_nonOwnerCannotMint() public {
        vm.prank(alice);
        vm.expectRevert();
        badge.mint(alice, 1);
    }

    function test_soulbound_transferReverts() public {
        vm.prank(owner);
        uint256 id = badge.mint(alice, 1);
        vm.prank(alice);
        vm.expectRevert(bytes("BADGE: non-transferable"));
        badge.transferFrom(alice, bob, id);
    }

    function test_renounceReverts() public {
        vm.prank(owner);
        vm.expectRevert(bytes("BADGE: ownership required"));
        badge.renounceOwnership();
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd contracts && forge test --match-contract ArgoCourseBadgeTest -vv`
Expected: FAIL — `ArgoCourseBadge` source not found / does not compile.

- [ ] **Step 3: Write the contract**

Create `contracts/src/ArgoCourseBadge.sol` (mirrors `LuminaSoul.sol`, adds per-class mint):

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IERC4906} from "@openzeppelin/contracts/interfaces/IERC4906.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// @dev ERC-5192 minimal soulbound interface.
interface IERC5192 {
    event Locked(uint256 tokenId);
    function locked(uint256 tokenId) external view returns (bool);
}

/// Soulbound proof-of-participation badges for Argo classes. One unique token
/// per (wallet, classId). Metadata is dynamic and hosted off-chain
/// (tokenURI = baseURI + tokenId + ".json"), so badge art costs no gas to change.
contract ArgoCourseBadge is ERC721, Ownable2Step, IERC4906, IERC5192 {
    using Strings for uint256;

    string private _base;
    uint256 private _nextId = 1;

    /// classId => holder => already minted (one badge per wallet per class).
    mapping(uint256 => mapping(address => bool)) public minted;
    /// tokenId => classId it was minted for (on-chain traceability).
    mapping(uint256 => uint256) public classOf;

    event BadgeMinted(address indexed to, uint256 indexed classId, uint256 indexed tokenId);

    constructor(string memory name_, string memory symbol_, string memory baseURI_, address owner_)
        ERC721(name_, symbol_)
        Ownable(owner_)
    {
        _base = baseURI_;
    }

    function mint(address to, uint256 classId) external onlyOwner returns (uint256 tokenId) {
        require(!minted[classId][to], "BADGE: already minted");
        minted[classId][to] = true;
        tokenId = _nextId++;
        classOf[tokenId] = classId;
        _mint(to, tokenId);
        emit Locked(tokenId);
        emit BadgeMinted(to, classId, tokenId);
    }

    function locked(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return true;
    }

    /// Block renounce so an immutable contract can never lose its admin.
    function renounceOwnership() public view override onlyOwner {
        revert("BADGE: ownership required");
    }

    function setBaseURI(string calldata baseURI_) external onlyOwner {
        _base = baseURI_;
    }

    /// Nudge marketplaces to re-fetch one token's metadata (ERC-4906).
    function refreshMetadata(uint256 tokenId) external onlyOwner {
        _requireOwned(tokenId);
        emit MetadataUpdate(tokenId);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string(abi.encodePacked(_base, tokenId.toString(), ".json"));
    }

    function supportsInterface(bytes4 id) public view override(ERC721, IERC165) returns (bool) {
        return id == 0xb45a3c0e /* ERC-5192 */ || id == 0x49064906 /* ERC-4906 */ || super.supportsInterface(id);
    }

    /// Soulbound: allow mint (from == 0), block every transfer.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        require(from == address(0), "BADGE: non-transferable");
        return super._update(to, tokenId, auth);
    }
}
```

- [ ] **Step 4: Write the deploy script**

Create `contracts/script/DeployArgoCourseBadge.s.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {ArgoCourseBadge} from "../src/ArgoCourseBadge.sol";

/// Reads config from env — NO secrets committed. Run against Base Sepolia first.
///   PRIVATE_KEY   deployer/owner key (also the minter)
///   BASE_URI      e.g. https://api.luminalog.com/v1/course-badge/
contract DeployArgoCourseBadge is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        string memory baseURI = vm.envString("BASE_URI");
        address owner = vm.addr(pk);
        vm.startBroadcast(pk);
        new ArgoCourseBadge("Argo Course Badge", "ARGOCB", baseURI, owner);
        vm.stopBroadcast();
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd contracts && forge test --match-contract ArgoCourseBadgeTest -vv`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add contracts/src/ArgoCourseBadge.sol contracts/test/ArgoCourseBadge.t.sol contracts/script/DeployArgoCourseBadge.s.sol
git commit -m "feat(contracts): add soulbound ArgoCourseBadge ERC-721 + tests + deploy script

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Config — course-badge env vars + `courseChainEnabled()`

**Files:**
- Modify: `server/src/config.ts` (add fields to the zod schema near the Soul block ~line 90-115; add helper near `chainEnabled` ~line 155-165)

**Interfaces:**
- Produces: `config.COURSE_BADGE_CONTRACT_ADDRESS`, `config.COURSE_BADGE_DEPLOY_BLOCK`, `config.COURSE_BADGE_METADATA_BASE_URL`, `courseChainEnabled(): boolean`.

- [ ] **Step 1: Add schema fields**

In `server/src/config.ts`, immediately after the `NFT_METADATA_BASE_URL: z.string().optional(),` line, add:

```typescript
  // Argo Course Badge NFT (Base) — separate contract from the Soul. Optional so
  // the server boots before deploy; make required only when the code needs them.
  COURSE_BADGE_CONTRACT_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, 'COURSE_BADGE_CONTRACT_ADDRESS must be 0x + 40 hex')
    .optional(),
  COURSE_BADGE_DEPLOY_BLOCK: z.coerce.number().int().nonnegative().optional(),
  COURSE_BADGE_METADATA_BASE_URL: z.string().optional(),
```

- [ ] **Step 2: Add the helper**

Immediately after the `chainEnabled()` function, add:

```typescript
/**
 * True when the shared chain path is configured AND the course-badge contract
 * address is set. Course-badge minting no-ops/throws clearly when false.
 */
export function courseChainEnabled(): boolean {
  return chainEnabled() && Boolean(config.COURSE_BADGE_CONTRACT_ADDRESS)
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd server && npx tsc --noEmit`
Expected: PASS (no type errors).

- [ ] **Step 4: Commit**

```bash
git add server/src/config.ts
git commit -m "feat(server): add course-badge env config + courseChainEnabled

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Shared minter queue + `courseBadgeService.mintCourseBadge`

**Files:**
- Create: `server/src/services/chain/minterQueue.ts`
- Modify: `server/src/services/chain/mintService.ts` (replace the local `_mintChain`/`runExclusiveMint` with the shared import — lines ~120-133)
- Create: `server/src/services/chain/courseBadgeService.ts`
- Test: `server/src/services/chain/courseBadgeService.test.ts`

**Interfaces:**
- Consumes: `ensureUserWallet(uid)` from `./walletService`; the contract ABI from Task 1.
- Produces: `runExclusiveMint<T>(fn)` from `minterQueue`; `mintCourseBadge(uid, classId): Promise<{ tokenId: string; txHash?: string; contract: string; chain: string }>`.

- [ ] **Step 1: Create the shared minter queue**

Create `server/src/services/chain/minterQueue.ts`:

```typescript
// Single-flight queue for the ONE shared minter EOA. Both the Soul mint and the
// Course Badge mint submit from the same key, so their writeContract calls must
// be serialized process-wide or they fetch the same pending nonce and collide.
let _mintChain: Promise<unknown> = Promise.resolve()

export function runExclusiveMint<T>(fn: () => Promise<T>): Promise<T> {
  const result = _mintChain.then(fn, fn)
  // Keep the chain alive but never let a rejection poison the next submission.
  _mintChain = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}
```

- [ ] **Step 2: Point mintService at the shared queue**

In `server/src/services/chain/mintService.ts`, delete the local block:

```typescript
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
```

and add this import next to the other imports at the top of the file:

```typescript
import { runExclusiveMint } from './minterQueue'
```

- [ ] **Step 3: Verify Soul tests still pass**

Run: `cd server && npx vitest run` (or the chain/soul suites if present)
Expected: PASS — mintService behavior is unchanged (same queue, moved).

- [ ] **Step 4: Write the failing service test**

Create `server/src/services/chain/courseBadgeService.test.ts`. This tests the idempotent short-circuit (already-minted returns stored token, no chain work) and the disabled no-op — the parts that don't require a live chain.

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- config: chain enabled toggle per test ---
let enabled = true
vi.mock('../../config', () => ({
  config: { COURSE_BADGE_CONTRACT_ADDRESS: '0x'.padEnd(42, '1'), BASE_CHAIN: 'base' },
  chainEnabled: () => enabled,
  courseChainEnabled: () => enabled,
}))

// --- firestore doc store ---
let participant: any = null
let course: any = { chainClassId: 5 }
const setSpy = vi.fn(async () => {})
vi.mock('../../middleware/firebaseAuth', () => ({
  db: {
    collection: (name: string) => ({
      doc: () => ({
        get: async () => ({
          exists: true,
          data: () => (name === 'courseBadges' ? course : participant),
        }),
        collection: () => ({ doc: () => ({ get: async () => ({ data: () => participant }), set: setSpy }) }),
        set: setSpy,
      }),
    }),
  },
}))

vi.mock('./walletService', () => ({ ensureUserWallet: async () => '0xWALLET' }))

import { mintCourseBadge } from './courseBadgeService'

beforeEach(() => {
  enabled = true
  participant = null
  course = { chainClassId: 5 }
  setSpy.mockClear()
})

describe('mintCourseBadge', () => {
  it('returns the stored token without chain work when already minted', async () => {
    participant = { badge: { tokenId: '42', txHash: '0xabc', status: 'minted' } }
    const res = await mintCourseBadge('uid1', 'classA')
    expect(res.tokenId).toBe('42')
    expect(res.txHash).toBe('0xabc')
  })

  it('throws when the participant has no submission', async () => {
    participant = null // no submittedAt
    await expect(mintCourseBadge('uid1', 'classA')).rejects.toThrow(/no submission/i)
  })

  it('throws when chain is disabled', async () => {
    enabled = false
    participant = { submittedAt: 'now' }
    await expect(mintCourseBadge('uid1', 'classA')).rejects.toThrow(/disabled/i)
  })
})
```

- [ ] **Step 5: Run test to verify it fails**

Run: `cd server && npx vitest run src/services/chain/courseBadgeService.test.ts`
Expected: FAIL — `courseBadgeService` module not found.

- [ ] **Step 6: Write the service**

Create `server/src/services/chain/courseBadgeService.ts`:

```typescript
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

let _public: ReturnType<typeof createPublicClient> | undefined
function publicClient() {
  return (_public ??= createPublicClient({ chain: activeChain, transport: http(config.BASE_RPC_URL || undefined) }))
}

let _wallet: ReturnType<typeof createWalletClient> | undefined
function walletClient() {
  if (!config.BASE_MINTER_PRIVATE_KEY) throw new Error('BASE_MINTER_PRIVATE_KEY not configured')
  const account = privateKeyToAccount(config.BASE_MINTER_PRIVATE_KEY as `0x${string}`)
  return (_wallet ??= createWalletClient({ account, chain: activeChain, transport: http(config.BASE_RPC_URL || undefined) }))
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
    return { tokenId: p.badge.tokenId, txHash: p.badge.txHash, contract: contractAddress(), chain: config.BASE_CHAIN }
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
    const minted = events.find((e: any) => (e.args.to as string)?.toLowerCase() === address.toLowerCase())
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
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd server && npx vitest run src/services/chain/courseBadgeService.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Commit**

```bash
git add server/src/services/chain/minterQueue.ts server/src/services/chain/mintService.ts server/src/services/chain/courseBadgeService.ts server/src/services/chain/courseBadgeService.test.ts
git commit -m "feat(server): shared minter queue + mintCourseBadge service

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Public metadata endpoint `GET /v1/course-badge/:tokenId.json`

**Files:**
- Create: `server/src/routes/courseBadge.ts`
- Test: `server/src/routes/courseBadge.test.ts`

**Interfaces:**
- Consumes: Firestore `courseBadgeTokens/{tokenId}` → `{classId, uid}`; `courseBadges/{classId}` facts; participant `displayName`.
- Produces: `buildCourseBadgeMetadata(tokenId, fields)` (pure), `getCourseBadgeMetadata(tokenId)` (db), `courseBadgeRouter`.

- [ ] **Step 1: Write the failing test**

Create `server/src/routes/courseBadge.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { buildCourseBadgeMetadata } from './courseBadge'

describe('buildCourseBadgeMetadata', () => {
  const fields = {
    name: 'AI Power Users · Module 1',
    course: 'ai-power-users',
    module: 'Module 1',
    date: 'August 8, 2026',
    time: '7:00 PM',
    location: 'Network School',
    imageUrl: 'https://images.lu.ma/event123.png',
    firstName: 'Konrad',
  }

  it('builds ERC-721 metadata with class facts, image and participant first name', () => {
    const m = buildCourseBadgeMetadata('12', fields)
    expect(m.name).toBe('Argo Course Badge — AI Power Users · Module 1')
    expect(m.image).toBe('https://images.lu.ma/event123.png')
    expect(m.description).toContain('Konrad')
    expect(m.attributes).toEqual([
      { trait_type: 'Course', value: 'ai-power-users' },
      { trait_type: 'Module', value: 'Module 1' },
      { trait_type: 'Date', value: 'August 8, 2026' },
      { trait_type: 'Time', value: '7:00 PM' },
      { trait_type: 'Location', value: 'Network School' },
      { trait_type: 'Participant', value: 'Konrad' },
    ])
  })

  it('never leaks answers or sensitive keys', () => {
    const json = JSON.stringify(buildCourseBadgeMetadata('1', fields))
    for (const banned of ['answers', 'answer', 'quiz', 'uid', 'email', 'wallet']) {
      expect(json).not.toContain(`"${banned}"`)
    }
  })

  it('omits an empty module attribute', () => {
    const m = buildCourseBadgeMetadata('3', { ...fields, module: '' })
    expect(m.attributes.find(a => a.trait_type === 'Module')).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/routes/courseBadge.test.ts`
Expected: FAIL — `./courseBadge` not found.

- [ ] **Step 3: Write the route**

Create `server/src/routes/courseBadge.ts`:

```typescript
import { Router, Request, Response } from 'express'
import { db } from '../middleware/firebaseAuth'

export interface CourseBadgeMetadata {
  name: string
  description: string
  image: string
  attributes: { trait_type: string; value: string }[]
}

export interface CourseBadgeFields {
  name: string
  course: string
  module: string
  date: string
  time: string
  location: string
  imageUrl: string
  firstName: string
}

/** Pure ERC-721 metadata builder. Contains ONLY class facts + the participant's
 *  first name + the (Luma) image — never quiz answers or any user content. */
export function buildCourseBadgeMetadata(tokenId: string, f: CourseBadgeFields): CourseBadgeMetadata {
  const who = f.firstName?.trim() || 'A participant'
  const attributes = [
    { trait_type: 'Course', value: f.course },
    ...(f.module?.trim() ? [{ trait_type: 'Module', value: f.module }] : []),
    { trait_type: 'Date', value: f.date },
    { trait_type: 'Time', value: f.time },
    { trait_type: 'Location', value: f.location },
    { trait_type: 'Participant', value: who },
  ]
  return {
    name: `Argo Course Badge — ${f.name}`,
    description: `${who} completed ${f.name} on ${f.date} at ${f.location}.`,
    image: f.imageUrl,
    attributes,
  }
}

/** Resolve a tokenId to published-safe metadata via the reverse index. Returns
 *  null if the token is unknown. Reads ONLY publish-safe fields. */
export async function getCourseBadgeMetadata(tokenId: string): Promise<CourseBadgeMetadata | null> {
  const idxSnap = await db.collection('courseBadgeTokens').doc(tokenId).get()
  const idx = idxSnap.data() as { classId?: string; uid?: string } | undefined
  if (!idx?.classId || !idx?.uid) return null

  const courseSnap = await db.collection('courseBadges').doc(idx.classId).get()
  const c = courseSnap.data() as Partial<CourseBadgeFields> | undefined
  if (!c) return null

  const pSnap = await db.collection('courseBadges').doc(idx.classId).collection('participants').doc(idx.uid).get()
  const displayName = ((pSnap.data() as { displayName?: string } | undefined)?.displayName ?? '').trim()
  const firstName = displayName.split(/\s+/)[0] || ''

  return buildCourseBadgeMetadata(tokenId, {
    name: c.name ?? '',
    course: c.course ?? '',
    module: c.module ?? '',
    date: c.date ?? '',
    time: c.time ?? '',
    location: c.location ?? '',
    imageUrl: c.imageUrl ?? '',
    firstName,
  })
}

export const courseBadgeRouter = Router()

// GET /v1/course-badge/:file — matches the on-chain tokenURI (baseURI + id + ".json").
// Public (no auth): wallets + marketplaces fetch it.
courseBadgeRouter.get('/:file', async (req: Request, res: Response) => {
  const m = /^(\d+)\.json$/.exec(req.params.file)
  if (!m) return res.status(404).json({ error: 'not found' })
  try {
    const meta = await getCourseBadgeMetadata(m[1])
    if (!meta) return res.status(404).json({ error: 'not found' })
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.json(meta)
  } catch (err) {
    console.error('[course-badge] metadata failed', err)
    res.status(500).json({ error: 'internal' })
  }
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run src/routes/courseBadge.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/courseBadge.ts server/src/routes/courseBadge.test.ts
git commit -m "feat(server): public course-badge ERC-721 metadata endpoint

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Authed routes `GET/POST /v1/course/:classId(/submit|/mint)` + mounting

**Files:**
- Create: `server/src/routes/course.ts`
- Test: `server/src/routes/course.test.ts`
- Modify: `server/src/index.ts` (imports ~lines 12-16; mounts ~lines 31-35)

**Interfaces:**
- Consumes: `firebaseAuth`, `db`; `mintCourseBadge` from `../services/chain/courseBadgeService`.
- Produces: `courseRouter`; helper `validateSubmission(quiz, answers): string | null` (returns an error message or null).

- [ ] **Step 1: Write the failing test**

Create `server/src/routes/course.test.ts` (unit-tests the pure `validateSubmission` gate):

```typescript
import { describe, it, expect } from 'vitest'
import { validateSubmission } from './course'

const quiz = [
  { id: 'q1', type: 'mc', prompt: 'Pick', options: ['a', 'b'] },
  { id: 'q2', type: 'short', prompt: 'Say' },
]

describe('validateSubmission', () => {
  it('passes when every question has a non-empty answer', () => {
    expect(validateSubmission(quiz, { q1: 'a', q2: 'hello' })).toBeNull()
  })
  it('fails when a question is missing', () => {
    expect(validateSubmission(quiz, { q1: 'a' })).toMatch(/q2/)
  })
  it('fails when a short answer is blank', () => {
    expect(validateSubmission(quiz, { q1: 'a', q2: '   ' })).toMatch(/q2/)
  })
  it('fails when answers is not an object', () => {
    expect(validateSubmission(quiz, null as any)).toMatch(/answers/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/routes/course.test.ts`
Expected: FAIL — `./course` not found.

- [ ] **Step 3: Write the route**

Create `server/src/routes/course.ts`:

```typescript
import { Router, Request, Response } from 'express'
import admin from 'firebase-admin'
import { firebaseAuth, db } from '../middleware/firebaseAuth'
import { mintCourseBadge } from '../services/chain/courseBadgeService'

export interface QuizQuestion {
  id: string
  type: 'mc' | 'short'
  prompt: string
  options?: string[]
}

/** Completion gate: every quiz question must have a non-empty answer. Returns an
 *  error message (safe to send to the client) or null when valid. */
export function validateSubmission(quiz: QuizQuestion[], answers: unknown): string | null {
  if (!answers || typeof answers !== 'object') return 'answers must be an object'
  const a = answers as Record<string, unknown>
  for (const q of quiz) {
    const v = a[q.id]
    if (v === undefined || v === null) return `missing answer for ${q.id}`
    if (typeof v === 'string' && v.trim() === '') return `blank answer for ${q.id}`
  }
  return null
}

/** Public-safe class fields for the claim page (no admin-only internals). */
function publicClass(data: any) {
  return {
    name: data.name ?? '',
    course: data.course ?? '',
    module: data.module ?? '',
    date: data.date ?? '',
    time: data.time ?? '',
    location: data.location ?? '',
    imageUrl: data.imageUrl ?? '',
    contentUrl: data.contentUrl ?? null,
    active: data.active !== false,
    quiz: Array.isArray(data.quiz) ? data.quiz : [],
  }
}

export const courseRouter = Router()
courseRouter.use(firebaseAuth)

// GET /v1/course/:classId — class definition + the caller's own participation.
courseRouter.get('/:classId', async (req: Request, res: Response) => {
  const uid = (req as any).uid as string
  try {
    const snap = await db.collection('courseBadges').doc(req.params.classId).get()
    if (!snap.exists) return res.status(404).json({ error: 'not found' })
    const pSnap = await db
      .collection('courseBadges').doc(req.params.classId)
      .collection('participants').doc(uid).get()
    const p = pSnap.data() as any
    res.json({
      class: publicClass(snap.data()),
      participation: p ? { answers: p.answers ?? null, submittedAt: p.submittedAt ?? null, badge: p.badge ?? null } : null,
    })
  } catch (err) {
    console.error('[course] get failed', err)
    res.status(500).json({ error: 'internal' })
  }
})

// POST /v1/course/:classId/submit — save answers (completion-gated).
courseRouter.post('/:classId/submit', async (req: Request, res: Response) => {
  const uid = (req as any).uid as string
  try {
    const snap = await db.collection('courseBadges').doc(req.params.classId).get()
    if (!snap.exists) return res.status(404).json({ error: 'not found' })
    const data = snap.data() as any
    if (data.active === false) return res.status(403).json({ error: 'class closed' })

    const quiz: QuizQuestion[] = Array.isArray(data.quiz) ? data.quiz : []
    const answers = (req.body as { answers?: unknown })?.answers
    const problem = validateSubmission(quiz, answers)
    if (problem) return res.status(400).json({ error: problem })

    // displayName from the user doc (plaintext, first-name greeting field).
    const userDoc = await db.collection('users').doc(uid).get()
    const displayName = ((userDoc.data()?.displayName as string) ?? '').trim()

    await db.collection('courseBadges').doc(req.params.classId)
      .collection('participants').doc(uid)
      .set({ displayName, answers, submittedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
    res.json({ ok: true })
  } catch (err) {
    console.error('[course] submit failed', err)
    res.status(500).json({ error: 'internal' })
  }
})

// POST /v1/course/:classId/mint — mint the badge to the caller's wallet.
courseRouter.post('/:classId/mint', async (req: Request, res: Response) => {
  const uid = (req as any).uid as string
  try {
    const result = await mintCourseBadge(uid, req.params.classId)
    res.json(result)
  } catch (err: any) {
    const msg = err?.message ?? 'internal'
    const code = /no submission/i.test(msg) ? 400 : /disabled/i.test(msg) ? 503 : 500
    console.error('[course] mint failed', msg)
    res.status(code).json({ error: msg })
  }
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run src/routes/course.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Mount both routers in `index.ts`**

In `server/src/index.ts`, add imports after `import { nftRouter } from './routes/nft'`:

```typescript
import { courseRouter } from './routes/course'
import { courseBadgeRouter } from './routes/courseBadge'
```

and add mounts after the `app.use('/v1/nft', nftRouter)` line:

```typescript
app.use('/v1/course', courseRouter) // authed — quiz submit + mint
app.use('/v1/course-badge', courseBadgeRouter) // public (no auth) — ERC-721 metadata for tokenURI
```

- [ ] **Step 6: Verify the server compiles + full suite passes**

Run: `cd server && npx tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/course.ts server/src/routes/course.test.ts server/src/index.ts
git commit -m "feat(server): authed course submit/mint routes + mount routers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Firestore security rules

**Files:**
- Modify: `firestore.rules`

**Interfaces:**
- Produces: rules for `courseBadges/{classId}`, its `participants/{uid}` subcollection, and `courseBadgeTokens/{tokenId}`.

- [ ] **Step 1: Read the current rules to find the insertion point**

Run: `sed -n '1,80p' firestore.rules` — locate the closing of `match /databases/{database}/documents { ... }` and the existing `users/{uid}` block to mirror its `request.auth.uid == uid` idiom.

- [ ] **Step 2: Add the course rules**

Inside `match /databases/{database}/documents { ... }`, add:

```
    // Course badge class definitions — world-readable (the claim page renders
    // them; quiz has no answer keys). Writes are server-only (Admin SDK).
    match /courseBadges/{classId} {
      allow read: if true;
      allow write: if false;

      // A participant's answers + badge — private to the owner. Client writes go
      // through the authed server API, so direct writes stay closed.
      match /participants/{uid} {
        allow read: if request.auth != null && request.auth.uid == uid;
        allow write: if false;
      }
    }

    // tokenId -> {classId, uid} reverse index — server-only.
    match /courseBadgeTokens/{tokenId} {
      allow read, write: if false;
    }
```

- [ ] **Step 3: Verify rules compile (dry compile)**

Run: `cd .. && npx -y firebase-tools firestore:rules:canary --help >/dev/null 2>&1 || true` then validate with the emulator if available: `firebase emulators:exec --only firestore "true"` (skip if the emulator isn't installed — the deploy step will validate). At minimum confirm the file has balanced braces by re-reading it.

Expected: no syntax errors reported.

- [ ] **Step 4: Commit**

```bash
git add firestore.rules
git commit -m "feat(rules): course badge classes public-read, answers owner-only

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Admin script `createCourseBadge.ts`

**Files:**
- Create: `server/src/scripts/createCourseBadge.ts`
- Create: `server/src/scripts/example-course.json` (sample input, committed as a template)

**Interfaces:**
- Consumes: a JSON file path (class facts + quiz). Writes `courseBadges/{classId}` with an assigned `chainClassId`.

- [ ] **Step 1: Write the sample input template**

Create `server/src/scripts/example-course.json`:

```json
{
  "classId": "ai-power-users-m1-2026-08-08",
  "name": "AI Power Users · Module 1",
  "course": "ai-power-users",
  "module": "Module 1",
  "date": "August 8, 2026",
  "time": "7:00 PM",
  "location": "Network School",
  "imageUrl": "https://images.lu.ma/REPLACE.png",
  "lumaEventId": "",
  "contentUrl": "https://myargoquest.com/courses/ai-power-users/module-1",
  "active": true,
  "quiz": [
    { "id": "q1", "type": "mc", "prompt": "Which tool fits a quick factual lookup?", "options": ["A spreadsheet", "A chat assistant", "A calculator"] },
    { "id": "q2", "type": "short", "prompt": "Name one thing you learned today." }
  ]
}
```

- [ ] **Step 2: Write the script**

Create `server/src/scripts/createCourseBadge.ts`:

```typescript
/**
 * Create/replace a course-badge class session from a JSON file, assigning the
 * next on-chain `chainClassId` transactionally.
 *   npx tsx src/scripts/createCourseBadge.ts src/scripts/example-course.json
 */
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import admin from 'firebase-admin'
import { db } from '../middleware/firebaseAuth'

async function main(): Promise<void> {
  const path = process.argv[2]
  if (!path) {
    console.error('Usage: npx tsx src/scripts/createCourseBadge.ts <course.json>')
    process.exit(1)
  }
  const input = JSON.parse(readFileSync(path, 'utf8'))
  const { classId, ...fields } = input
  if (!classId) throw new Error('classId is required')
  if (!Array.isArray(fields.quiz) || fields.quiz.length === 0) throw new Error('quiz must be a non-empty array')

  const docRef = db.collection('courseBadges').doc(classId)
  const counterRef = db.collection('meta').doc('courseBadgeCounter')

  const chainClassId = await db.runTransaction(async (tx) => {
    const existing = await tx.get(docRef)
    if (existing.exists && typeof existing.data()?.chainClassId === 'number') {
      // Preserve the chainClassId across re-runs (the on-chain id must be stable).
      tx.set(docRef, { ...fields }, { merge: true })
      return existing.data()!.chainClassId as number
    }
    const cSnap = await tx.get(counterRef)
    const next = ((cSnap.data()?.value as number) ?? 0) + 1
    tx.set(counterRef, { value: next }, { merge: true })
    tx.set(docRef, { ...fields, chainClassId: next }, { merge: true })
    return next
  })

  console.log(`[course] wrote courseBadges/${classId} (chainClassId=${chainClassId})`)
  console.log(`[course] QR target: https://myargoquest.com/badge/${classId}`)
  await admin.app().delete()
}

main().catch((e) => {
  console.error('[course] failed', e)
  process.exit(1)
})
```

- [ ] **Step 3: Type-check the script**

Run: `cd server && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/src/scripts/createCourseBadge.ts server/src/scripts/example-course.json
git commit -m "feat(server): admin script to author course-badge class sessions

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Web API proxy routes

**Files:**
- Create: `web/src/app/api/course/[classId]/route.ts` (GET)
- Create: `web/src/app/api/course/[classId]/submit/route.ts` (POST)
- Create: `web/src/app/api/course/[classId]/mint/route.ts` (POST)

**Interfaces:**
- Consumes: the caller's `authorization` header; `process.env.API_URL`.
- Produces: same-origin proxies to `/v1/course/:classId`, `/v1/course/:classId/submit`, `/v1/course/:classId/mint`.

- [ ] **Step 1: Write the GET proxy**

Create `web/src/app/api/course/[classId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.API_URL ?? 'https://api.luminalog.com'

export async function GET(req: NextRequest, { params }: { params: { classId: string } }) {
  const auth = req.headers.get('authorization')
  if (!auth) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  try {
    const res = await fetch(`${API_URL}/v1/course/${encodeURIComponent(params.classId)}`, {
      headers: { authorization: auth },
      cache: 'no-store',
    })
    const body = await res.text()
    return new NextResponse(body, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    })
  } catch (err) {
    console.error('[api/course] proxy failed', err)
    return NextResponse.json({ error: 'upstream_unreachable' }, { status: 502 })
  }
}
```

- [ ] **Step 2: Write the submit proxy**

Create `web/src/app/api/course/[classId]/submit/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.API_URL ?? 'https://api.luminalog.com'

export async function POST(req: NextRequest, { params }: { params: { classId: string } }) {
  const auth = req.headers.get('authorization')
  if (!auth) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  try {
    const body = await req.text()
    const res = await fetch(`${API_URL}/v1/course/${encodeURIComponent(params.classId)}/submit`, {
      method: 'POST',
      headers: { authorization: auth, 'content-type': 'application/json' },
      body,
      cache: 'no-store',
    })
    const out = await res.text()
    return new NextResponse(out, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    })
  } catch (err) {
    console.error('[api/course/submit] proxy failed', err)
    return NextResponse.json({ error: 'upstream_unreachable' }, { status: 502 })
  }
}
```

- [ ] **Step 3: Write the mint proxy**

Create `web/src/app/api/course/[classId]/mint/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.API_URL ?? 'https://api.luminalog.com'

export async function POST(req: NextRequest, { params }: { params: { classId: string } }) {
  const auth = req.headers.get('authorization')
  if (!auth) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  try {
    const res = await fetch(`${API_URL}/v1/course/${encodeURIComponent(params.classId)}/mint`, {
      method: 'POST',
      headers: { authorization: auth, 'content-type': 'application/json' },
      cache: 'no-store',
    })
    const out = await res.text()
    return new NextResponse(out, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    })
  } catch (err) {
    console.error('[api/course/mint] proxy failed', err)
    return NextResponse.json({ error: 'upstream_unreachable' }, { status: 502 })
  }
}
```

- [ ] **Step 4: Verify the web app type-checks**

Run: `cd web && npx tsc --noEmit`
Expected: PASS (or the project's `npm run lint` if tsc isn't wired standalone).

- [ ] **Step 5: Commit**

```bash
git add web/src/app/api/course
git commit -m "feat(web): same-origin proxy routes for course submit/mint

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Web claim page `/badge/[classId]`

**Files:**
- Create: `web/src/lib/useCourseBadge.ts` (data hook + explorer URL)
- Create: `web/src/app/badge/[classId]/page.tsx` (client page)

**Interfaces:**
- Consumes: `useAuth()` from `@/lib/auth-context`; the proxy routes from Task 8.
- Produces: the QR → quiz → mint UI.

- [ ] **Step 1: Write the data hook**

Create `web/src/lib/useCourseBadge.ts`:

```typescript
'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './auth-context'

export interface QuizQuestion {
  id: string
  type: 'mc' | 'short'
  prompt: string
  options?: string[]
}

export interface CourseClass {
  name: string
  course: string
  module: string
  date: string
  time: string
  location: string
  imageUrl: string
  contentUrl: string | null
  active: boolean
  quiz: QuizQuestion[]
}

export interface CourseBadge {
  tokenId: string
  contract?: string
  chain?: string
  txHash?: string
  status?: 'minting' | 'minted' | 'failed'
}

export interface CoursePayload {
  class: CourseClass
  participation: { answers: Record<string, string> | null; submittedAt: unknown; badge: CourseBadge | null } | null
}

export function basescanBadgeUrl(b: CourseBadge): string {
  const base = b.chain === 'base' ? 'https://basescan.org' : 'https://sepolia.basescan.org'
  return `${base}/nft/${b.contract}/${b.tokenId}`
}

export function useCourseBadge(classId: string) {
  const { user } = useAuth()
  const [data, setData] = useState<CoursePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return }
    try {
      setLoading(true)
      const token = await user.getIdToken()
      const res = await fetch(`/api/course/${classId}`, { headers: { authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(`course ${res.status}`)
      setData(await res.json())
      setError(null)
    } catch (e: any) {
      setError(e?.message ?? 'failed')
    } finally {
      setLoading(false)
    }
  }, [user, classId])

  useEffect(() => { void load() }, [load])

  const submit = useCallback(async (answers: Record<string, string>) => {
    if (!user) throw new Error('not signed in')
    const token = await user.getIdToken()
    const res = await fetch(`/api/course/${classId}/submit`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ answers }),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? `submit ${res.status}`)
  }, [user, classId])

  const mint = useCallback(async (): Promise<CourseBadge> => {
    if (!user) throw new Error('not signed in')
    const token = await user.getIdToken()
    const res = await fetch(`/api/course/${classId}/mint`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? `mint ${res.status}`)
    return res.json()
  }, [user, classId])

  return { data, loading, error, reload: load, submit, mint }
}
```

- [ ] **Step 2: Write the claim page**

Create `web/src/app/badge/[classId]/page.tsx`:

```tsx
'use client'

import { use, useMemo, useState } from 'react'
import Image from 'next/image'
import { useAuth } from '@/lib/auth-context'
import { useCourseBadge, basescanBadgeUrl, type CourseBadge } from '@/lib/useCourseBadge'

export default function BadgeClaimPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = use(params)
  const { user, signInWithGoogle, signInWithApple } = useAuth()
  const { data, loading, error, reload, submit, mint } = useCourseBadge(classId)

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [minted, setMinted] = useState<CourseBadge | null>(null)
  const [flowError, setFlowError] = useState<string | null>(null)

  const existingBadge = data?.participation?.badge?.tokenId ? data.participation.badge : null
  const badge = minted ?? existingBadge

  const quiz = data?.class.quiz ?? []
  const allAnswered = useMemo(
    () => quiz.length > 0 && quiz.every(q => (answers[q.id] ?? '').trim() !== ''),
    [quiz, answers],
  )

  if (!user) {
    return (
      <main style={{ maxWidth: 560, margin: '0 auto', padding: 24 }}>
        <h1>Claim your Argo Course Badge</h1>
        <p>Sign in to answer a couple of questions and mint your proof of participation.</p>
        <button onClick={() => void signInWithGoogle()}>Sign in with Google</button>
        <button onClick={() => void signInWithApple()} style={{ marginLeft: 12 }}>Sign in with Apple</button>
      </main>
    )
  }

  if (loading) return <main style={{ padding: 24 }}>Loading…</main>
  if (error || !data) return <main style={{ padding: 24 }}>Could not load this class. <button onClick={() => void reload()}>Retry</button></main>

  const c = data.class

  if (badge) {
    return (
      <main style={{ maxWidth: 560, margin: '0 auto', padding: 24, textAlign: 'center' }}>
        <h1>Badge minted 🎉</h1>
        {c.imageUrl ? <Image src={c.imageUrl} alt={c.name} width={360} height={360} style={{ borderRadius: 16, maxWidth: '100%', height: 'auto' }} /> : null}
        <p>{c.name} — {c.date}</p>
        {badge.contract ? <p><a href={basescanBadgeUrl(badge)} target="_blank" rel="noreferrer">View on BaseScan</a></p> : null}
      </main>
    )
  }

  if (!c.active) return <main style={{ padding: 24 }}><h1>{c.name}</h1><p>Badge claiming for this class is closed.</p></main>

  async function onMint() {
    setBusy(true); setFlowError(null)
    try {
      await submit(answers)
      const b = await mint()
      setMinted(b)
    } catch (e: any) {
      setFlowError(e?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: 24 }}>
      {c.imageUrl ? <Image src={c.imageUrl} alt={c.name} width={520} height={520} style={{ borderRadius: 16, maxWidth: '100%', height: 'auto' }} /> : null}
      <h1>{c.name}</h1>
      <p>{[c.module, c.date, c.time, c.location].filter(Boolean).join(' · ')}</p>

      <form onSubmit={(e) => { e.preventDefault(); void onMint() }}>
        {quiz.map((q) => (
          <fieldset key={q.id} style={{ margin: '16px 0', border: 'none', padding: 0 }}>
            <legend style={{ fontWeight: 600 }}>{q.prompt}</legend>
            {q.type === 'mc' ? (
              (q.options ?? []).map((opt) => (
                <label key={opt} style={{ display: 'block', margin: '4px 0' }}>
                  <input
                    type="radio"
                    name={q.id}
                    value={opt}
                    checked={answers[q.id] === opt}
                    onChange={() => setAnswers(a => ({ ...a, [q.id]: opt }))}
                  /> {opt}
                </label>
              ))
            ) : (
              <textarea
                rows={3}
                style={{ width: '100%' }}
                value={answers[q.id] ?? ''}
                onChange={(e) => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
              />
            )}
          </fieldset>
        ))}

        {flowError ? <p style={{ color: 'crimson' }}>{flowError}</p> : null}
        <button type="submit" disabled={!allAnswered || busy}>
          {busy ? 'Minting…' : 'Mint badge'}
        </button>
      </form>
    </main>
  )
}
```

Note: use `Image` only if the app already permits remote `images.lu.ma` in `next.config`; otherwise replace both `<Image>` usages with a plain `<img>` to avoid a remote-host config change (check `web/next.config.*` — if `images.remotePatterns` is absent, use `<img>`).

- [ ] **Step 3: Verify the web app builds/type-checks**

Run: `cd web && npx tsc --noEmit`
Expected: PASS. If `<Image>` remote-host errors appear at build, switch to `<img>` per the note.

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/useCourseBadge.ts web/src/app/badge
git commit -m "feat(web): /badge/[classId] claim page (quiz -> mint)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Deploy + seed + docs (manual, gated on secrets)

**Files:**
- Modify: `contracts/DEPLOY.md` (document the course-badge deploy)
- Modify: `.env` / deploy env (add `COURSE_BADGE_CONTRACT_ADDRESS`, optional `COURSE_BADGE_DEPLOY_BLOCK`) — **not committed**

**This task requires the owner's Base mainnet minter key + funded gas and is run manually.** Do not attempt automatically.

- [ ] **Step 1: Deploy the contract to Base mainnet**

```bash
cd contracts
PRIVATE_KEY=<minter/owner key> \
BASE_URI=https://api.luminalog.com/v1/course-badge/ \
forge script script/DeployArgoCourseBadge.s.sol \
  --rpc-url <BASE_MAINNET_RPC> --broadcast --verify
```
Record the deployed address and deploy block from the broadcast output.

- [ ] **Step 2: Configure the server env**

Set on the API host (and local `.env`):
```
COURSE_BADGE_CONTRACT_ADDRESS=0x<deployed address>
COURSE_BADGE_DEPLOY_BLOCK=<block number>
```
Restart the API. Confirm `courseChainEnabled()` is true (e.g. a mint attempt no longer returns 503).

- [ ] **Step 3: Seed the first classes**

```bash
cd server
# edit src/scripts/example-course.json with the real Luma imageUrl + quiz, then:
npx tsx src/scripts/createCourseBadge.ts src/scripts/example-course.json
```
Note the printed `chainClassId` and QR URL.

- [ ] **Step 4: End-to-end smoke test**

Visit `https://myargoquest.com/badge/<classId>`, sign in, answer the quiz, click Mint, and confirm: the success state shows, `courseBadges/{classId}/participants/{uid}.badge.tokenId` is set, `GET /v1/course-badge/<tokenId>.json` returns the metadata with the Luma image, and the token appears on BaseScan as soulbound.

- [ ] **Step 5: Document + commit**

Add a "Argo Course Badge" section to `contracts/DEPLOY.md` (address, deploy block, baseURI). Commit:
```bash
git add contracts/DEPLOY.md
git commit -m "docs(contracts): record ArgoCourseBadge mainnet deployment

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage:**
- Contract (§5) → Task 1. Config/env (§9) → Task 2. Reuse wallet + new mint service (§7) → Task 3. Public metadata + privacy boundary (§7, §10) → Task 4. Authed submit/mint + completion gate + mounting (§7, §4 gate) → Task 5. Firestore rules + minor-privacy (§6, §10) → Task 6. Admin script + chainClassId (§7) → Task 7. Web proxy (§8) → Task 8. Web claim page: QR→auth→quiz→mint→success (§1, §8) → Task 9. Deploy + seed (§11) → Task 10. All spec sections mapped.
- Idempotency/anti-dupe (§10): on-chain `minted[classId][to]` (Task 1) + off-chain `badge.tokenId` short-circuit (Task 3). Covered.

**Placeholder scan:** No TBD/TODO. Every code step ships real code. The only conditional is the `<Image>` vs `<img>` note in Task 9, which gives an explicit decision rule.

**Type consistency:** `mintCourseBadge(uid, classId)` returns `{tokenId, txHash?, contract, chain}` in Task 3, consumed unchanged by Task 5's `/mint` and Task 9's `mint()`. `CourseBadgeFields`/`buildCourseBadgeMetadata` identical across Task 4 route + test. `validateSubmission(quiz, answers)` signature identical across Task 5 route + test. `courseBadges/{classId}` shape (name, course, module, date, time, location, imageUrl, chainClassId, active, quiz) consistent across Tasks 3, 4, 5, 7. `runExclusiveMint` defined in Task 3 (minterQueue) and imported by both mintService and courseBadgeService.

**Scope:** Single feature (course badges), one branch, backend+contract+web only; iOS explicitly deferred. Focused enough for one plan.
