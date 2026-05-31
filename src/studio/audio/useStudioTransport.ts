/**
 * /studio Phase 2 — single entry point for HQ audio transport access.
 *
 * UI never imports from `@/wstudio/bridge/*` or hits 127.0.0.1 directly.
 * It calls these hooks, which delegate to whichever transport
 * `getActiveTransport()` currently returns (Localhost bridge today,
 * W.STUDIO Helper App in the future).
 */
import { useEffect, useMemo, useState } from "react";
import {
  getActiveTransport,
  type HQAudioTransportAdapter,
  type HQArtistSenderStats,
  type HQEngineerRelayStats,
  type PluginConnectionStatus,
} from "@/wstudio/audio-engine";
import { usePluginConnection } from "@/wstudio/audio-engine";
import {
  getActiveHelperTransport,
  type HelperStatus,
  type PluginState,
} from "@/wstudio/audio-engine/helper";

export function useStudioTransport(): HQAudioTransportAdapter {
  return useMemo(() => getActiveTransport(), []);
}

/**
 * Plugin status driven primarily by the W.STUDIO Helper App's plugin events.
 * Falls back to the legacy localhost-bridge poll when the helper has not
 * reported a recent plugin event.
 */
export function useStudioPluginStatus(enabled = true): PluginConnectionStatus {
  const transport = useStudioTransport();
  const bridge = usePluginConnection(transport, enabled);

  const helper = useMemo(() => getActiveHelperTransport(), []);
  const [helperStatus, setHelperStatus] = useState<HelperStatus>(() => helper.getStatus());
  const [plugin, setPlugin] = useState<PluginState>({
    connected: false, feedActive: false, trackName: null,
  });

  useEffect(() => {
    const offS = helper.subscribeToHelperStatus(setHelperStatus);
    const offP = helper.subscribeToPluginState(setPlugin);
    return () => { offS(); offP(); };
  }, [helper]);

  return useMemo<PluginConnectionStatus>(() => {
    // Helper-reported plugin state wins when present.
    if (plugin.connected) {
      return {
        state: plugin.feedActive ? "LIVE" : "DETECTED",
        level: bridge.level,
        error: null,
        routingLabel: `${helper.label}${plugin.trackName ? ` · ${plugin.trackName}` : ""}`,
      };
    }
    // Helper reachable but no plugin yet → surface that explicitly.
    if (helperStatus.state === "CONNECTED") {
      return {
        state: "OFFLINE",
        level: bridge.level,
        error: "Helper online — waiting for plugin",
        routingLabel: helper.label,
      };
    }
    // Helper unreachable → fall back to legacy localhost-bridge poll.
    return bridge;
  }, [plugin, helperStatus.state, helper, bridge]);
}

export function useStudioEngineerRelay(
  remoteStream: MediaStream | null,
  slot: number,
  enabled: boolean,
): HQEngineerRelayStats {
  const transport = useStudioTransport();
  return transport.useEngineerRelay(remoteStream, slot, enabled);
}

export function useStudioArtistSender(
  stream: MediaStream | null,
  target: string,
  slot: number,
  enabled: boolean,
): HQArtistSenderStats {
  const transport = useStudioTransport();
  return transport.useArtistSender(stream, target, slot, enabled);
}
