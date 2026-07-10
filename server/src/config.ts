import { z } from 'zod'

const schema = z.object({
  PORT: z.string().default('3200'),
  NODE_ENV: z.string().default('development'),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string(),
  CHROMA_URL: z.string().default('http://localhost:8000'),
  TOGETHER_AI_API_KEY: z.string(),
  TOGETHER_EMBEDDING_MODEL: z.string().default('intfloat/multilingual-e5-large-instruct'),
  TOGETHER_WHISPER_MODEL: z.string().default('openai/whisper-large-v3'),
  AWS_ACCESS_KEY_ID: z.string(),
  AWS_SECRET_ACCESS_KEY: z.string(),
  AWS_S3_BUCKET: z.string(),
  AWS_REGION: z.string().default('us-east-1'),
  VAPI_PUBLIC_KEY: z.string(),
  VAPI_ASSISTANT_ID: z.string(),
  VAPI_WEBHOOK_SECRET: z.string(),
  REVENUECAT_WEBHOOK_SECRET: z.string(),
  // RAG tuning knobs
  RAG_CHUNK_SIZE: z.coerce.number().int().positive().default(1000),
  RAG_CHUNK_OVERLAP: z.coerce.number().int().min(0).default(200),
  RAG_TOP_K: z.coerce.number().int().positive().default(6),
  RELATED_TOP_K: z.coerce.number().int().positive().default(20),
  // Graph (constellation) tuning knobs — all defaulted, safe to deploy without .env changes
  GRAPH_TOP_K: z.coerce.number().int().positive().default(4),
  GRAPH_MIN_SIMILARITY: z.coerce.number().min(-1).max(1).default(0.75),
  GRAPH_MAX_DEGREE: z.coerce.number().int().positive().default(12),
  HUME_API_KEY: z.string().optional(),
  UNSPLASH_ACCESS_KEY: z.string().optional(),
  // Soul Constellation NFT (Base) — all optional so the server boots before the
  // mint path is built/deployed. Make required only once the code actually needs them.
  CDP_API_KEY_ID: z.string().optional(),
  CDP_API_KEY_SECRET: z.string().optional(),
  CDP_WALLET_SECRET: z.string().optional(),
  BASE_RPC_URL: z.string().optional(),
  // Which Base network to mint on. Defaults to testnet so existing deploys are
  // unaffected; set BASE_CHAIN=base for mainnet (with mainnet contract/RPC/minter).
  BASE_CHAIN: z.enum(['base', 'base-sepolia']).default('base-sepolia'),
  BASE_MINTER_PRIVATE_KEY: z
    .string()
    .optional()
    .refine(
      v => v === undefined || /^0x[0-9a-fA-F]{64}$/.test(v),
      'BASE_MINTER_PRIVATE_KEY must be 0x + 64 hex',
    ),
  SOULBOUND_CONTRACT_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, 'SOULBOUND_CONTRACT_ADDRESS must be 0x + 40 hex')
    .optional(),
  // Block the soulbound contract was deployed at — bounds orphan-recovery getLogs
  // so we never scan from block 0 (public Base Sepolia RPC caps the range).
  SOULBOUND_DEPLOY_BLOCK: z.coerce.number().int().nonnegative().optional(),
  NFT_METADATA_BASE_URL: z.string().optional(),
  // Zero-knowledge consent enforcement (encryption Step 1 / 1b). When enabled,
  // the `requireAiConsent` guard returns 403 for users who have not recorded
  // AI-data-sharing consent. OPTIONAL + default OFF so existing users are NOT
  // broken — it only flips ON after the consent UI (1e) ships. Never make this
  // required (a newly-required env var crash-loops the server at boot).
  ENFORCE_AI_CONSENT: z.string().optional(),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('[config] Missing required env vars:')
  console.error(parsed.error.format())
  process.exit(1)
}

export const config = parsed.data

/**
 * True only when every env var the on-chain mint path needs is present. When
 * false, the chain services (wallet/mint/soul) degrade to a no-op instead of
 * throwing, keeping the shared server clean where chain isn't configured.
 */
/**
 * True when zero-knowledge AI-consent enforcement is enabled (ENFORCE_AI_CONSENT
 * set to a truthy string: `1`/`true`/`yes`/`on`). When false — the production
 * default — `requireAiConsent` is a no-op pass-through, so existing users are
 * never blocked. Flips ON only after the consent UI (1e) ships.
 */
export function enforceAiConsentEnabled(): boolean {
  const v = (config.ENFORCE_AI_CONSENT ?? '').trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes' || v === 'on'
}

export function chainEnabled(): boolean {
  return Boolean(
    config.CDP_API_KEY_ID &&
      config.CDP_API_KEY_SECRET &&
      config.CDP_WALLET_SECRET &&
      config.BASE_RPC_URL &&
      config.BASE_MINTER_PRIVATE_KEY &&
      config.SOULBOUND_CONTRACT_ADDRESS,
  )
}
