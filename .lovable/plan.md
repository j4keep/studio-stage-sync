
# Live Podcast Studio (Riverside-style)

A full podcast recording, editing, AI repurposing, and live-streaming product, added as a "Live Podcast" card on the TV page. Everything else in the app stays untouched.

## What the user gets

**Lobby (host)**
- Create a new episode (title, cover, description)
- Pick mic, camera, speaker; live preview tile
- One-click "Start recording"
- Copy guest invite link (no install, opens in any browser)
- Library of past episodes with status (Recording / Processing / Ready)

**Live room (host + guests)**
- HD video + audio for every participant via LiveKit Cloud
- Up to 10 participants
- Per-participant local recording in their browser (MediaRecorder, 1080p), uploaded in 5-second chunks to R2 — survives Wi-Fi drops, like Riverside
- Screen share (separate uploaded track)
- Live chat
- Producer panel: mute guest, remove guest, end session

**Live streaming (simulcast)**
- Schedule a stream, attach destinations (YouTube, Twitch, custom RTMP — Facebook/LinkedIn via custom RTMP URL)
- Go live with one click → LiveKit Egress fans out to all destinations
- Pull-in chat from YouTube + Twitch (Omnichat), reply once → posts to all
- Clickable lower-thirds during the stream

**After recording → Episode page**
- Auto-uploaded high-quality tracks per participant (video + audio, separately downloadable)
- Auto-transcript (Lovable AI speech-to-text), word-level timestamps
- AI: summary, takeaways, suggested titles, soundbites, YouTube-ready chapter markers
- Magic Audio (noise/reverb reduction) toggle per track
- Text-based editor: delete words/sentences in the transcript → cuts the video
- Format switcher: 16:9 / 9:16 / 1:1 with layout presets (stacked, split, picture-in-picture)
- Animated captions (style presets + custom)
- Magic Clips: auto-generate 30–60s vertical shorts; topic search ("clips mentioning X")
- Brand kit: upload intro/outro, default background image, default caption style — applied per format
- Export to MP4 (per-format) + downloadable per-participant raw tracks

## Where it lives

- New card "Live Podcast" on **TV page** with a studio mic visual
- Routes: `/podcast` (library), `/podcast/new`, `/podcast/live/:episodeId`, `/podcast/episode/:episodeId` (editor), `/podcast/join/:inviteCode` (guest)

## Tech details

**WebRTC**: LiveKit Cloud. Server token minting in an edge function (`livekit-token`). Client uses `@livekit/components-react`. Requires secrets `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`.

**Local-first recording**: each participant's browser runs `MediaRecorder` on its own mic + camera at 1080p VP9/Opus, slices to 5s chunks, multipart-uploads to R2 under `podcast/{episodeId}/{participantId}/{chunkIndex}.webm`. A finalize edge function concatenates chunks (server-side `ffmpeg` via Deno binary or a follow-up Cloudflare Worker — for v1 we keep chunks and stream them as MSE for playback, and use LiveKit Egress for the merged master).

**Live streaming**: LiveKit Egress (RoomCompositeEgress) → RTMP outputs. Edge function `livekit-stream-start` / `-stop`.

**Transcription**: edge function `transcribe-episode` calls `https://ai.gateway.lovable.dev/v1/audio/transcriptions` with `openai/gpt-4o-mini-transcribe`, stores word-level timestamps.

**AI summary/chapters/clips**: edge function `generate-podcast-ai` calls `google/gemini-2.5-pro` via Lovable AI Gateway, returns JSON (summary, takeaways, titles, soundbites with timestamps, chapter list, suggested vertical-clip ranges).

**Magic Audio**: client-side `AudioWorklet` noise-suppression chain (RNNoise WASM) applied at export time.

**Editor**: text-based timeline. Deleting transcript tokens removes the matching time ranges; export pipeline (client `ffmpeg.wasm` for short clips, edge function with `ffmpeg` for full episodes) re-encodes.

## Database (new tables)

- `podcast_episodes` — host_id, title, description, cover_url, status (`scheduled|live|processing|ready`), livekit_room, scheduled_for, started_at, ended_at, duration_seconds, master_video_url, transcript_json, ai_json, brand_kit_id
- `podcast_participants` — episode_id, user_id (nullable for guests), display_name, role (`host|guest`), invite_code, joined_at, left_at, video_url, audio_url, screen_url
- `podcast_recordings` — episode_id, participant_id, chunk_index, kind (`camera|mic|screen`), r2_key, started_at, duration_ms, bytes
- `podcast_clips` — episode_id, kind (`magic_clip|full_episode|short`), format (`16x9|9x16|1x1`), title, start_ms, end_ms, captions_json, export_url, status
- `podcast_brand_kits` — user_id, intro_url, outro_url, background_url, captions_style_json, default_format
- `podcast_stream_destinations` — episode_id, platform, rtmp_url, stream_key (encrypted), label
- `podcast_chat_messages` — episode_id, author, source (`local|youtube|twitch`), text, sent_at

All tables get GRANTs + RLS scoped to host/participant access.

## Edge functions (new)

- `livekit-token` — mints room tokens for host/guest
- `livekit-egress-start` / `livekit-egress-stop` — composite recording + RTMP simulcast
- `podcast-finalize` — called when episode ends; assembles chunk manifest, kicks off transcribe + AI
- `transcribe-episode` — Lovable AI speech-to-text
- `generate-podcast-ai` — summary/chapters/titles/soundbites/clip suggestions
- `podcast-export-clip` — server-side ffmpeg job for full-episode + 9:16 exports
- `r2-multipart-init` / `-complete` — chunked upload signing (extending existing `r2-presign`)

## Out of scope for v1 (call out)

- Native iOS/Android apps (browser-only; mobile web still works)
- Real-time on-the-fly noise reduction in the live call (we apply Magic Audio at export instead)
- 4K capture (browser MediaRecorder maxes at 1080p reliably)

## What I need from you to start

1. Confirm I should add the LiveKit secrets (I'll prompt you with the secret form).
2. Confirm you want me to default brand colors / fonts to your existing theme (I will).

After approval, I'll ship in this order:
1. Secrets + DB migration
2. Token + invite flow + live room (recording works end-to-end, raw files visible in library)
3. Transcription + AI summary/chapters
4. Editor + magic clips + exports
5. Live streaming (Egress + RTMP destinations + Omnichat)
