/**
 * W.STUDIO Audio Engine — public entry point.
 *
 * UI / Session code imports ONLY from this module:
 *
 *     import { getActiveTransport, usePluginConnection } from "@/wstudio/audio-engine";
 *
 * Do not import from `@/wstudio/bridge/*` in new code. The bridge folder is
 * the temporary backing implementation for `LocalhostBridgeAdapter`.
 */

import { LocalhostBridgeAdapter } from "./transports/LocalhostBridgeAdapter";
import { WStudioHelperAdapter } from "./transports/WStudioHelperAdapter";
import type { HQAudioTransportAdapter, HQTransportId } from "./transports/types";

export * from "./transports/types";
export { LocalhostBridgeAdapter, WStudioHelperAdapter };
export { usePluginConnection } from "./plugin/PluginConnection";
export type {
  PluginConnectionState,
  PluginConnectionStatus,
} from "./plugin/PluginConnection";

const REGISTRY: Record<HQTransportId, HQAudioTransportAdapter | null> = {
  "localhost-bridge": LocalhostBridgeAdapter,
  "wstudio-helper": WStudioHelperAdapter,
  noop: null,
};

/**
 * Active transport selector.
 *
 * Phase 1 returns the LocalhostBridgeAdapter unconditionally so the live
 * 127.0.0.1 flow keeps working. When the Helper App ships, swap this to
 * read from a user/session preference (or feature flag) without changing
 * any UI call sites.
 */
export function getActiveTransport(): HQAudioTransportAdapter {
  return LocalhostBridgeAdapter;
}

export function getTransport(id: HQTransportId): HQAudioTransportAdapter | null {
  return REGISTRY[id] ?? null;
}
