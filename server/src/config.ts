import { z } from 'zod'

const schema = z.object({
  PORT: z.string().default('3200'),
  NODE_ENV: z.string().default('development'),
  FIREBASE_SERVICE_ACCOUNT_JSON: z.string(),
  CHROMA_URL: z.string().default('http://localhost:8000'),
  TOGETHER_AI_API_KEY: z.string(),
  TOGETHER_EMBEDDING_MODEL: z.string().default('intfloat/multilingual-e5-large-instruct'),
  TOGETHER_WHISPER_MODEL: z.string().default('openai/whisper-large-v3'),
  TOGETHER_CHAT_MODEL: z.string().default('meta-llama/Llama-3.3-70B-Instruct-Turbo'),
  // Server LLM provider switch. `together` preserves the legacy provider; `morpheus`
  // routes chat/summary/entry-AI/daily-report to the Morpheus decentralized TEE
  // marketplace (ADR-0085). No cross-provider fallback — a failed call is retried
  // against the SAME provider. All Morpheus vars are OPTIONAL/defaulted so flipping
  // the switch never crash-loops boot.
  AI_PROVIDER: z.enum(['together', 'morpheus']).default('morpheus'),
  MORPHEUS_API_KEY: z.string().optional(),
  MORPHEUS_BASE_URL: z.string().default('https://api.mor.org/api/v1'),
  // THE global chat model. Change this one var (env override or here) to swap the
  // model app-wide. Must be a lowercase-hyphen SLUG that Morpheus can currently
  // route to. `deepseek-v4-flash` = open-source, reliably available (HTTP 200),
  // cheap/fast (~2-5s), and returns clean answer text in `content` — verified good
  // for empathetic journaling summaries + the structured entry-AI JSON call.
  // NOTE: Claude/Llama/Gemma/GPT-OSS slugs currently 503 ("capacity reserved for
  // priority models") on our account, and display-name ids ("GLM 5.2") also 503 —
  // only certain slugs route. `deepseek-v4-pro` is a REASONING model that returns
  // empty `content` (all output in reasoning_content) → do NOT use it here.
  // Other available slugs (verified 200): gemini-3.1-pro-preview (not open source).
  MORPHEUS_CHAT_MODEL: z.string().default('deepseek-v4-flash'),
  // Ordered, comma-separated FALLBACK slugs tried (in order) after MORPHEUS_CHAT_MODEL
  // exhausts its per-request retries on a transient/503. Morpheus reserves capacity
  // for "priority models", so the primary slug can 503 while another routable slug
  // still serves — the fallback chain keeps entry-AI generation working during those
  // windows WITHOUT ever leaving the private Morpheus TEE (no cross-provider fallback;
  // journal content never routes to Together). Same slug rules as MORPHEUS_CHAT_MODEL:
  // routable lowercase-hyphen slugs only, and NEVER a reasoning model like
  // `deepseek-v4-pro` (empty `content`). Default `glm-5.2` (open-weights, verified 200).
  MORPHEUS_CHAT_MODEL_FALLBACKS: z.string().default('glm-5.2'),
  // ── LIVE VOICE call model routing (Vapi custom-LLM proxy) ONLY ──────────────
  // Voice is latency-critical and has a HARD deadline: Vapi tears the call down as
  // `custom-llm-llm-failed` if a turn is too slow. It therefore gets its own
  // provider switch, independent of the global `AI_PROVIDER` (ADR-0109).
  //
  // Why voice defaults to `together` while everything else stays on Morpheus:
  // Morpheus reserves capacity for "priority models" and now 503s 159 of its 163
  // models — including EVERY Gemini and Claude slug. The previous default
  // (`Gemini 3.5 Flash`) failed 8/8 live probes, so every voice turn fell through
  // to the "having a moment" fallback. Measured from the droplet (10 runs, real
  // voice turn, streaming TTFB):
  //   together meta-llama/Llama-3.3-70B-Instruct-Turbo → ~0.95s median, 2.06s max, 10/10
  //   morpheus glm-5.2                                 → ~1.6s median, 5.27s max
  //   morpheus deepseek-v4-flash                       → ~2.5s median, 10.1s max
  // Flip back with `VOICE_AI_PROVIDER=morpheus` the moment Morpheus can serve a
  // fast slug again — no code change needed.
  VOICE_AI_PROVIDER: z.enum(['together', 'morpheus']).default('together'),
  // Overrides the voice model for whichever provider VOICE_AI_PROVIDER selects.
  // Unset → that provider's built-in voice default (see aiClient.ts). This is the
  // knob to turn when a better Morpheus slug appears: set VOICE_AI_PROVIDER=morpheus
  // and VOICE_CHAT_MODEL=<slug>. Must be a routable SLUG on Morpheus (display-name
  // ids like "Gemini 3.5 Flash" 503 — see the MORPHEUS_CHAT_MODEL note above), and
  // NOT a reasoning model like `deepseek-v4-pro` (empty `content`).
  // Optional → no crash-loop deploy.
  VOICE_CHAT_MODEL: z.string().optional(),
  MORPHEUS_EMBEDDING_MODEL: z.string().default('text-embedding-bge-m3'),
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
  // Argo Course Badge NFT (Base) — separate contract from the Soul. Optional so
  // the server boots before deploy; make required only when the code needs them.
  COURSE_BADGE_CONTRACT_ADDRESS: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, 'COURSE_BADGE_CONTRACT_ADDRESS must be 0x + 40 hex')
    .optional(),
  COURSE_BADGE_DEPLOY_BLOCK: z.coerce.number().int().nonnegative().optional(),
  COURSE_BADGE_METADATA_BASE_URL: z.string().optional(),
  // Zero-knowledge consent enforcement (encryption Step 1 / 1b). When enabled,
  // the `requireAiConsent` guard returns 403 for users who have not recorded
  // AI-data-sharing consent. OPTIONAL + default OFF so existing users are NOT
  // broken — it only flips ON after the consent UI (1e) ships. Never make this
  // required (a newly-required env var crash-loops the server at boot).
  ENFORCE_AI_CONSENT: z.string().optional(),
  // Deepgram powers voice/video JOURNAL-ENTRY transcription (higher accuracy than
  // Whisper on real recordings with pauses). OPTIONAL: when the key is absent the
  // clip endpoint falls back to Together Whisper, so adding this never breaks a
  // deploy. Text-field dictation stays on-device (Apple Speech) — unaffected.
  DEEPGRAM_API_KEY: z.string().optional(),
  DEEPGRAM_MODEL: z.string().default('nova-3'),
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

/**
 * True when a Deepgram API key is configured. When false, journal-entry clip
 * transcription falls back to Together Whisper (previous behavior).
 */
export function deepgramEnabled(): boolean {
  return Boolean(config.DEEPGRAM_API_KEY)
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

/**
 * True when the shared chain path is configured AND the course-badge contract
 * address is set. Course-badge minting no-ops/throws clearly when false.
 */
export function courseChainEnabled(): boolean {
  return chainEnabled() && Boolean(config.COURSE_BADGE_CONTRACT_ADDRESS)
}
