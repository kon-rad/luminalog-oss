import 'dotenv/config'
import express, { NextFunction, Request, Response } from 'express'
import { config } from './config'
import { healthRouter } from './routes/health'
import { chatRouter } from './routes/chat'
import { aiRouter } from './routes/ai'
import { vapiRouter } from './routes/vapi'
import { revenueCatRouter } from './routes/revenuecat'
import { mediaRouter } from './routes/media'
import { keysRouter } from './routes/keys'
import { leaderboardRouter } from './routes/leaderboard'
import { soulRouter } from './routes/soul'
import { nftRouter } from './routes/nft'
import { vectorsRouter } from './routes/vectors'
import { consentRouter } from './routes/consent'

const app = express()

app.use(express.json({ limit: '10mb' }))

app.use('/health', healthRouter)
app.use('/v1/ai/chat', chatRouter)
app.use('/v1/ai', aiRouter)
app.use('/v1/vapi', vapiRouter)
app.use('/v1/revenuecat', revenueCatRouter)
app.use('/v1/media', mediaRouter)
app.use('/v1/keys', keysRouter)
app.use('/v1/leaderboards', leaderboardRouter)
app.use('/v1/soul', soulRouter)
app.use('/v1/vectors', vectorsRouter) // encrypted per-user vector blob store (client-side semantic RAG)
app.use('/v1/nft', nftRouter) // public (no auth) — ERC-721 metadata for tokenURI
app.use('/v1/consent', consentRouter) // ZK AI-data-sharing consent record (1b)

// Backstop error middleware — catches anything routes forward via next(err).
// (Express 4 does not auto-forward async-handler rejections; that's handled
// per-route, but this covers sync throws and explicit next(err) calls.)
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[express]', err)
  if (!res.headersSent) res.status(500).json({ error: 'Internal error' })
})

// Last-resort guards so one bad request can never take the whole process down
// and trigger the PM2 restart/EADDRINUSE loop. Log loudly; keep serving.
process.on('unhandledRejection', reason => {
  console.error('[unhandledRejection]', reason)
})
process.on('uncaughtException', err => {
  console.error('[uncaughtException]', err)
})

app.listen(Number(config.PORT), () => {
  console.log(`[luminalog-api] running on port ${config.PORT} (${config.NODE_ENV})`)
})
