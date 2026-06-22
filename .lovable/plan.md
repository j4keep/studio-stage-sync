# Plan: Home Restructure + WHEUAT.TV Card + Take a Break + Podcast Cleanup

## 1. Bottom Nav (`BottomNav.tsx`, `AppLayout.tsx`)
- Rename "TV" → **W.Studio** (route stays `/tv`).
- New 5-item layout: **Home · W.Studio · ➕ (Create) · Profile · J-Hi**
  - Center `+` opens the same Create Post sheet used at the top of the feed.
  - `+` styled as a neon/accent gradient circle (lifted above bar).

## 2. Homepage = Feed (`HomePage.tsx`, `FeedPage.tsx`)
- Merge FeedPage content into HomePage as the primary view.
- Remove **Featured New Music**.
- Keep **Trending Creators** (rename from "Trending Artists"), ranked by `likes + views` desc, auto-recomputed.
- Top scroll tabs (replacing For You/Following/Trending/News):
  - **Radio** · **Battle** · **WHEUAT.TV** · **Songs** · **🤝 (Support Creators icon)**
  - Each navigates to its page; vertical feed scroll behavior preserved.
- Remove the Store and Studio 3D cards from Home (move as plain text cards into W.Studio hub).
- Add new card alongside Battle/Shop area: **WHEUAT.TV card** that links to a public viewer (see §3).

## 3. WHEUAT.TV Public Viewer (new `WheuatTvPublicPage.tsx` or extend `WheuatTvPage.tsx`)
- Two surfaces:
  - **Creator surface** (in W.Studio): upload, edit, delete — current behavior.
  - **Public viewer** (from Home card): search bar (by title / creator), grid of videos, tap-to-play.
    - Like, comment, share on **public viewer only**.
    - Creator avatar → link to `ArtistProfilePage` (follow + see more content).
- Hide comment/like UI on the creator-side Project "Post" tab (see §4).

## 4. Podcast Project → Post Tab (`PodcastEditorPro.tsx` / project view)
- Add **Post** tab to saved project view.
- Tab contains: the edited video + single **Delete** action. No comments/likes here.
- Publishing already wired to WHEUAT.TV store; "Post" tab reflects published state.

## 5. Theme-aware Podcast (`PodcastRoomPage.tsx`, lobby, editor)
- Audit hard-coded purple/teal/blue → swap to `bg-primary`, `text-primary`, `border-primary`, `ring-primary`.
- Buttons, active tabs, progress, accents all follow user's selected theme (via `ThemeContext`).

## 6. Take a Break (`SettingsPage.tsx` + new `useTakeABreak` hook + `AuthContext` flag)
- Settings tab: **Take a Break** toggle (on/off, persists in profile).
- When ON:
  - Hide user from search/discovery (profile lookup blocks viewing as online).
  - Block posting to feed (CreatePost sheet shows "You're on a break" notice).
  - Hide Feed scroll content (Home shows break placeholder + access to Radio/Podcast/Profile).
  - Block access to Battle page (redirect with message).
  - Still allowed: Radio, Podcast (create + publish), Profile/Settings, W.Studio.
- Implemented as gate component + route-level guard for `/feed` content area and `/battles`.

## 7. Trending Creators Ranking (`HomePage.tsx` helper)
- Pull creators from existing feed/profile data, compute `score = totalLikes + totalViews`, sort desc, render top N as horizontal scroll.

## Technical notes
- No backend schema changes needed; "take a break" stored on existing profile row (add `on_break boolean` via migration with GRANT + RLS preserved).
- WHEUAT.TV likes/comments stored locally for now (matches existing `wheuatTvStore.ts` pattern) unless you want Cloud-backed.
- Existing podcast room/recording/scheduling untouched.

## Out of scope (confirm if you want included)
- Server-side enforcement of Take a Break (current plan is client-side + profile flag; another user could still technically query). Say the word if you want full RLS lockdown.
- Migrating WHEUAT.TV likes/comments to Lovable Cloud (currently localStorage).

Approve and I'll build it in one pass.