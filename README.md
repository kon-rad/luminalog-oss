# LuminaLog (Open Source)

LuminaLog is an AI-assisted journaling app with end-to-end-ish, per-user encryption
of all journal content at rest. This monorepo holds the full stack.

## Layout

| Path        | What it is |
|-------------|------------|
| `ios/`      | SwiftUI iOS app (XcodeGen project; Firebase Auth/Firestore, RevenueCat, Vapi). |
| `server/`   | Node + TypeScript proxy API (AI, RAG/Chroma, S3 media, transcription, per-user key service). |
| `landing/`  | Marketing landing page (static `index.html`). |
| `design/`   | Brand strategy, design specs, and HTML/JSX UI mockups. |

## Encryption

User content (journal entries, transcriptions, AI output, chat messages, biography, media
bytes) is encrypted at rest with a per-user AES-256-GCM data key. See
`ios/docs/superpowers/specs/2026-06-15-per-user-data-encryption-design.md` for the design.
The trust model is "server can decrypt to run AI" (envelope encryption), **not** zero-knowledge.

## Getting started

### Server (`server/`)
```bash
cd server
cp .env.example .env        # then fill in your own credentials
npm install
npm run build && npm start
```
Required secrets (see `.env.example`): Firebase service account, Together AI key,
AWS S3 credentials, Vapi keys, and the encryption master key.

### iOS (`ios/`)
```bash
cd ios
brew install xcodegen
xcodegen generate
open LuminaLog.xcodeproj
```
Add your own `GoogleService-Info.plist` (the app runs in demo mode without it).

## Security / secrets

**No credentials are committed.** All secret files are excluded via the root `.gitignore`
(`.env`, `GoogleService-Info.plist`, `service-account-secret.json`, `*.p8`, etc.).
Copy your own credentials in locally — they will not be tracked. Before pushing, run
`git status` and confirm no secret files are staged.

## License

TODO: choose an open-source license (e.g. MIT or Apache-2.0) before publishing.
