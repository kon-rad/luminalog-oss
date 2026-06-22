import { openFieldSafe } from '../crypto/fieldCipher'

/** Decrypted onboarding profile fields (all optional). */
export interface ProfileFields {
  goals?: string
  hobbies?: string
  age?: string
  gender?: string
  challenges?: string
  dailyHabits?: string
  starSign?: string
  maritalStatus?: string
  location?: string
  education?: string
  work?: string
  favoriteMovies?: string
  favoriteArtists?: string
  favoriteBooks?: string
  languages?: string
  friendsDescribe?: string
}

/** Every encrypted `profileDetails.<key>` field — the wire format, in one place. */
export const PROFILE_FIELD_KEYS: Array<keyof ProfileFields> = [
  'goals', 'hobbies', 'age', 'gender', 'challenges', 'dailyHabits',
  'starSign', 'maritalStatus', 'location', 'education', 'work',
  'favoriteMovies', 'favoriteArtists', 'favoriteBooks', 'languages', 'friendsDescribe',
]

/**
 * Decrypts the `profileDetails` map from a user document with the given DEK.
 * Each field is optional context — legacy/plaintext or missing values fall back
 * to '' (via `openFieldSafe`) and must never abort the request.
 */
export function decodeProfileFields(dek: Buffer, userData: unknown): ProfileFields {
  const details = (userData as { profileDetails?: Record<string, unknown> } | undefined)?.profileDetails ?? {}
  const out: ProfileFields = {}
  for (const key of PROFILE_FIELD_KEYS) {
    out[key] = openFieldSafe(dek, details[key], `users.profileDetails.${key}`)
  }
  return out
}
