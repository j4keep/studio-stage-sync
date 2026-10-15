# YAJ Launch Checklist

## Release-candidate status

The core YAJ product is feature-complete enough to freeze major feature work. From this point forward, changes should be limited to launch blockers, broken flows, security/compliance issues, and App Store packaging.

## Completed cleanup

- Current YAJ product description replaces the old music-first / savings-circle language.
- Terms of Use and Privacy copy reflect the current app.
- Terms acceptance gate reflects the current app.
- Help routes use working Help Desk, Safety, Settings, YAJ AI, and Terms destinations.
- Retired Battles, YAJ TV, W.STUDIO, Word Link, Driving, and Dollar Club launch routes do not expose unfinished screens.
- Profile and Settings launch cleanup completed.
- Local Help business edit/delete controls added.
- Shared YAJ Local Area supports Marketplace, Deals, Opportunities, Events, Local Help, and Gigs.
- Deals participate in Happening activity and Happening balloon preferences.
- Account deletion frontend and Edge Function exist in source.
- YAJ AI source includes current whole-app guidance and attachment support.

## Before iOS packaging

- Deploy the current Supabase Edge Functions and confirm production matches GitHub.
- Confirm account deletion works end-to-end in production.
- Confirm YAJ AI text, image, voice, transcription, camera/photo/file attachments work with the intended authentication policy.
- Run a critical media test on physical iPhone over Wi-Fi and cellular:
  - create photo post
  - create video post
  - publish and return to Home
  - Home feed playback
  - Happening preview playback
  - opened video playback
  - long/slow upload behavior
- Test signup, login, password reset, logout, edit profile, privacy/blocking, Help Desk, and account deletion.
- Test Marketplace, Deals, Jobs, Events, Local Help, and Gigs with Nearby-only and Any-area modes.
- Test Radio, Messages, My Circle/live, and the launch game set.

## iOS/App Store packaging

- Add Capacitor iOS integration.
- Create the Xcode iOS project.
- Choose the final bundle identifier.
- Configure app display name, version, build number, app icon, and launch screen.
- Configure iOS permission descriptions for camera, microphone, photo library, location, notifications, and other used capabilities.
- Configure universal/deep links as needed.
- Verify safe areas, keyboard behavior, status bar, orientation, audio/video playback, and background/foreground recovery on physical iPhones.
- Configure Apple Sign In if required by the final authentication options.
- Configure Apple In-App Purchase / StoreKit for any digital PRO subscription sold inside the iOS app.
- Produce an Archive and upload to App Store Connect.

## App Store Connect

- Public Privacy Policy URL.
- Support URL.
- App description, subtitle, keywords, category, age rating, and screenshots.
- App Privacy questionnaire.
- Review notes and test credentials.
- In-app purchase metadata if applicable.
- TestFlight internal testing before public review.

## Release rule

Do not add major new product features during the release-candidate phase. Fix launch blockers only.
