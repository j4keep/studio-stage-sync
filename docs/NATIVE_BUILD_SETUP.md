# YAJ native build setup — iOS and Android

**Status:** Initial Capacitor configuration added; native projects are **not generated** and app identifiers are **provisional**. Do not upload a store build until the publisher confirms the permanent bundle/package identifier.

## Prerequisites
- macOS with current supported Xcode for iOS, Android Studio with SDK for Android
- Node/npm supported by the project's Vite toolchain
- Apple Developer Program membership and Google Play Console access for distribution

## Install and generate locally (on MacBook)
```bash
npm install
npm install @capacitor/core @capacitor/ios @capacitor/android
npm install -D @capacitor/cli
npm run build
npx cap add ios
npx cap add android
npx cap sync
npx cap open ios
npx cap open android
```

**Commit the resulting package.json, package-lock.json, ios/ and android/ native projects after validating the builds.** The repo's current lockfile root metadata does not match the package.json name/version; npm install may update it. Review this change carefully rather than hand-editing resolved dependency integrity fields.

## Required platform testing
- Auth/session persistence and OAuth deep links (HashRouter / redirect handling)
- YAJ AI text, image generation, document uploads, photo picker and voice on both devices
- Microphone/camera permission descriptions in iOS Info.plist and AndroidManifest.xml
- Radio/background audio, notifications, share sheet, file downloads, video playback
- All relevant store policies, account deletion, user content reporting and payment flows

## Important
- `com.yaj.app` is a **placeholder**, not a verified globally unique store identifier.
- Do not set `server.url` to the Lovable preview or production website for store builds.
- `npx cap sync` must follow each production web build.
- Do not claim native readiness until signed builds install and pass device testing.
- Supabase edge functions and cloud database deployments are separate from native builds.
