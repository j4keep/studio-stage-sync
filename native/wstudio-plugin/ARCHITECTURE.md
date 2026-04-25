# W.STUDIO native architecture (target)

## What an AU is *not*

A **single Audio Unit** loaded as an insert **cannot** become a **macOS CoreAudio input device** like BlackHole. Logic does not list AU inserts as **track input sources**. That is why you see **“No input source selected”** when you expect the **artist’s remote vocal** to behave like **Input 1** on an audio track.

The current **WebSocket-in-`processBlock`** path can add audio **inside the insert’s buffer**, but it does **not** fix Logic’s input-arming / monitoring model for “record from the internet as if it were a mic.”

## Target system (three parts)

| Component | Role |
|-----------|------|
| **WStudioPlugin AU** | UI: LIVE, session, monitor/mute/talkback, meters, connection status. **Control surface** and session UX—not a substitute for a hardware input. |
| **W.STUDIO virtual audio device** | **CoreAudio** driver (BlackHole-style). Appears as **e.g. “W.STUDIO Artist Input”** in Logic/macOS. **MVP:** mono artist vocal; later stereo / multiple artists. |
| **W.STUDIO Bridge** | Desktop service/app: receives artist audio from the **web session** (WebRTC path), writes PCM into the **virtual device**. May talk to the AU for status (IPC, local socket, etc.). |

### Intended record path (engineer)

```
Artist mic → browser / WebRTC → engineer Mac (Bridge) → W.STUDIO Artist Input → Logic track INPUT → record arm → bounce/track file
```

The **AU** on the track is optional for **processing, monitoring, and session controls**, not the thing Logic selects as **Input 1** for that recording model.

## Works with *any* engineer interface (not brand-specific)

macOS lets you pick **one CoreAudio device** (or one **aggregate**) for Logic’s **input** and **output** routing. W.STUDIO is **not** tied to Apollo or any single vendor—it must work with **whatever the engineer already uses**: built-in audio, USB/Thunderbolt interfaces (Focusrite, MOTU, Apogee, PreSonus, etc.), or PCIe cards.

**W.STUDIO must not replace** that hardware. It **adds** a virtual input next to it.

**Pattern: Aggregate Device** (same idea BlackHole users already know)

1. **Outputs:** keep using **your existing interface** for **speakers, headphones, and low-latency monitoring** when Logic allows.
2. **Inputs:** create a **macOS Aggregate Device** in **Audio MIDI Setup** that combines:
   - **Your interface’s physical inputs** (engineer mic/line, etc.), and  
   - **W.STUDIO Artist Input** (remote artist from the Bridge).
3. In Logic, select that **aggregate** as the **input device** so one track can use **e.g. input N** = W.STUDIO while other inputs stay your local mics.

**Future:** **W.STUDIO Setup Assistant** — detect the active interface, offer **“W.STUDIO Aggregate”**, align sample rates, suggest drift correction, and surface clear Logic device settings. No assumption about Apollo vs anything else.

## Current repo vs target

- **Today:** AU is aligned with **control surface + meters**; WebSocket PCM into `processBlock` follows **`WSTUDIO_AU_ENABLE_NETWORK_BRIDGE`** from **Projucer / Xcode** (default **`0`** on Debug and Release in `WStudioPlugin.jucer`). The web app’s bridge dropdown defaults to normal outputs; experimental AU routing requires `VITE_WSTUDIO_PLUGIN_WS_BRIDGE=true`.
- **MVP to ship:** **W.STUDIO Desktop Bridge** + **virtual input** (see `native/wstudio-desktop-bridge/README.md`) as signed deliverables—not the AU acting as the main recording pipe.

## References for implementers

- Apple: **Audio Server Plug-In** / **Core Audio Driver** kits (modern driver models; follow current Apple guidance).
- Existing open patterns: **BlackHole**, **Loopback** (product-level reference for “virtual device + app” split).
