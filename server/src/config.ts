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
  RAG_TOP_K: z.coerce.number().int().positive().default(20),
  RELATED_TOP_K: z.coerce.number().int().positive().default(20),
  MASTER_KEY: z.string().refine(
    v => Buffer.from(v, 'base64').length === 32,
    'MASTER_KEY must be base64 of exactly 32 bytes',
  ),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('[config] Missing required env vars:')
  console.error(parsed.error.format())
  process.exit(1)
}

export const config = parsed.data
