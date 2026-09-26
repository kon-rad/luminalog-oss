import { Router, Request, Response } from 'express'
import { firebaseAuth } from '../middleware/firebaseAuth'
import { firestoreUsernameStore, normalizeUsername, validateUsername, type UsernameStore } from '../services/username'
import { isoSeconds } from '../services/infoRequests/time'

export function createProfileHandlers(deps: { usernames: UsernameStore; now: () => Date }) {
  return {
    async check(req: Request, res: Response): Promise<void> {
      try {
        const uid = (req as any).uid as string
        const username = normalizeUsername(String(req.query.u ?? ''))
        const invalid = validateUsername(username)
        if (invalid) { res.json({ username, available: false, reason: invalid }); return }
        const owner = await deps.usernames.ownerOf(username)
        if (owner && owner !== uid) { res.json({ username, available: false, reason: 'taken' }); return }
        res.json({ username, available: true })
      } catch (err) {
        console.error('[profile/username/check]', err)
        res.status(500).json({ error: 'check_failed' })
      }
    },

    async set(req: Request, res: Response): Promise<void> {
      try {
        const uid = (req as any).uid as string
        const raw = (req.body as { username?: unknown })?.username
        if (typeof raw !== 'string') { res.status(400).json({ error: 'invalid' }); return }
        const result = await deps.usernames.claim(uid, normalizeUsername(raw), deps.now())
        if (!result.ok) {
          res.status(result.status).json({
            error: result.error,
            ...(result.nextChangeAt ? { nextChangeAt: isoSeconds(result.nextChangeAt) } : {}),
          })
          return
        }
        res.json({
          username: result.username,
          usernameChangedAt: isoSeconds(result.usernameChangedAt),
          nextChangeAt: isoSeconds(result.nextChangeAt),
        })
      } catch (err) {
        console.error('[profile/username]', err)
        res.status(500).json({ error: 'set_failed' })
      }
    },
  }
}

const handlers = createProfileHandlers({ usernames: firestoreUsernameStore, now: () => new Date() })

export const profileRouter = Router()
profileRouter.get('/username/check', firebaseAuth, handlers.check)
profileRouter.put('/username', firebaseAuth, handlers.set)