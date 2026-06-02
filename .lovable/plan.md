
# W.STUDIO Mac Recording Pipe — Phase 1 Plan

Goal: Logic (or any Mac DAW) sees a real input device called **"W.STUDIO Artist Input"**, arms a track, hits record, and captures the live artist's mic from the W.STUDIO web session. No browser tricks, no AU-as-pipe. AU plugin stays purely as a control surface (meters, gain, mute, talk/listen/send).

Scope of this phase:
- macOS only
- 1 artist slot
- Existing W.STUDIO UI untouched (design, layout, colors, labels — no changes)
- Multi-artist (up to 12 slots / multi-channel device) deferred to Phase 2

---

## Architecture (final shape)

```text
 Artist browser (WebRTC mic)
        │
        ▼
 Engineer browser (W.STUDIO web)
        │  HTTP POST PCM frames
        ▼
 W.STUDIO Helper App  ──────────────► Virtual CoreAudio Device
 (127.0.0.1:48000)                    "W.STUDIO Artist Input"
        ▲                                       │
        │ /status, /artist-audio                ▼
        │                              Logic / Pro Tools / Ableton
 AU Plugin (optional control surface)     (arms + records)
   meters, gain, mute, talk/listen/send
```

Key principle: **the helper app owns the audio pipe**. The virtual device is the recording surface. The AU plugin is read/write controls only and never touches the recorded signal path.

---

## Build order

### 1. Helper App (Rust, single binary, menubar app)
- Reuse/extend the existing `native/wstudio-desktop-bridge` Rust crate.
- HTTP server on `127.0.0.1:48000`:
  - `GET /status` → `{ helper:{version}, plugin:{connected,trackName,lastSeenAt}, device:{installed,active,sampleRate} }`
  - `POST /artist-audio/1` → body = raw Float32 PCM @ 48kHz mono (with `Content-Length`, `X-WSTUDIO-Sample-Rate`, `X-WSTUDIO-Channels` headers)
  - `POST /plugin-event` → AU plugin hello / state
- Holds a single ring buffer per artist slot (1 for now).
- Drains ring buffer into the virtual device's IOProc.
- Tray icon: green = browser posting, amber = device installed only, red = device missing.

### 2. Virtual CoreAudio Device
- Build a CoreAudio User-Space driver (DriverKit / AudioServerPlugIn) named **"W.STUDIO Artist Input"**: 1 input channel, 48kHz, 32-bit float.
- Driver exposes a shared memory ring buffer the helper writes into.
- Packaged as `/Library/Audio/Plug-Ins/HAL/WStudio.driver` + installer pkg.
- Logic sees it under Preferences → Audio → Input Device (or as an Aggregate component).

### 3. Browser → Helper wiring (already 90% in place)
- `src/wstudio/bridge/useEngineerBridgeRelay.ts` already POSTs to `127.0.0.1:48000`. Lock it to slot `1`. Send raw `ArrayBuffer` PCM (not JSON) with the headers above — much lower CPU than the current JSON path.
- `HttpHelperTransport` already polls `/status`. Add `device` field to the typed response so the UI can show "Virtual device ready".
- No layout/design changes. Only update the existing status badges' source data.

### 4. AU Plugin reduced to control surface
- Remove `BridgeMicReceiverThread` and `DawAudioSenderThread` from the audio pipe — they stay but **only feed the meters** (no `processBlock` audio output to the DAW track).
- `processBlock` becomes a pass-through (or silence if no upstream) — the plugin is no longer the recording source.
- All UI (`PluginEditor.cpp`) preserved as-is. Buttons send state to helper via `POST /plugin-event` → helper forwards to the web session over its existing channel.
- Plugin advertises itself to helper on load so the green "Plugin connected" badge keeps working.

### 5. Installer + first-run flow
- Single `.pkg` that installs: Helper.app (login item) + WStudio.driver.
- First run: helper checks driver presence; if missing, opens a one-click "Install audio device" sheet (admin prompt).
- W.STUDIO web shows existing "Engineer ready" indicator green only when `/status` reports `device.installed && device.active`.

---

## What changes in this repo (Phase 1)

Web (no design changes, function only):
- `src/wstudio/bridge/useEngineerBridgeRelay.ts` — switch payload to binary PCM, lock slot=1, keep all existing console logs.
- `src/wstudio/audio-engine/helper/HttpHelperTransport.ts` — extend status type with `device`.
- `src/wstudio/audio-engine/helper/types.ts` — add `DeviceStatus`.
- `src/wstudio/session/UnifiedSessionScreen.tsx` — no visual changes; only wire the existing badge to the new `device` field.

Native:
- `native/wstudio-desktop-bridge/` — expand from "play to default output" to "HTTP server + ring buffer + virtual device writer".
- `native/wstudio-coreaudio-driver/` — NEW. AudioServerPlugIn project.
- `native/wstudio-plugin/` — strip audio routing from `processBlock`, keep editor + meters + control messages.
- `scripts/build-wstudio-helper-pkg.sh` — NEW. Builds helper + driver + signed pkg.

No DB, no Supabase, no edge function changes.

---

## Phase 2 (later, not now)
- Multi-artist: virtual device grows to N input channels, helper exposes `/artist-audio/{slot}` for slots 1..12, AU plugin's existing 12-slot mixer becomes meaningful.
- Windows: WASAPI virtual device equivalent.
- DAW return path (engineer → artist headphones) — already partially in `BridgeDawReturn.tsx`.

---

## Open questions before I start coding
1. Driver signing: do you have an Apple Developer ID (required to ship a signed `.driver` so Gatekeeper won't block it)? If not, Phase 1 ships unsigned + a `xattr -dr com.apple.quarantine` step in the README.
2. Helper packaging: menubar app (recommended, stays out of the Dock) vs full window? Default = menubar.
3. AU plugin: confirm you want me to **strip the audio pipe entirely** from `processBlock` in Phase 1. If you'd rather leave it as a fallback when the helper is offline, say so and I'll keep a "plugin-only mode" toggle.

Answer those three and I'll start with the Rust helper + driver scaffolding (no web changes until the native side can actually deliver audio to Logic).
