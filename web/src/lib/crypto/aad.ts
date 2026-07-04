// AAD context strings — the single source of truth for field-encryption
// domain separation. Each string is the UTF-8 additional-authenticated-data
// bound into AES-256-GCM, so it MUST match the iOS app and Express server
// byte-for-byte or decryption fails. Do not edit these values casually — a
// drift silently breaks cross-device interop.
//
// Authoritative list: web-app design §4 / architecture §4.

// The 16 encrypted keys under `users.profileDetails.<key>`. Ordering here is
// documentation only; the string is keyed by name, not index.
export const PROFILE_DETAIL_KEYS = [
  'goals',
  'hobbies',
  'age',
  'gender',
  'challenges',
  'dailyHabits',
  'starSign',
  'maritalStatus',
  'location',
  'education',
  'work',
  'favoriteMovies',
  'favoriteArtists',
  'favoriteBooks',
  'languages',
  'friendsDescribe',
] as const

export type ProfileDetailKey = (typeof PROFILE_DETAIL_KEYS)[number]

export const AAD = {
  // journals/{id}
  journalsTitle: 'journals.title',
  journalsContent: 'journals.content',
  journalsSummaryText: 'journals.summary.text',
  journalsInsightsText: 'journals.insights.text',
  // `<index>` is the array position — ordering is load-bearing.
  journalsPromptItem: (index: number) => `journals.prompts.items.${index}`,

  // users/{uid}
  usersBiography: 'users.biography',
  usersProfileDetail: (key: string) => `users.profileDetails.${key}`,
  usersDailyPromptText: 'users.dailyPrompt.text',
  usersDailyPromptPromptsText: 'users.dailyPrompt.prompts.text',

  // chats/{id}
  chatsTitle: 'chats.title',
  chatsRawTranscript: 'chats.rawTranscript',

  // chats/{id}/messages/{id}
  messagesText: 'messages.text',
  messagesSourceSnippet: (index: number) => `messages.sources.${index}.snippet`,
  messagesSourceTitle: (index: number) => `messages.sources.${index}.title`,

  // dailyReports/{id}
  dailyReportsInsights: 'dailyReports.insights',
  dailyReportsFindings: 'dailyReports.findings',
  // stored under the legacy key `question` (= the model's `gem`)
  dailyReportsQuestion: 'dailyReports.question',
  dailyReportsEmotionSummary: 'dailyReports.emotionSummary',
} as const
