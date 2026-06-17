# W.STUDIO Audio Engine (Phase 1 — Architecture Cleanup)

This folder introduces the **HQ Audio Layer** abstraction without removing
or breaking the current working bridge. Nothing in `src/wstudio/bridge/*`
or `src/wstudio/session/*` is modified by Phase 1 — those continue to
power the live engineer/artist flow.

## Layer map

```
UI Layer            src/wstudio/session/*, video, chat, controls
Session Layer       src/wstudio/session/SessionContext, sessionDb
HQ Audio Layer      src/wstudio/audio-engine/*           ← NEW
Plugin Layer        src/wstudio/audio-engine/plugin/*    ← NEW (status/routing facade)
Bridge Layer        src/wstudio/audio-engine/transports/LocalhostBridgeAdapter
                    (wraps existing useEngineerBridgeRelay / useArtistBridgePost
                     and the 127.0.0.1:47999 JUCE AU server — temporary)
Future              src/wstudio/audio-engine/transports/WStudioHelperAdapter
                    (stub — desktop Helper App transport)
```

## Contract

Every transport implements `HQAudioTransportAdapter` (see `transports/types.ts`):

- `id` — stable identifier ("localhost-bridge" | "wstudio-helper" | ...)
- `useEngineerRelay(remoteStream, slot, enabled)` → unified stats
- `useArtistSender(stream, target, slot, enabled)` → unified stats
- `usePluginPoll(enabled)` → connection + level
- `getCapabilities()` — what this transport supports

The UI must talk to a transport **only through this interface**, never
import `bridge/*` directly. That is what allows swapping transports later
without rewriting the session room.

## Migration plan (not done yet — Phase 2+)

1. Switch `EngineerSessionScreen` / `ArtistSessionScreen` to consume
   `useHQAudioTransport()` from `audio-engine/index.ts`.
2. Implement `WStudioHelperAdapter` against the desktop Helper App.
3. Delete the direct `bridge/*` imports from UI components.
4. Retire `LocalhostBridgeAdapter` once Helper App is the default.
