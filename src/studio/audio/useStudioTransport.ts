/**
 * /studio Phase 2 — single entry point for HQ audio transport access.
 *
 * Plugin status reads EXCLUSIVELY from the W.STUDIO Helper App
 * (http://127.0.0.1:48000/status). The legacy localhost-bridge (47999)
 * is no longer consulted from /studio — it stays available under
 * /wstudio for backward compatibility only.
 */
import { useEffect, useMemo, useState } from "react";
import {
  getActiveTransport,
  type HQAudioTransportAdapter,
  type HQArtistSenderStats,
  type HQEngineerRelayStats,
  type PluginConnectionStatus,
} from "@/wstudio/audio-engine";
import {
  getActiveHelperTransport,
  type HelperStatus,
  type PluginState,
} from "@/wstudio/audio-engine/helper";

export function useStudioTransport(): HQAudioTransportAdapter {
  return useMemo(() => getActiveTransport(), []);
}

/**
 * Plugin status driven entirely by the W.STUDIO Helper App.
 *
 *   state = LIVE      when helper /status reports plugin.connected === true
 *                     AND a PLUGIN_STATE/HELLO event is fresh (<5s)
 *   state = DETECTED  when plugin.connected === true but no recent feed
 *   state = OFFLINE   otherwise (helper unreachable OR no plugin)
 */
export function useStudioPluginStatus(_enabled = true): PluginConnectionStatus {
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
    const routing = `${helper.label}${plugin.trackName ? ` · ${plugin.trackName}` : ""}`;
    if (plugin.connected) {
      return {
        state: plugin.feedActive ? "LIVE" : "DETECTED",
        level: 0,
        error: null,
        routingLabel: routing,
      };
    }
    if (helperStatus.state === "CONNECTED") {
      return {
        state: "OFFLINE",
        level: 0,
        error: "Helper online — waiting for plugin",
        routingLabel: helper.label,
      };
    }
    return {
      state: "OFFLINE",
      level: 0,
      error: helperStatus.error ?? "Helper App not reachable on 127.0.0.1:48000",
      routingLabel: helper.label,
    };
  }, [plugin, helperStatus, helper]);
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
