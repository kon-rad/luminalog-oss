import 'dotenv/config'
import express from 'express'
import { config } from './config'
import { healthRouter } from './routes/health'
import { ragRouter } from './routes/rag'
import { chatRouter } from './routes/chat'
import { aiRouter } from './routes/ai'
import { vapiRouter } from './routes/vapi'
import { mediaRouter } from './routes/media'
import { keysRouter } from './routes/keys'

const app = express()

app.use(express.json({ limit: '10mb' }))

app.use('/health', healthRouter)
app.use('/v1/rag', ragRouter)
app.use('/v1/ai/chat', chatRouter)
app.use('/v1/ai', aiRouter)
app.use('/v1/vapi', vapiRouter)
app.use('/v1/media', mediaRouter)
app.use('/v1/keys', keysRouter)

app.listen(Number(config.PORT), () => {
  console.log(`[luminalog-api] running on port ${config.PORT} (${config.NODE_ENV})`)
})
