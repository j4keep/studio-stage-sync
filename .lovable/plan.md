## Scope

This is a large multi-area pass. I'll do it in one go, but breaking it into clear sections so you can confirm I understood before I touch code. Nothing here changes Podcast/DAW/LiveKit/backend logic except the specific UI fixes you called out.

---

### 1. Homepage (Feed) — top pills + header

- Replace long text pills (Radio, Battle, Songs, WHEUAT.TV, Creator Support) with **compact icons + short labels** so they fit on one row without horizontal scroll and no longer overlap the Search / Mute buttons.
- Make **WHEUAT.TV pill clickable** → opens a new viewer route `/tv/watch` (see #2).
- Make **Creator Support pill** → routes to `/wstudio` → Support Creators card (see #3), not the Dollar Club page.
- Restore the **Trending Creators / Pitch Your Profile** header strip above the feed (it lives on HomePage as a header band; FeedPage stays untouched as the scrollable shorts area below it).
- **Desktop**: constrain feed to a centered phone-sized frame (max ~440px wide) instead of stretching full-screen — same mobile layout, centered on desktop.

### 2. New WHEUAT.TV Viewer (`/tv/watch`)

Public viewer for content creators uploaded from the W.Studio → WHEUAT.TV card.

- Read-only — viewers cannot edit/delete/access the creator card.
- Search bar at top: searches by artist name, video name, podcast name, category.
- Category filter chips: **Podcasts / Short Films / Music Videos**.
- Each video: like, comment, share (WhatsApp, copy link, SMS).
- Creator avatar → tapping opens that creator's profile (follow button there).
- The existing W.Studio WHEUAT.TV card remains creator-only (manage/upload/delete).

### 3. W.Studio cards cleanup

Final 6 cards: **Live Podcast · WHEUAT.TV · Recording Studio · Store · Studios · Support Creators**

- Rename **Projects → Support Creators**, point it at the existing Dollar Club page.
- Delete the standalone **Support Creators** card (now merged into renamed Projects card).
- **WHEUAT.TV card**: single **Upload Project** button. Remove the separate Podcast / Short Film / Music Videos tabs above — instead, the upload form has a **Category** dropdown (Podcast / Short Film / Music Video).

### 4. Live Podcast / Project page

- Delete the 3 fake/seed episodes on the Projects tab.
- Project cards get the same buttons as Recent recordings: **Edit · Download · Rename · Delete · Publish to WHEUAT.TV**.
- Remove the "Publish to WHEUAT.TV" button from the editor — it lives only on the project card.
- Normalize button sizes — consistent, professional.
- Live podcast layout: match the post-record editor layout. **Host = small tile, Guest/background = main tile** (currently reversed).
- Make layout-picker blocks small, polished.
- Investigate the playback stutter on saved/downloaded recordings (likely encoder/keyframe issue).

### 5. Recording Studio / DAW

- Add a **Back arrow** on the Recording Studio page AND inside the DAW that returns to Home.
- Back button must **not end the session** — only the engineer or the user explicitly ending stops it. Re-entering returns to the live session in progress.

### 6. Profile page

- Delete **Legal Vault** section.
- Delete **News Feed** section.

### 7. Incognito feed window

- Remove the Incognito launcher from the homepage entirely.
- Delete the **Open Standalone** button + icon from the incognito window.
- When the window is in **shrunk** state: hide avatar, name, title text, and the 3-dot menu. Keep Like / Share visible.

### 8. Logo concepts (separate, no code)

I'll generate 3–4 logo concept images for you to pick from. No code changes for this part yet.

---

## What I will NOT touch

- Podcast recording engine, LiveKit signaling, scheduling backend, DAW audio engine, R2 upload pipeline, auth, RLS — only the UI/routing changes listed above.

## Confirm before I build

Reply **"go"** and I'll execute all 8 sections in one pass. If any item is wrong, tell me which number to change.
