# YAJ native mobile functional QA matrix

Status: **Not yet executed on physical devices**. A green CI build or simulator launch does not count as passing these scenarios.

## Environments
- iOS: signed development/TestFlight build on a real iPhone; note iOS version, device, app commit and tester.
- Android: debug APK on real Android phone, then internal-track signed AAB; note Android version, device, app commit and tester.
- Use dedicated test accounts and non-sensitive media; verify against staging when destructive tests are involved.

## Release-blocking scenarios

| Area | iOS | Android | Acceptance criteria |
| --- | --- | --- | --- |
| Cold launch | NOT TESTED | NOT TESTED | YAJ UI renders, no stuck splash or blank screen |
| Sign up and verify email | NOT TESTED | NOT TESTED | Account creation, confirmation and return to app work |
| Sign in / sign out | NOT TESTED | NOT TESTED | No loop, errors, or unintended session sharing |
| Session persistence | NOT TESTED | NOT TESTED | Reopen after force-close remains signed in; logout remains signed out |
| Password reset | NOT TESTED | NOT TESTED | Email link opens valid reset flow and returns to app |
| Navigation / safe areas | NOT TESTED | NOT TESTED | Back buttons, bottom navigation, landscape and notches usable |
| Feed images/video | NOT TESTED | NOT TESTED | Load, playback, upload, permissions and controls work |
| Camera / photo picker | NOT TESTED | NOT TESTED | Request permission appropriately, denial handled, successful upload |
| Microphone / voice AI | NOT TESTED | NOT TESTED | Permission, record, playback and denial/retry work |
| YAJ AI chat and images | NOT TESTED | NOT TESTED | Chat, image generation and file upload work with account |
| YAJ Radio | NOT TESTED | NOT TESTED | Music/podcast station streams; host controls; listeners cannot skip station tracks |
| Audio interruptions | NOT TESTED | NOT TESTED | Call, headphones, background/foreground transitions handled |
| Report and block | NOT TESTED | NOT TESTED | Reporting reaches moderation; block hides content consistently |
| Account deletion | NOT TESTED | NOT TESTED | Accessible in app, requires confirmation; backend cleanup independently verified |
| Offline / reconnect | NOT TESTED | NOT TESTED | Graceful offline state and recovery |
| External links | NOT TESTED | NOT TESTED | Correct in-app or system browser behavior |
| Accessibility | NOT TESTED | NOT TESTED | Screen reader, font scaling, contrast and touch targets |

## Evidence
For each scenario record device model, OS, build SHA, result (PASS/FAIL/BLOCKED), steps, screenshot/video, and bug reference. Never mark PASS based only on successful compilation or process launch.

## Current automated evidence
- GitHub Actions native scaffold workflow builds an Android debug APK and unsigned iOS simulator app.
- Both simulator launch commands have succeeded.
- Screenshots are captured and checked for basic validity/variation; this **does not establish the expected screen or content**.
- The current Capacitor bundle identifier `com.yaj.app` remains provisional and must be finalized before signing/store submission.

## Before TestFlight and Play internal testing
1. Verify Apple Developer Program membership and Google Play Console access.
2. Choose final unique bundle ID/application ID and signing identities.
3. Confirm deep links, auth callback URLs, microphone/camera/photo usage descriptions, and any required native plugins.
4. Produce signed physical-device builds; distribute via TestFlight and Play internal testing.
5. Audit data deletion, privacy disclosures and moderation end to end before store review.
