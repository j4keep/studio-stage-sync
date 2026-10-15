# YAJ — iOS + Android release readiness

Status: **preparation, not store-ready**. This checklist is based on a preliminary repository inspection; a successful device test or store approval has **not** been established.

## Verified in repository
- Vite/React application with `npm run build`, `npm run lint`, and `npm run test`.
- HashRouter navigation, Supabase authentication/client integration.
- Web app metadata and an existing YAJ app icon reference in `index.html`.
- User reports that YAJ AI image generation, file uploads, and microphone/voice now work in the published web app.

## Open launch blockers
- [ ] Confirm paid Apple Developer Program membership (website login alone does not establish enrollment).
- [ ] Confirm or create Google Play Console developer account.
- [ ] Decide publisher legal identity (individual vs organization) and app identifiers.
- [ ] Establish native iOS and Android packaging (no root `capacitor.config.ts` found in preliminary inspection).
- [ ] Set up Xcode/macOS and Android Studio signing, builds, and CI/reproducible build steps.
- [ ] Test all camera, microphone, uploads, downloads, audio playback, deep links, authentication redirects, background behavior, and push notifications **inside native shells** on physical iPhone and Android devices.
- [ ] Review all user-generated content flows for reporting, blocking, moderation, appeals, and administrator response.
- [ ] Verify privacy policy, terms, account deletion and associated data cleanup, permissions and data-safety disclosures.
- [ ] Audit Supabase RLS/storage policies, secrets, privileged edge functions, and abuse/rate limiting.
- [ ] Audit payments, subscriptions, digital purchases and relevant Apple/Google billing rules.
- [ ] Run clean dependency install, production build, lint, tests, and smoke tests; record outcomes.
- [ ] Verify icon, splash screen, store listing, screenshots, support contact, age rating, review account and content declarations.
- [ ] Upload to TestFlight and Google Play internal testing; resolve platform-specific defects.
- [ ] Submit both builds and coordinate public rollout after review approvals.

## Release gates
**Gate A: Code & security** — production build, automated tests, auth, storage, backend and moderation reviewed.

**Gate B: Native parity** — physical-device smoke tests for iOS and Android pass; no launch-blocking errors.

**Gate C: Store compliance** — developer memberships, signing, policy disclosures, privacy/deletion and listing complete.

**Gate D: Coordinated release** — both store submissions accepted, release timing coordinated; never promise identical review completion dates.

## Deployment note
Pushing to GitHub does not itself deploy Supabase Edge Functions. Backend deploys must be verified separately.

## Current scope
Do not change functioning YAJ AI behavior during packaging without a regression test. Use the same codebase for both stores, but test platform-specific behavior separately.
