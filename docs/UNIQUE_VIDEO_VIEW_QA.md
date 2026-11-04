# YAJ unique video views — deployment and device QA

## Deployment blocker
The migration `supabase/migrations/20261104190000_unique_video_viewers.sql` is committed
to GitHub **but must be applied to the production Supabase project** before its RPCs
can accept unique video views. Do not tell users the live count works until the
migration and end-to-end tests below succeed. The GitHub connector does not apply
database migrations automatically, and no Supabase project was exposed to this
session during implementation.

## Definition
- Video view: an authenticated viewer watches a video for at least 2 seconds in a visible active playback surface.
- One authenticated account is counted at most once for each video, across sessions and devices.
- Rewatches on the same account do **not** increase counts.
- A creator's own plays do not increase their view counts.
- Anonymous playback is deliberately not counted until an abuse-resistant anonymous visitor identity exists.
- The app avoids fingerprinting or storing a raw device identifier; it therefore cannot promise
  a strict one-physical-device-one-view policy across multiple accounts.
- Existing historical view counts may contain duplicates; they cannot be cleaned retroactively
  without historical viewer identities.

## QA before App Store / Google Play submission
1. Deploy migration on the actual YAJ Supabase project. Verify both RPCs exist and can be
   called with valid authenticated JWTs; direct insert permissions to the unique-view
   tables must remain denied.
2. Using account A, upload a video. Using account B, watch it for >= 2 seconds in Feed.
   A's profile video views should increase by exactly 1; B's own profile should not.
3. Replay A's video 10 times as B, then watch again through Happening and Profile.
   Total views must remain unchanged.
4. Sign in as B on another device and replay the same video. Total remains unchanged.
5. Using account C, watch A's video through Happening or profile. Total increases by 1.
6. Watch a Circle video for >= 2 seconds as another authorized member; its creator's
   profile view total increases exactly once. Retest as an unauthorized nonmember.
7. Check follower/following counters from two accounts: follow, unfollow, and reopen both
   profiles; counts should refresh without an app restart.
8. Confirm profile **Posts** includes posts in the general Feed and My Circle.
9. Confirm previews shorter than 2 seconds, off-screen previews and own-video plays
   do not increase counts.
10. Run YAJ release checks (typecheck, unit tests, build), then validate iOS Safari,
   Android Chrome and native builds.

Note: for the first version counts refresh on Supabase realtime events when configured,
and otherwise every 15 seconds while the profile is foregrounded; this is near-real-time
rather than a strict instant update.
