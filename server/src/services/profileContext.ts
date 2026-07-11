
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
// NOTE: the server no longer decrypts profileDetails (zero-knowledge — it holds no
// DEK). The client sends the decrypted profile as plaintext in AI request bodies; this
// module now only defines the `ProfileFields` shape + key list used to build prompts.
