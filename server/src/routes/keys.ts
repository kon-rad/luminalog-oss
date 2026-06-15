import { Router, Request, Response } from 'express'
import { firebaseAuth } from '../middleware/firebaseAuth'
import { getOrCreateDEK } from '../crypto/keyService'

export const keysRouter = Router()

keysRouter.post('/bootstrap', firebaseAuth, async (req: Request, res: Response) => {
  const uid = (req as any).uid as string
  try {
    const dek = await getOrCreateDEK(uid)
    res.json({ dek: dek.toString('base64') })
  } catch (err) {
    console.error('[keys/bootstrap]', err)
    res.status(500).json({ error: 'Key bootstrap failed' })
  }
})
