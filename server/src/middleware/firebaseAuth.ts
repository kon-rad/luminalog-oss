import { Request, Response, NextFunction } from 'express'
import admin from 'firebase-admin'
import { config } from '../config'

const serviceAccount = JSON.parse(config.FIREBASE_SERVICE_ACCOUNT_JSON)

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
  })
}

export const db = admin.firestore()

export async function firebaseAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization header' })
    return
  }
  const token = authHeader.slice(7)
  try {
    const decoded = await admin.auth().verifyIdToken(token)
    ;(req as any).uid = decoded.uid
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
