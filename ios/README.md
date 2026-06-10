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

## Project layout

```
LuminaLog/
├── App/        # App entry point, AppConfig, root view
├── Core/       # Auth, Networking, Persistence, Media, Speech, OCR, Subscriptions, Voice
├── Features/   # Home, JournalList, JournalDetail, CreateEntry, Chats, Profile
├── Shared/     # Design system (Theme.swift) and shared components
└── Resources/  # Info.plist, assets
```
