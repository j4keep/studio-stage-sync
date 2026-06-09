# W.Studio DAW — Soundtrap-style build

Building a browser DAW at `/wstudio/daw` while keeping the existing session collab (join code, participants list, screen share, WebRTC) intact. The old `UnifiedSessionScreen` stays live until the new DAW is proven, then we point session routes at it.

## Scope across 3 phases

### Phase 1 — Multitrack DAW core
- New page `src/pages/WStudioDawPage.tsx` mounted at `/wstudio/daw` and `/wstudio/session/:code/daw`
- Engine `src/wstudio/daw/engine/DawEngine.ts` — Web Audio graph, transport (play/stop/record/loop), sample-accurate scheduling, BPM + metronome, master bus
- Track model: unlimited tracks, each = audio OR instrument; per-track gain, pan, mute, solo, arm, input select, output bus
- Timeline UI `Timeline.tsx` — ruler (bars/beats + time), zoom, snap-to-grid, drag clips, trim, split, duplicate, delete
- Clip waveform rendering via offline peak extraction (cached)
- Recording: arm track → record from selected mic input → clip drops on timeline at playhead
- File import: drag-and-drop WAV/MP3/OGG/M4A → new audio track + clip
- Export: render master to WAV via OfflineAudioContext

### Phase 2 — Mixer + built-in effects + plug-in uploads
- Mixer view (toggle from arrange view): vertical channel strips per track + master
  - Fader (dB-scaled), pan knob, mute/solo, meter (peak + RMS), insert FX slots (up to 6), send to 2 buses (Reverb / Delay)
- Built-in effects (Web Audio): EQ (3-band + parametric), Compressor, Reverb (convolution), Delay, Chorus, Distortion, Limiter, Auto-tune-style pitch correction (PSOLA approximation)
- Effect presets per plugin
- **User plug-in uploads** (Soundtrap-style): users upload `.wasm` + manifest JSON, stored in R2; engine loads them as AudioWorkletProcessors at runtime
  - Manifest declares params (name, min/max, default), I/O channels
  - Per-user "My Plug-ins" library page; sandboxed worklet load
  - Note: native VST/AU `.dll/.vst3/.component` cannot run in browser — UI clearly states "Web plug-ins (WASM) supported". Native plug-in support requires the helper app (parked).

### Phase 3 — Instruments, MIDI, sound library, quantize
- Virtual instruments: built-in sampler + simple synth (Web Audio oscillators) + drum machine grid
- MIDI: piano-roll editor per instrument clip (note add/move/resize/velocity), MIDI keyboard input via WebMIDI
- Quantize: clip + MIDI note quantize to 1/4, 1/8, 1/16, 1/32, triplets, with strength %
- Sound library: browseable loops/one-shots (seeded set in R2), drag to timeline; per-user uploaded samples
- Metronome, count-in, loop region

## Keep / reuse
- `SessionContext`, join-code flow, participants panel, screen share (`StudioMediaContext`), WebRTC signaling — all kept. DAW page wraps in the existing session provider when a session code is present, hides collab chrome when standalone.
- `IncognitoFeedWindow` continues to float over DAW.

## File layout
```text
src/wstudio/daw/
  engine/
    DawEngine.ts           transport, graph, scheduler
    Track.ts               track model + per-track chain
    Clip.ts                audio + MIDI clips
    Effects.ts             built-in FX factory
    WasmPluginHost.ts      user plug-in worklet loader
    Sampler.ts, Synth.ts, DrumMachine.ts
    Recorder.ts            arm + capture
    Exporter.ts            offline render to WAV
    Metronome.ts, Quantize.ts, Peaks.ts
  state/
    DawStore.ts            zustand store (tracks, clips, transport, mixer)
  ui/
    DawShell.tsx           top bar (transport, BPM, time, view switch)
    ArrangeView.tsx        timeline + track headers
    MixerView.tsx          channel strips
    TrackHeader.tsx, ChannelStrip.tsx, Fader.tsx, Knob.tsx, Meter.tsx
    ClipView.tsx, WaveformView.tsx
    PianoRoll.tsx
    LibraryPanel.tsx       sound + plug-in library, drag source
    PluginRack.tsx, PluginUploadDialog.tsx
    CollabSidebar.tsx      wraps existing participants + screen share
    JoinCodeBadge.tsx      reuses session code display
src/pages/WStudioDawPage.tsx
```

## Backend additions
- R2 buckets reused: new prefixes `daw/projects/{userId}/{projectId}/`, `daw/plugins/{userId}/`, `daw/samples/{userId}/`
- Supabase tables:
  - `daw_projects` (id, user_id, name, bpm, data jsonb, updated_at) + RLS owner-only + grants
  - `daw_user_plugins` (id, user_id, name, manifest jsonb, wasm_key, created_at) + RLS owner-only + grants
- Edge functions reuse `r2-upload` / `r2-presign` / `r2-download`

## Rollout
1. Phase 1 ships as `/wstudio/daw` (standalone). Old session screen untouched.
2. Phase 2 adds mixer + FX + plug-in upload UI.
3. Phase 3 adds MIDI + instruments + library + quantize.
4. Add `?session={code}` param so DAW boots inside an active collab session; collab sidebar appears, screen share button reuses existing media context.
5. Once stable, replace UnifiedSessionScreen route target with DAW.

## Technical notes (non-user)
- Transport uses a lookahead scheduler (25ms tick, 100ms lookahead) over `AudioContext.currentTime` for sample-accurate playback.
- Peaks computed on a Web Worker; cached by clip hash.
- Clips reference an AudioBuffer pool keyed by file hash to avoid duplicate decodes.
- Mixer channel strip = `Track.input → inserts[] → panner → fader → (sends) → master`.
- AudioWorklet plug-ins receive params via `port.postMessage`; UI knobs bind to manifest params.
- Project autosave to `daw_projects.data` (debounced 3s).
- WAV export uses OfflineAudioContext at 44.1kHz/16-bit, streamed to R2 via existing upload flow.

## Out of scope (explicit)
- Native VST/AU/AAX plug-ins (browser cannot host these without the parked helper app).
- Video tracks.
- Notation view.
