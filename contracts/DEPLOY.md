# Deploy LuminaSoul Contract

This guide covers deploying the `LuminaSoul` contract to Base Sepolia (testnet) and Base mainnet.

**IMPORTANT:** This is a public repository. Do NOT commit production secrets here. All real values (private key, RPC URL, deployed contract address) live in the **private server `.env`** and **workspace-root `CLAUDE.md`** — never in this repo.

## Prerequisites

- Foundry installed and on PATH: `export PATH="$HOME/.foundry/bin:$PATH"`
- A funded deployer key (Base Sepolia for testing, then Base mainnet)
- `PRIVATE_KEY` and `BASE_URI` set in your shell environment (never committed)

## Environment Variables

Set these in your **local shell** before running the deploy script:

```bash
export PRIVATE_KEY=<your_deployer_private_key>           # hex string (no 0x prefix in env)
export BASE_URI=https://api.luminalog.com/v1/nft/        # metadata base URL
export BASE_SEPOLIA_RPC=<rpc_url_for_base_sepolia>       # e.g., https://sepolia.base.org
export BASE_MAINNET_RPC=<rpc_url_for_base_mainnet>       # e.g., https://mainnet.base.org
```

Real values are stored securely in the **private server `.env`** and **workspace-root `CLAUDE.md`** (not in this repo).

## Deploy to Base Sepolia (testnet first)

```bash
cd luminalog-oss/contracts

export PATH="$HOME/.foundry/bin:$PATH"
export PRIVATE_KEY=<your_key>
export BASE_URI=https://api.luminalog.com/v1/nft/

forge script script/DeployLuminaSoul.s.sol \
  --rpc-url "$BASE_SEPOLIA_RPC" \
  --broadcast
```

Expected output: contract address for `LuminaSoul`. Record this in the **private `.env`** as `SOULBOUND_CONTRACT_ADDRESS`.

## Deploy to Base Mainnet

Once the contract is verified and tested on Sepolia, deploy to mainnet:

```bash
cd luminalog-oss/contracts

export PATH="$HOME/.foundry/bin:$PATH"
export PRIVATE_KEY=<your_key>
export BASE_URI=https://api.luminalog.com/v1/nft/

forge script script/DeployLuminaSoul.s.sol \
  --rpc-url "$BASE_MAINNET_RPC" \
  --broadcast
```

## Post-Deploy

After successful deployment:

1. Record the deployed contract address in the **private server `.env`** as `SOULBOUND_CONTRACT_ADDRESS`.
2. Update the **workspace-root `CLAUDE.md`** with the contract address and deploy details.
3. Update `server/config.ts` to load `SOULBOUND_CONTRACT_ADDRESS` from env (`.optional()` until Phase 2b integration).

## Security Notes

- **Never commit secrets:** private keys, RPC URLs, or deployed addresses must never be in this repo.
- **Environment-only:** Use shell export or `.env` files locally; `.env` is gitignored.
- **Private storage:** Real values are stored in the server `.env` and workspace-root `CLAUDE.md`, not here.

---

# Deploy ArgoCourseBadge Contract

`ArgoCourseBadge` is a **separate** soulbound ERC-721 for course/class proof-of-participation
badges (one unique token per wallet per class). It reuses the **same deployer/owner/minter key**
as `LuminaSoul` (`BASE_MINTER_PRIVATE_KEY` on the server), so the existing server minter can mint
badges without new key management.

## Deploy

Deploy to Base Sepolia first, then mainnet. `BASE_URI` must be the **course-badge** metadata
endpoint (note the `/course-badge/` path — different from the Soul's `/nft/`):

```bash
cd luminalog-oss/contracts
export PATH="$HOME/.foundry/bin:$PATH"
export PRIVATE_KEY=<your_key>
export BASE_URI=https://api.luminalog.com/v1/course-badge/

# testnet
forge script script/DeployArgoCourseBadge.s.sol --rpc-url "$BASE_SEPOLIA_RPC" --broadcast
# mainnet (after testing)
forge script script/DeployArgoCourseBadge.s.sol --rpc-url "$BASE_MAINNET_RPC" --broadcast --verify
```

## Post-Deploy

1. Record the deployed address in the **private server `.env`** as `COURSE_BADGE_CONTRACT_ADDRESS`,
   and the deploy block as `COURSE_BADGE_DEPLOY_BLOCK` (from the broadcast output).
2. Restart the API. Verify `courseChainEnabled()` is now true (a `/v1/course/:id/mint` call no
   longer returns 503).
3. Author the first class sessions:
   `cd ../server && npx tsx src/scripts/createCourseBadge.ts src/scripts/example-course.json`
   (edit the JSON first with the real Luma `imageUrl` + quiz). Note the printed `chainClassId` and
   QR target `https://myargoquest.com/badge/{classId}`.
4. Smoke test: visit `/badge/{classId}`, sign in, complete the quiz, mint, and confirm
   `GET /v1/course-badge/{tokenId}.json` returns metadata with the Luma image and the token shows
   as soulbound on BaseScan.

## Recorded deployments

| Network | Address | Deploy block | baseURI |
|---|---|---|---|
| base-sepolia | _pending_ | _pending_ | `https://api.luminalog.com/v1/course-badge/` |
| base (mainnet) | _pending_ | _pending_ | `https://api.luminalog.com/v1/course-badge/` |
