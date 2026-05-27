/**
 * /studio Phase 2 — single entry point for HQ audio transport access.
 *
 * UI never imports from `@/wstudio/bridge/*` or hits 127.0.0.1 directly.
 * It calls these hooks, which delegate to whichever transport
 * `getActiveTransport()` currently returns (Localhost bridge today,
 * W.STUDIO Helper App in the future).
 */
import { useMemo } from "react";
import {
  getActiveTransport,
  usePluginConnection,
  type HQAudioTransportAdapter,
  type HQArtistSenderStats,
  type HQEngineerRelayStats,
  type PluginConnectionStatus,
} from "@/wstudio/audio-engine";

export function useStudioTransport(): HQAudioTransportAdapter {
  return useMemo(() => getActiveTransport(), []);
}

export function useStudioPluginStatus(enabled = true): PluginConnectionStatus {
  const transport = useStudioTransport();
  return usePluginConnection(transport, enabled);
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
