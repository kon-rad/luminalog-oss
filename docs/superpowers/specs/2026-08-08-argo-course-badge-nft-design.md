# Argo Course Badge NFT — Design

**Date:** 2026-08-08
**Status:** Approved (design), pending implementation
**Scope:** Smart contract + backend (`server/`) + web app (`web/`). iOS is **deferred** to a separate spec.

## 1. Summary

Give participants in the **AI Power Users** course and the **Kids Wholistic Creativity & STEM**
class a **soulbound proof-of-participation NFT** ("Course Badge") on **Base mainnet**.

Flow: a participant **scans a QR code** at a class → lands on `myargoquest.com/badge/{classId}` →
signs in (which auto-provisions their Coinbase wallet — already built) → answers the class **quiz +
short-answer questions** → clicks **Mint badge** → the server saves their answers and mints a
**soulbound ERC-721** to their wallet. The badge's image is the **Luma event image**; its metadata
carries the **class name, date, time, location, and module**.

## 2. What already exists (reused, not rebuilt)

The Argo monorepo already ships an NFT stack this feature builds directly on:

- **Coinbase wallets, per user, cross-platform.** `server/src/services/chain/walletService.ts`
  `ensureUserWallet(uid)` get-or-creates a **Coinbase CDP Server Wallet** keyed on the Firebase
  uid and stores it at `users/{uid}.wallet = { provider:'cdp', address, accountName }`. Because it
  is keyed on the Firebase uid, **the same wallet is used by both web and iOS** — no per-platform
  wallet work is needed. This satisfies "users get a Coinbase wallet on web and mobile."
- **A working minter.** `server/src/services/chain/mintService.ts` uses `viem` +
  `BASE_MINTER_PRIVATE_KEY` to call an `onlyOwner mint(...)` on a Base contract and records the
  result on the user doc.
- **A shipped soulbound NFT to copy from.** `contracts/src/LuminaSoul.sol` — ERC-721 + **ERC-5192
  soulbound** (`_update` lock, `locked()`), `Ownable2Step`, blocked `renounceOwnership`, and
  **dynamic off-chain metadata** (`tokenURI = baseURI + tokenId + ".json"`). Its metadata is served
  publicly (no auth) from `server/src/routes/nft.ts` at `/v1/nft/:id.json`, with a deliberate
  **privacy boundary**: the public endpoint exposes only publish-safe aggregate facts, never raw
  user content.

The **genuinely new** work: a second contract, a quiz/short-answer flow that saves answers and
gates the mint, a QR entry point (web page), a class-definition source of truth in Firestore, and a
second public metadata endpoint.

## 3. Existing course content (do not disturb)

`web/src/app/courses/*` already hosts **static learning content**:
`/courses/ai-power-users` (5 modules) and `/courses/kids-stem`. These are the curriculum pages and
are **out of scope** — this feature adds a **separate claim route** and does not modify them. A
`courseBadges/{classId}` doc MAY reference the relevant content page for a "review the material"
link, but the badge flow is independent.

## 4. Design decisions (locked)

| Decision | Choice |
|---|---|
| Token model | **ERC-721, one unique token per participation** (per-token metadata JSON; can embed participant name) |
| Transferability | **Soulbound / non-transferable** (ERC-5192, reusing `LuminaSoul`'s lock) |
| Mint gate | **Completion only** — answering all questions unlocks Mint; no fail state. All answers saved regardless |
| Class source of truth | **Firestore `courseBadges/{classId}`** collection + an admin script |
| Build scope | **Contract + backend + web** now; iOS later (separate spec) |
| NFT `name` | The **class/session name** (e.g. `Argo Course Badge — AI Power Users · Module 1`) |
| Participant name | Woven into the metadata `description` and a `Participant` attribute (mirrors how the Soul badge personalizes), **not** the on-chain `name` |
| Quiz answers | **Private** — never in public metadata; readable only by the owner and admin |

## 5. Smart contract — `contracts/src/ArgoCourseBadge.sol`

New Foundry contract alongside `LuminaSoul.sol`, reusing its structure.

- **ERC-721 + ERC-5192 soulbound.** Copy the `_update` lock (allow mint from `address(0)`, block all
  transfers), `locked()`, ERC-4906 metadata-update event, `Ownable2Step`, blocked
  `renounceOwnership`, and `setBaseURI`.
- **Mint signature:** `mint(address to, uint256 classId) external onlyOwner returns (uint256 tokenId)`.
  - `mapping(uint256 classId => mapping(address holder => bool)) public minted` enforces **one badge
    per (wallet, class)** on-chain (anti-duplicate / idempotency backstop).
  - `require(!minted[classId][to], "BADGE: already minted")`; set it true; `tokenId = _nextId++`;
    `_mint(to, tokenId)`; `emit Locked(tokenId)`; `emit BadgeMinted(to, classId, tokenId)`.
  - Store `mapping(uint256 tokenId => uint256 classId) public classOf` for on-chain traceability.
- **Metadata:** `tokenURI = _base + tokenId.toString() + ".json"`. `_base` is the public metadata
  endpoint prefix (see §7). Owner can `setBaseURI` and `refreshMetadata(tokenId)` (ERC-4906).
- **Deployment:** Base mainnet, **owned by the same server minter** already used for Soul
  (`BASE_MINTER_PRIVATE_KEY`). New Foundry script `contracts/script/DeployArgoCourseBadge.s.sol`
  mirroring the Soul deploy script; document in `contracts/DEPLOY.md`.
- **Tests:** `contracts/test/ArgoCourseBadge.t.sol` — mint, one-per-(wallet,class) revert,
  non-transferability revert, `locked()`, `tokenURI` format, `onlyOwner`, `classOf`.

`classId` is a `uint256`. The Firestore doc uses a human slug (e.g. `ai-power-users-m1-2026-08-08`)
plus a stable numeric `chainClassId` field used on-chain. The admin script assigns `chainClassId`.

## 6. Data model (Firestore)

```
courseBadges/{classId} = {
  name,                 // "AI Power Users · Module 1"
  module,               // "Module 1" | "What is AI?" | null
  course,               // "ai-power-users" | "kids-stem"
  date, time, location, // class session facts (strings, as displayed)
  imageUrl,             // Luma event image (public URL)
  lumaEventId,          // optional
  chainClassId,         // uint256 used in the contract mint(to, classId)
  contentUrl,           // optional link to /courses/... material
  active: boolean,      // false = claim closed
  quiz: [ { id, type: 'mc' | 'short', prompt, options?: string[] } ]
}

courseBadges/{classId}/participants/{uid} = {
  displayName,          // captured at submit (first name), for metadata personalization
  answers: { [questionId]: string | number },
  submittedAt,          // server timestamp
  badge: { tokenId, chain, txHash, status: 'minting'|'minted'|'failed' } | null
}

courseBadgeTokens/{tokenId} = { classId, uid }   // reverse index for the public metadata endpoint
```

**Rules (`firestore.rules`):**
- `courseBadges/{classId}` — **world-readable** (the claim page renders it), **write: admin only**.
  Safe to publish: quiz has **no answer keys** (completion-only), so nothing sensitive leaks.
- `courseBadges/{classId}/participants/{uid}` — read/write **only** by `request.auth.uid == uid`
  (owner), plus admin. Client writes go through the authed server routes; direct client writes are
  not required and may be disallowed to keep answers server-validated.
- `courseBadgeTokens/*` — **no client access**; server-only (Admin SDK bypasses rules).

## 7. Backend (`server/`)

**Reused unchanged:** `walletService.ensureUserWallet(uid)`.

**New chain service** `server/src/services/chain/courseBadgeService.ts`:
- `mintCourseBadge(uid, classId): Promise<{ tokenId, txHash, chain }>` — mirrors `mintService`:
  1. `chainEnabled()` + `courseChainEnabled()` guard (see §9); no-op/throw clearly if disabled.
  2. `ensureUserWallet(uid)` → `to` address.
  3. Read `courseBadges/{classId}` for `chainClassId`; require the participant has a submission and
     no existing `badge.tokenId`.
  4. Write `participants/{uid}.badge = { status:'minting' }` (claim), send `mint(to, chainClassId)`
     via viem, parse `BadgeMinted` for `tokenId`, write `badge = { tokenId, txHash, chain,
     status:'minted' }` and `courseBadgeTokens/{tokenId} = { classId, uid }`.
  5. On failure set `badge.status='failed'` (releasable, like the Soul "wedged" recovery).
  - **Idempotent:** if `badge.tokenId` already set, return it without re-minting; the on-chain
    `minted[classId][to]` mapping is the final backstop.

**New public metadata route** `server/src/routes/courseBadge.ts` (mounted **no-auth** at
`/v1/course-badge`, mirroring `nftRouter`):
- `GET /v1/course-badge/:file` matching `^(\d+)\.json$` → `buildCourseBadgeMetadata(tokenId)`:
  - Look up `courseBadgeTokens/{tokenId}` → `{classId, uid}` → read `courseBadges/{classId}` +
    `participants/{uid}.displayName`.
  - Return ERC-721 metadata:
    ```json
    {
      "name": "Argo Course Badge — <course/module name>",
      "description": "<FirstName> completed <class name> on <date> at <location>.",
      "image": "<courseBadges.imageUrl (Luma)>",
      "attributes": [
        { "trait_type": "Course", "value": "<course>" },
        { "trait_type": "Module", "value": "<module>" },
        { "trait_type": "Date", "value": "<date>" },
        { "trait_type": "Time", "value": "<time>" },
        { "trait_type": "Location", "value": "<location>" },
        { "trait_type": "Participant", "value": "<FirstName>" }
      ]
    }
    ```
  - **Never** include quiz answers. `Cache-Control: public, max-age=300`. 404 if token unknown.

**New authed routes** `server/src/routes/course.ts` (mounted **with `firebaseAuth`** at `/v1/course`):
- `GET /v1/course/:classId` → the `courseBadges/{classId}` public fields + the caller's own
  participation (`answers`, `badge`) so the page can resume/greying-out state.
- `POST /v1/course/:classId/submit` `{ answers }` → validate every quiz question is answered
  (completion gate), write `participants/{uid}` with `displayName` (from the user doc / auth) and
  `submittedAt`. Idempotent (re-submit overwrites while unminted).
- `POST /v1/course/:classId/mint` → require a submission exists, call `mintCourseBadge(uid, classId)`,
  return `{ tokenId, txHash, chain, contractAddress }`.

**Mounting** in `server/src/index.ts`: add `courseRouter` (authed) and `courseBadgeRouter` (public),
following the existing `soulRouter` / `nftRouter` pattern.

**Admin script** `server/src/scripts/createCourseBadge.ts` (mirrors `checkAndMintSoul.ts`): reads a
JSON file describing a class session (facts + Luma `imageUrl` + quiz), assigns the next
`chainClassId`, and writes `courseBadges/{classId}`. Print the QR target URL
(`https://myargoquest.com/badge/{classId}`).

## 8. Web app (`web/`)

New route `web/src/app/badge/[classId]/page.tsx` (client component; **not** under `/courses/*`):
1. **Load** the class via `GET /v1/course/:classId`. Render a hero with the **Luma image** + class
   facts (name, module, date, time, location).
2. **Auth gate.** If signed out, prompt sign-in/up using the existing Firebase Auth flow; on return,
   the wallet is auto-provisioned server-side on first mint. (No wallet UI needed.)
3. **Quiz form.** Render MC (radio) + short-answer (textarea) questions from `quiz`. **Mint badge**
   button is disabled until every question has a value.
4. **Submit + mint.** On click: `POST .../submit` then `POST .../mint`. Show a minting spinner, then
   a **success state** styled after the existing `SoulCard`/`SoulModal` components, showing the badge
   image and a link to view the token (e.g. BaseScan / the metadata). If already minted, show the
   success state directly.
5. **Errors.** Network/mint failures show a retry; a closed class (`active:false`) shows a closed
   state.

Reuse existing web conventions: the Firebase client, the `SoulCard`/`SoulModal` visual language, and
the course brand styling. No changes to `/courses/*` content pages.

## 9. Config / env (`server/src/config.ts`)

Add (all `.optional()` so the server still boots before deploy — matching the Soul pattern):
- `COURSE_BADGE_CONTRACT_ADDRESS` — `0x` + 40 hex, optional.
- `COURSE_BADGE_DEPLOY_BLOCK` — optional, bounds any log scans.
- `COURSE_BADGE_METADATA_BASE_URL` — optional override for the contract `baseURI` (defaults to
  `<api base>/v1/course-badge/`).

Add `courseChainEnabled()` = `chainEnabled() && Boolean(config.COURSE_BADGE_CONTRACT_ADDRESS)`. The
CDP creds, `BASE_RPC_URL`, `BASE_CHAIN`, and `BASE_MINTER_PRIVATE_KEY` are **shared** with Soul.

## 10. Privacy & safety

- **Public boundary:** the metadata endpoint exposes only class facts + participant first name +
  image. Quiz answers and short-answer text are **never** public — same discipline as `nft.ts`.
- **Minors (kids STEM):** short-answer text may come from children. It is stored in
  `participants/{uid}` readable only by the owner + admin, and is excluded from all public surfaces.
  No child's answers appear on-chain or in metadata. Only a first name appears in metadata (already
  the norm for the Soul badge).
- **Idempotency / anti-abuse:** one badge per (wallet, class) enforced on-chain and off-chain; mint
  requires an authenticated Firebase session and a saved submission.

## 11. Build sequence

1. **Contract** — `ArgoCourseBadge.sol` + tests + deploy script; deploy to Base mainnet; record
   address + block in `contracts/DEPLOY.md`.
2. **Backend** — config + `courseChainEnabled`; `courseBadgeService`; `course.ts` (authed) +
   `courseBadge.ts` (public) routes + mounting; `firestore.rules`; `createCourseBadge.ts` admin
   script; unit tests for metadata builder + submit validation (mirror `nft.test.ts`).
3. **Web** — `/badge/[classId]` claim page (load → auth → quiz → submit → mint → success).
4. **Seed** — author the first `courseBadges` docs for a live AI Power Users module and a Kids STEM
   session; generate the QR codes.
5. **(Later, separate spec)** — iOS claim flow reusing the same backend endpoints.

## 12. Out of scope

- iOS app changes (separate spec).
- Editing the existing `/courses/*` learning-content pages.
- Pass/fail scoring, retries, certificates, leaderboards.
- An admin **UI** (script-only for now).
- Gasless/relayer changes — reuses the existing server-minter model (the server pays gas).
