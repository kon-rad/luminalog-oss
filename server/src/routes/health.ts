import { Router } from 'express'
import { getJournalsCollection } from '../db/chroma'

export const healthRouter = Router()

healthRouter.get('/', async (_req, res) => {
  try {
    await getJournalsCollection()
    res.json({ status: 'ok', chroma: 'connected' })
  } catch (err) {
    res.status(503).json({ status: 'degraded', chroma: 'unreachable', error: String(err) })
  }
})
