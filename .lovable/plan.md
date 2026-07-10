# Feed Redesign + Flag Backgrounds + Split Create Flows

## 1. Feed Page — Two-column split

Rework `src/pages/FeedPage.tsx` into a two-column layout:

```text
┌──────┬──────────────────────────┐
│ REEL │        POSTS             │
│ 25%  │        75%               │
│      │                          │
│ swipe│ swipe up/down            │
│ up/dn│                          │
└──────┴──────────────────────────┘
```

- **Left column (25%)** — Reels rail: vertical snap-scroll of short items (video ≤60s OR photos tagged as reel). Small preview cards, each a rounded card floating on the flag background.
- **Right column (75%)** — Posts rail: vertical snap-scroll of long-form posts (video >60s, photos, text). Larger cards.
- Tap a card → opens **fullscreen viewer** for that rail only. Swiping in the viewer stays within that rail's items. Close returns to the split view at the same index.
- Header (logo, search, category pills, trending strip) unchanged.
- All text/icons (like/comment/share/caption) live **inside the card**. Nothing floats on the flag background.

### Item routing

Classify feed items in `src/lib/feed-items.ts` helper (or FeedPage memo):
- `reel` = video with `duration_seconds <= 60` OR photo posts flagged short.
- `post` = everything else.

New components:
- `src/components/feed/FeedReelCard.tsx` — compact card (thumbnail, small overlay caption).
- `src/components/feed/FeedPostCardMini.tsx` — larger card variant of the existing FeedPostCard, chrome always visible.
- `src/components/feed/FeedFullscreenViewer.tsx` — reuses existing `FeedPostCard` fullscreen, scoped to a filtered list + start index.

## 2. Flag backgrounds

### Data
Add `country_flag` (text nullable) to `profiles`. Migration + grants + policy update if needed. Store flag ID (e.g. `us`, `jp`, `pride`, `trans`).

### Library
`src/lib/flag-themes.ts` — list of ~50 major countries + pride/trans/nb flags. Each entry: `{ id, label, emoji, colors: string[] }`. Background = full flag pattern rendered as CSS gradient stripes (horizontal or vertical based on flag). Include a `pattern` field: `horizontal` | `vertical` | `solid`.

### Renderer
`src/components/FlagBackground.tsx` — renders the striped background full-bleed behind the feed columns.

### Profile UI
In `src/components/ThemePickerSheet.tsx`, add a **second tab** row: `Theme | Flag`. Flag tab shows a grid of flag chips (emoji + label). Selecting one saves to `profiles.country_flag` and reflects on the feed background.

### Context
Extend `ThemeContext.tsx` with `countryFlag` + `setCountryFlag`, loaded/saved alongside theme.

## 3. Create flow split — Reel vs Post

Update `src/lib/create-modes.ts`:
- `QUICK` → rename to `REEL` (60s hold-to-record, or upload video ≤60s / photo).
- `CREATE` → `POST` (no time limit, upload video/photo, no hold-to-record cap).
- Keep `LIVE` unchanged.

`CreateCameraView.tsx` reads mode:
- Reel: enforce `QUICK_MAX_RECORD_SEC = 60` (already 60).
- Post: remove the 60s ceiling; allow long tap-to-start / tap-to-stop and gallery upload of any duration.

On publish, tag the post with `is_reel: boolean` in metadata so the feed can route it correctly.

## 4. Technical notes

- Backwards compat: existing posts without `is_reel` classified by duration.
- Fullscreen viewer keeps current audio-unlock and mount-radius logic; just receives a filtered array.
- Card visual: `rounded-2xl overflow-hidden bg-black shadow-xl` sitting on the flag background with a `p-2` gap between cards.
- Flag background sits behind the columns; header keeps its dark gradient overlay so pills stay readable.
- No changes to bottom nav, icons, or header sizes per user's earlier rule.

## Out of scope this pass
- No changes to Communities, Profile layout beyond the flag tab, or WStudio.
- No new DB analytics — `is_reel` stored inside existing metadata JSON, no schema change needed for posts table.

Confirm and I'll build it in one pass.
