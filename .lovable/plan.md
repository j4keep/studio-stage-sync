# Home Feed + Create Post — Cleanup Pass

This is a large surface (~4,600 lines across 8 files). To avoid burning your remaining credits on a thrash, I'll do this as **one focused pass** on the specific behaviors you listed — no UI redesign, no touching Shop/Explore/Profile/Battle/Radio/W.STUDIO/Podcast.

## Files I will change

1. `src/lib/feed-video-playback.ts` — single source of truth for feed audio unlock + play/pause.
2. `src/components/feed/FeedPostCard.tsx` — collapse the tangled autoplay/mute retry logic into one clean state machine.
3. `src/pages/FeedPage.tsx` — ensure only the active index plays; pause + release neighbors past ±1.
4. `src/components/feed/create/CreateCameraView.tsx` — hold-to-record, unified stop path (manual + auto-stop at 60s), front camera default, mic settings locked to the social preset.
5. `src/components/feed/CreatePostSheet.tsx` — upload icon uses a plain `<input type="file" accept="image/*,video/*">` with **no** `capture` attribute (gallery only, never live camera).
6. `src/components/feed/create/MediaEditView.tsx` — guarantee the recorded/uploaded blob is playable before entering editor; keep `media_type` correct on post.
7. `src/lib/post-music-preview.ts` — lip-sync start: recorder starts first, then music seeks to `trimStart` and plays in the same tick.
8. `src/lib/create-camera.ts` — keep the current natural-mic settings, remove any remaining bitrate hints, ensure `stopVideoRecorderWithFinalChunk` is used in both manual and auto-stop paths.

## Behavior fixes (mapped to your list)

### Feed (1)
- One `activeIndex` in `FeedPage`; every card receives `isActive`. Non-active cards call `video.pause()` and set `src=""` when >±1 away to cap concurrent decoders.
- Mute button toggles `video.muted` directly; state derived from the element, not a parallel React flag.
- On active-change: `video.muted = !audioUnlocked`, `play()`. If `play()` rejects → fall back to `muted=true`, `play()` again, and register a one-shot pointerdown to unmute.
- No post is muted by default when there's no added sound.

### Create camera (2, 4)
- Default `facingMode: "user"`.
- Record button: `onPointerDown` starts, `onPointerUp`/`onPointerCancel`/`onPointerLeave` stops. Min 1s (ignore stop if <1s), max 60s auto-stop via timer that calls the **same** `finalizeRecording()` used on manual release.
- `finalizeRecording()` = `stopVideoRecorderWithFinalChunk()` → wait for final `dataavailable` → concat blobs → hand to editor.
- Mic constraints: `{ echoCancellation:false, noiseSuppression:false, autoGainControl:false, sampleRate:{ideal:48000}, channelCount:{ideal:1} }` (already in `SOCIAL_AUDIO`).

### Upload (3)
- Media button opens a hidden `<input type="file" accept="image/*,video/*" />` — **no `capture` attr**. On iOS this shows the photo library, never the camera.

### Lip-sync (5)
- On record down (with added sound):
  1. `recorder.start()`
  2. `music.currentTime = trimStart`
  3. `await music.play()` in the same gesture
- Music does not play before recorder starts; both stop together on release/auto-stop.

### Editor (6)
- Wait for `loadedmetadata` on the recorded blob URL before showing editor; if it fails, show a retry instead of a frozen frame.
- Text/sticker/crop/mute already exist — I'll only fix any that break playback (event listeners not stopping propagation to `<video>`).

### Post (7)
- Recorded video → `media_type: "video"`, MIME from blob, keep `music` metadata (`url`, `trimStart`, `trimEnd`, `volume`, `muteOriginal`) so feed playback re-syncs.

### Stability (8)
- Remove leftover DAW/podcast audio hooks from the feed/create paths.
- One `MediaRecorder` per camera session; explicit teardown on unmount and on navigation away from `/` or the create sheet.
- All timers/listeners tracked in refs and cleared in cleanup.

## What I will NOT do
- No visual redesign, no new buttons, no changes to Shop/Explore/Profile/Battle/Radio/Podcast/W.STUDIO.
- No new dependencies.

## Verification after the pass
- `bun run build` succeeds.
- Manual smoke test checklist you already wrote (A/B/C flows).

## Credits reality check
This touches 8 files and rewrites the trickiest parts of two of them. If the pass doesn't fully resolve every mobile-Safari audio quirk on the first try, I'll stop and report rather than iterate blindly — mobile autoplay policies genuinely require a real user tap before the *first* sound plays, and no code change can bypass that on iOS Safari.

Approve and I'll execute the whole pass in one go.