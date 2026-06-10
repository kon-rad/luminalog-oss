# LuminaLog (iOS)

AI-powered journaling app. Native SwiftUI, iOS 17+.

## Requirements

- Xcode 16+ (built with Xcode 26.5)
- [XcodeGen](https://github.com/yonaskolb/XcodeGen) (`brew install xcodegen`)

## Generate the project

The `.xcodeproj` is generated from `project.yml` and is **not** committed.

```sh
cd ios-luminalog
xcodegen generate
open LuminaLog.xcodeproj
```

## Build from the command line

```sh
xcodebuild -project LuminaLog.xcodeproj \
  -scheme LuminaLog \
  -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
  build
```

The first build resolves the Firebase/RevenueCat/GoogleSignIn Swift packages and
can take several minutes.

## Firebase config & demo mode

The real `GoogleService-Info.plist` is **never committed** (it is gitignored).

- **With Firebase:** drop your `GoogleService-Info.plist` into
  `LuminaLog/Resources/` and re-run `xcodegen generate`. The app detects it at
  launch and calls `FirebaseApp.configure()`.
- **Without Firebase (demo mode):** the app builds and runs normally, shows a
  "Demo Mode" badge, and all services use local mocks. No network or Firebase
  setup is required to develop UI.

The switch lives in `LuminaLog/App/AppConfig.swift`
(`AppConfig.isFirebaseConfigured`).

### Screenshots/dev: skip sign-in with `-demo-signed-in`

In demo mode the app normally starts on the sign-in screen. For screenshot
automation (or just faster dev loops), launch with the `-demo-signed-in`
argument and the mock auth starts already signed in, landing directly on Home:

```sh
xcrun simctl launch booted com.luminalog.app -demo-signed-in
```

In Xcode, add `-demo-signed-in` under *Scheme → Run → Arguments Passed On
Launch*. The hook lives in `AppServices.mocks()` and only affects mock wiring —
it does nothing when Firebase is configured.

### Firestore composite index

The journals query (`userId ==` + `order by createdAt desc` on the `journals`
collection) requires a Firestore **composite index**. Without it the snapshot
listener fails (the error is logged under the `firestore` OSLog category) and
the journal list stays empty. Create it in the Firebase console — Firestore
logs a direct creation link on first failure — or add it to
`firestore.indexes.json`:

| Collection | Fields                          |
|------------|---------------------------------|
| `journals` | `userId` ASC, `createdAt` DESC  |

## Authentication

With Firebase configured, the sign-in screen offers **Sign in with Apple** and
**Google Sign-In**. Without it (demo mode) both providers are hidden and an
"Explore in Demo Mode" button signs in with the local mocks.

### Enabling Google Sign-In

Google Sign-In needs the **reversed client id** from your
`GoogleService-Info.plist` registered as a URL scheme so the OAuth redirect
returns to the app. The id is per-project and the plist is not committed, so it
is not hardcoded — wire it up manually:

1. Open your `GoogleService-Info.plist` and copy the `REVERSED_CLIENT_ID` value
   (looks like `com.googleusercontent.apps.1234567890-abc...`).
2. In `project.yml`, set the `GOOGLE_REVERSED_CLIENT_ID` build setting on the
   `LuminaLog` target to that value (it defaults to empty, which leaves the URL
   scheme inert).
3. Re-run `xcodegen generate`.

The `CFBundleURLTypes` entry in `project.yml` references
`$(GOOGLE_REVERSED_CLIENT_ID)`, and `LuminaLogApp` forwards opened URLs to
`GIDSignIn.sharedInstance.handle(_:)`. The OAuth client id itself is read at
runtime from `FirebaseApp.app()?.options.clientID` — no extra config needed.

### Sign in with Apple

The target carries the `com.apple.developer.applesignin` entitlement
(`LuminaLog/Resources/LuminaLog.entitlements`, generated from `project.yml`).
Building for a **device** requires a paid Apple Developer team with the
"Sign in with Apple" capability enabled for the bundle id. Simulator builds
with `CODE_SIGNING_ALLOWED=NO` are unaffected.

## Project layout

```
LuminaLog/
├── App/        # App entry point, AppConfig, root view
├── Core/       # Auth, Networking, Persistence, Media, Speech, OCR, Subscriptions, Voice
├── Features/   # Home, JournalList, JournalDetail, CreateEntry, Chats, Profile
├── Shared/     # Design system (Theme.swift) and shared components
└── Resources/  # Info.plist, assets
```
