# Pivot Plan: Nuke W.Studio → WHEUAT TV + Atchup Integration

This is a large, destructive change. Please confirm before I touch anything.

## Phase 1 — Nuke W.Studio (Option B, full)

Delete everything DAW, sessions, bridges, plugins, native helpers.

**Frontend deletes:**
- `src/wstudio/` (entire folder: daw, session, booking, audio-engine, bridge, audio, connection, media, receive, video, components, lib)
- `src/pages/WStudioDawPage.tsx`
- `src/pages/MyBookingsPage.tsx`, `MyStudiosPage.tsx` (studio engineer booking)
- `src/components/CreateStudioSheet.tsx`, `EditStudioSheet.tsx`, `RateSessionModal.tsx`, `UnratedSessionPopup.tsx`, `SessionControlsLockOverlay.tsx`-style files
- `src/pages/StudiosPage.tsx`
- `src/hooks/use-studio-engine.ts`, `use-recording-engine.ts`

**Backend deletes (edge functions):**
- `auto-confirm-sessions`, `expire-bookings`, `session-lookup`
- Tables to drop (migration): `studios`, `studio_availability`, `studio_bookings`, `studio_photos`, `studio_reviews`, `live_sessions`, `live_session_participants`, `recording_sessions`, `recording_takes`, `recording_exports`, `no_show_strikes`

**Native deletes:**
- `native/` (entire folder: wstudio-coreaudio-driver, wstudio-desktop-bridge, wstudio-plugin)
- `scripts/build-wstudio-*.sh`, `scripts/wstudio-*.sh`, `scripts/fix-wstudio-*.sh`
- `.github/workflows/wstudio-bridge-macos.yml`
- `public/wstudio-bg.mp4.asset.json`

**Routes:** strip all `/wstudio/*`, `/studios`, `/my-bookings`, `/my-studios` routes from `App.tsx`.

## Phase 2 — Build WHEUAT TV (new section)

New route group `/tv` replacing where W.Studio lived.

**Pages (new):**
- `src/pages/tv/TvHomePage.tsx` — landing: Live podcasts, Short Films, Music Videos tabs
- `src/pages/tv/TvLivePodcastPage.tsx` — host/join live podcast (WebRTC multi-party), record session, download MP4/MP3 to device or save to user library
- `src/pages/tv/TvUploadPage.tsx` — upload short films & music videos (R2)
- `src/pages/tv/TvChannelPage.tsx` — per-creator channel with Support/Donate tab
- `src/pages/tv/TvWatchPage.tsx` — video player

**Backend:**
- New tables: `tv_channels`, `tv_videos` (type: podcast | short_film | music_video), `tv_live_rooms`, `tv_donations`
- Reuse existing R2 upload edge functions (`r2-presign`, `r2-upload`, `r2-download`)
- Reuse WebRTC signaling pattern from old `realtimeRtcSignaling.ts` for multi-party podcast rooms (single salvaged file)

**Recording approach (browser-only, simple):**
- MediaRecorder API mixing all peer audio + video tracks to WebM
- Download direct to device or upload to R2

## Phase 3 — Retrain Jhi

Update `supabase/functions/ask-jhi/index.ts` system prompt:
- Remove all W.Studio / DAW / engineer booking context
- Add WHEUAT TV (podcasts, films, videos, donations) + Atchup Savings Circle context

## Phase 4 — Import Atchup as "Savings Circle"

Bring `atchup-daily-rise` project in as a section, not a separate app.

**Copy from atchup-daily-rise:**
- All `src/pages/*` → `src/pages/circle/*` (Landing, Welcome, AccountSettings, Help, HostCode, IdVerification, PromoDownloads, Verify, m/*)
- All `src/components/*` (except `ui/`) → `src/components/circle/*`
- `src/integrations/` Atchup-specific helpers → `src/integrations/circle/`
- `src/lib/`, `src/hooks/` Atchup-specific → namespaced under `circle/`
- All Atchup `supabase/migrations/*` → re-run here (creates circle tables in same DB)
- All Atchup `supabase/functions/*` → deploy here

**Unified auth:**
- Strip Atchup's separate sign-up flow. Use existing WHEUAT auth (`AuthContext`, `AuthPage`).
- Atchup profile data (display name, avatar) sourced from existing `profiles` table — no duplicate signup, no separate profile picture.
- Keep Atchup's KYC/IdVerification as a feature gate inside Circle only.

**Privacy/Legal:**
- Copy Atchup's privacy/terms/legal pages over, replacing current `TermsPage.tsx` content with Atchup's versions.

**Navigation:**
- Add "Circle" tab to `BottomNav.tsx` next to Feed tab (using Atchup icon)
- Add small Circle button on `FeedPage` post card, right after share icon → routes to `/circle`

## Phase 5 — Rebrand WHEUAT → Atchup

- Copy Atchup logo assets (`atchup-logo-transparent.png`, `atchup-icon-only.png`, etc.) into `src/assets/`
- Replace `JhiIcon`/WHEUAT logo usage app-wide with Atchup logo
- Tagline: "Catch up with your greatness"
- Update `index.html` title, meta, favicon → Atchup
- Update memory `mem://index.md` core rules to reflect Atchup branding (keep Jhi as AI assistant name)

## Technical / Risk Notes

- **Data loss:** dropping studio/session tables is permanent. Any existing bookings/recordings are gone.
- **Scale:** this touches ~150+ files across deletes, copies, and edits. Will take multiple turns.
- **Atchup auth tables:** Atchup likely has its own `profiles`/auth schema. I will merge into existing WHEUAT `profiles` table, dropping Atchup's duplicates.
- **Atchup Stripe/payments:** if Atchup has its own Stripe edge functions for circle contributions, I'll deploy those alongside existing WHEUAT Stripe Connect.
- **Recording quality:** browser MediaRecorder for live podcasts will be ~720p WebM. Good enough for download; pro editing happens off-platform.

## Questions before I start

1. **Confirm full nuke** of bookings, studios, recording_sessions, live_sessions DB tables (permanent data loss)?
2. **Keep WHEUAT name in URL/domain** (`studio-stage-sync.lovable.app`) but rebrand UI to Atchup, or do you want me to flag domain change for you to do in settings?
3. **One-tab or section?** Should Circle be its own bottom-nav tab AND replace one of the current tabs (Home/Feed/Profile/etc), or just be added as a 5th tab?
4. **TV recording downloads** — okay with WebM format (browser-native, no transcoding)?
