import admin from 'firebase-admin'
import { encryptField } from '../crypto/fieldCipher'
import type { RagSource } from './journalRetriever'

export interface VoiceTurn {
  chatId: string
  turnIndex: number
  userText: string
  assistantText: string
  sources: RagSource[]
}

/** Write one voice turn (user + assistant messages) live. Idempotent: deterministic
 *  doc ids keyed by turn index + merge, so Vapi retries overwrite identically. */
export async function persistVoiceTurn(db: any, dek: Buffer, turn: VoiceTurn): Promise<void> {
  const messages = db.collection('chats').doc(turn.chatId).collection('messages')
  const now = admin.firestore.FieldValue.serverTimestamp()

  if (turn.userText) {
    await messages.doc(`live_${turn.turnIndex}_user`).set({
      role: 'user',
      text: encryptField(dek, turn.userText, 'messages.text'),
      turnIndex: turn.turnIndex,
      source: 'voice-live',
      createdAt: now,
    }, { merge: true })
  }

  if (turn.assistantText) {
    await messages.doc(`live_${turn.turnIndex}_assistant`).set({
      role: 'assistant',
      text: encryptField(dek, turn.assistantText, 'messages.text'),
      turnIndex: turn.turnIndex,
      source: 'voice-live',
      sources: turn.sources.map((s, i) => ({
        journalId: s.journalId,
        type: s.type,
        date: s.date,
        score: s.score,
        title: encryptField(dek, s.title, `messages.sources.${i}.title`),
        snippet: encryptField(dek, s.snippet, `messages.sources.${i}.snippet`),
      })),
      createdAt: now,
    }, { merge: true })
  }

  await db.collection('chats').doc(turn.chatId).update({ voiceStatus: 'active', lastMessageAt: now })
}
