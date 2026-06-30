# Cleanup: Remove W.STUDIO + Podcast, pivot to J-HI

This is a UI/route-level removal. I will hide the dead surfaces and rewire navigation, **without** mass-deleting files yet (safer rollback, fewer broken imports). A follow-up pass can hard-delete the orphaned files once you confirm nothing regressed.

## Note on backup branch
I can't create git branches from inside Lovable (git is managed by the platform). Before I start, please create the backup branch yourself:
- Open the GitHub integration → create branch `legacy-wstudio-podcast-backup` from current `main`.
- Then tell me "go" and I'll proceed on `main`.

Alternatively, Lovable's version history (top of chat) lets you revert to this exact message later, so the branch is optional.

## Scope of changes

### 1. Bottom navigation (`src/components/BottomNav.tsx`)
Replace tabs:
- Old: Home · W.STUDIO · [Create] · JiHi · Profile
- New: Home · Explore · [Create] · Communities · Profile
- Center "+" button kept (opens CreatePostSheet).
- Routes: `/explore` and `/communities` will be added as lightweight placeholder pages ("Coming soon") so nav doesn't 404.

### 2. Routes removed from `src/App.tsx`
- `/tv` and all TV subroutes
- `/wstudio/*` (DAW, session join, artist, engineer, bridge, live)
- `/podcast/*` (studio, room, join, lobby, schedule, editor, contacts)
- Any redirect that points to `/tv` (e.g. `HomePage` → already goes to FeedPage, fine)

Removed route components will no longer be imported. Files stay on disk (dead code) for now.

### 3. Entry points / cards that link to the above
Audit and remove buttons/cards pointing to TV, W.STUDIO, DAW, Podcast Studio from:
- HomePage / FeedPage headers
- ProfilePage quick actions
- Any "Recording Studio" or "Live Podcast" card

### 4. Rebrand label
- "W.STUDIO" / "WHEUAT" labels in nav/headers → "J-HI" where they're user-facing nav strings. Logo asset stays unless you want it changed.
- The `JiHi` tab → renamed conceptually to Communities (Ask-JHi page stays reachable from elsewhere if you want — confirm below).

### 5. Kept intact
Feed, CreatePostSheet, camera, MediaEditView, SoundPickerSheet, Add Sound, profile, battles, radio, auth, storage, Ask-JHi page (route kept at `/ask-jhi`, just removed from bottom nav unless you want it as Communities target).

## Open questions before I start

1. **Ask-JHi chat** — keep route `/ask-jhi` accessible (e.g. from profile or floating button), or fully hide?
2. **Communities tab** — placeholder "Coming soon" page now, or wire it to existing `/ask-jhi` temporarily?
3. **Explore tab** — placeholder, or point at existing browse pages (`/browse-songs`, `/browse-videos`)?
4. **Hard delete vs hide** — confirm OK with leaving `src/wstudio/**` and `src/pages/podcast/**` files on disk this pass (just unrouted), and doing the file deletion as a second step after smoke test?

Once you answer (or say "use defaults: hide ask-jhi, placeholder for both, soft-delete only"), I'll execute.
