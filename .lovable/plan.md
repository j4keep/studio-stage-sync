# W.STUDIO Phase 1 — Mac Recording Pipe

Goal: Engineer can arm a Logic track on **"W.STUDIO Artist Input"** and record the artist's live mic in real time. No W.STUDIO web UI redesign.

## Architecture

```text
Artist browser (mic)
  → WebRTC over existing session
    → Engineer browser (W.STUDIO web)
      → POST http://127.0.0.1:48000/artist-audio/1  (raw Float32 PCM)
        → Helper App (menubar, Rust)
          → Shared ring buffer
            → Virtual CoreAudio Device "W.STUDIO Artist Input"
              → Logic / any DAW

AU Plugin  ⇄  Helper /plugin-event   (control surface only: meters, gain, mute, send/receive/talk)
```

The helper app owns the audio pipe. The virtual device is the recording surface in the DAW. The AU plugin does not carry audio in Phase 1 (hidden dev fallback preserved).

## Decisions locked in

1. **Unsigned for Phase 1.** Ship `.pkg` unsigned. README includes `xattr -dr com.apple.quarantine` + System Settings → Privacy unblock step. Sign + notarize later when Developer ID is ready.
2. **Menubar helper.** Tray icon only, no Dock, no main window. Click → small popover with status (Connected / Device installed / Slot 1 level meter / Quit).
3. **AU plugin = control surface.** `processBlock()` becomes silent pass-through by default. Old `BridgeMicReceiverThread` / `DawAudioSenderThread` kept behind a hidden `kPluginOnlyFallback` flag (off by default, toggled via a dev-only key combo in the plugin UI). All meters/gain/mute/send/receive/talk buttons stay and talk to helper via `/plugin-event`.

## Build order

### 1. Helper App (`native/wstudio-desktop-bridge/`, Rust)
- Switch port → **48000**.
- Endpoints:
  - `GET  /status` → `{ ok, device_installed, slot_1: { connected, level, packets, failed } }`
  - `POST /artist-audio/1` → headers `X-Sample-Rate`, `X-Channels`, body = raw Float32 PCM ArrayBuffer. Writes into ring buffer for slot 1.
  - `POST /plugin-event` → JSON `{ type, slot, value }` for gain/mute/talk.
- Ring buffer: lock-free SPSC, ~500ms, 48kHz/32-bit float, mono Phase 1.
- macOS menubar shell via `tao` + `tray-icon` crates. States: gray (no device), blue (device ok, no audio), green (receiving).
- Launches at login via LaunchAgent plist installed by pkg.

### 2. Virtual CoreAudio Device (`native/wstudio-coreaudio-driver/`, C++)
- AudioServerPlugIn bundle: `WStudio.driver`.
- Identity: name **"W.STUDIO Artist Input"**, 1 input stream, 48kHz, 32-bit float, mono (stereo later).
- Shared memory ring buffer with helper via POSIX shm `/wstudio_slot1`.
- Installs to `/Library/Audio/Plug-Ins/HAL/WStudio.driver`. Requires `sudo killall coreaudiod` once after install (handled by postinstall script).

### 3. Browser → Helper wiring (web, function-only)
- `src/wstudio/audio-engine/helper/HttpHelperTransport.ts` — base URL → `http://127.0.0.1:48000`. Extend `/status` parsing with `device_installed`.
- `src/wstudio/bridge/useEngineerBridgeRelay.ts` — already POSTs PCM; lock `slot=1`, send raw `ArrayBuffer` with `X-Sample-Rate: 48000`, `X-Channels: 1`. Increment `packetsSent` only on 2xx, `failed` on error. Logs: `ENGINEER_RECEIVED_ARTIST_AUDIO`, `ENGINEER_POSTED_TO_HELPER_OK`, `ENGINEER_POSTED_TO_HELPER_FAIL`, `HELPER_STATUS`.
- `src/wstudio/media/StudioMediaContext.tsx` — artist side: confirm mic stream + logs `ARTIST_MIC_STARTED`, `ARTIST_MIC_LEVEL`, `ARTIST_AUDIO_SENT_TO_ENGINEER`.
- `src/wstudio/session/UnifiedSessionScreen.tsx` — "Connected" indicator = helper `/status.ok` AND session WebRTC connected AND `device_installed`. Add tiny "Install Helper" CTA when helper unreachable (links to downloaded pkg). **No layout/color/label changes elsewhere.**

### 4. AU plugin reduced (`native/wstudio-plugin/`)
- `processBlock()` → output silence by default, no network/audio threads in path.
- Old receiver/sender threads gated behind `kPluginOnlyFallback` static flag (default false).
- Add `/plugin-event` POSTs for gain/mute/talk button changes (non-audio control).
- UI untouched.

### 5. Installer (`scripts/build-wstudio-helper-pkg.sh`)
- Single `.pkg`: `WStudioHelper.app` → `/Applications`, `WStudio.driver` → `/Library/Audio/Plug-Ins/HAL/`, LaunchAgent plist → `~/Library/LaunchAgents/`.
- Postinstall: `launchctl load` helper, `killall coreaudiod`.
- README: unsigned install steps + "Open Logic → New Audio Track → Input: W.STUDIO Artist Input".

## What does NOT change in Phase 1
- W.STUDIO web design, layout, colors, buttons, labels.
- Session join/connect screen.
- AU plugin UI.
- Supabase schema.

## Phase 2 (later, not now)
- Multi-artist slots (up to 12), stereo, DAW return path, Windows WASAPI, code signing + notarization.

## Open execution note
This plan involves substantial native code (Rust helper + C++ CoreAudio driver). I will scaffold the directory structure, Rust helper crate, and driver project in this repo, plus wire the web side. Building the actual `.pkg` requires running the build script on a Mac with Xcode — I'll include the script and exact instructions; the artifacts cannot be produced inside this sandbox.
