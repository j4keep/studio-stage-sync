# W.STUDIO Virtual CoreAudio Device (Phase 1)

User-space `AudioServerPlugIn` that registers as **"W.STUDIO Artist Input"** — a 1-input, 48 kHz, 32-bit float, mono CoreAudio device. Any DAW (Logic, Pro Tools, Ableton, Reaper, GarageBand) can arm a track against it and record.

```text
Engineer browser
   POST /artist-audio/1 (raw Float32 PCM)
      ↓
W.STUDIO Helper App (Rust)
   → shm_open("/wstudio_slot1") + mmap + atomic write_index
      ↓
WStudio.driver (this directory)
   → mmaps the same shm
   → DoIOOperation drains samples into the host's input buffer each cycle
      ↓
Logic input bus
```

## Layout

```
wstudio-coreaudio-driver/
  Info.plist                  bundle metadata (HAL plug-in)
  src/
    WStudioShmReader.hpp      header-only POSIX shm reader (matches Rust layout)
    WStudioPlugIn.cpp         full AudioServerPlugIn vtable + property dispatch
  build.sh                    builds build/WStudio.driver
```

## Build & install (Mac, Phase 1 unsigned)

```bash
cd native/wstudio-coreaudio-driver
./build.sh
sudo cp -R build/WStudio.driver /Library/Audio/Plug-Ins/HAL/
sudo xattr -dr com.apple.quarantine /Library/Audio/Plug-Ins/HAL/WStudio.driver
sudo killall coreaudiod
```

Verify:

```bash
# Should list W.STUDIO Artist Input
system_profiler SPAudioDataType | grep -A2 'W.STUDIO'
```

In Logic: **New Audio Track → Input: W.STUDIO Artist Input → arm → record**. With the Helper App running and a W.STUDIO web session active, hitting record captures the remote artist's mic.

## Shared-memory contract

Locked in `WStudioShmReader.hpp` and `native/wstudio-desktop-bridge/src/shm.rs`. **Do not change one side without the other.**

| Field          | Type            | Notes                                  |
| -------------- | --------------- | -------------------------------------- |
| `magic`        | `u32`           | `0x57535431` ("WST1")                  |
| `version`      | `u32`           | `1`                                    |
| `sample_rate`  | `u32`           | helper updates per write               |
| `channels`     | `u32`           | always `1` post-helper-downmix         |
| `ring_samples` | `u32`           | `48000` (1 s mono)                     |
| `_pad`         | `u32`           | reserved                               |
| `write_index`  | `atomic u64`    | helper-owned, monotonic                |
| `read_index`   | `atomic u64`    | driver-owned, monotonic                |
| samples        | `f32[]`         | `ring_samples` floats follow header    |

SPSC. No locks. Overflow strategy: helper advances `read_index` forward on full ring — DAW records silence instead of producer stalling.

## Phase 1 limits

- Single device, single input stream, single slot.
- Format locked to 48 kHz / Float32 / mono.
- Unsigned bundle: Gatekeeper requires the `xattr` quarantine strip on first install.

Phase 2 will add multi-slot input streams (up to 12 artists), stereo, signing + notarization.
