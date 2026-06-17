/**
 * LocalhostBridgeAdapter — Phase 1 compatibility transport.
 *
 * Wraps the existing 127.0.0.1:47999 JUCE AU bridge hooks behind the
 * HQAudioTransportAdapter interface so UI can be migrated off direct
 * `bridge/*` imports without behavior changes.
 *
 * This adapter owns:
 *   - 127.0.0.1 / LAN-IP communication
 *   - packet send/receive
 *   - plugin packet polling
 *   - bridge status surfacing
 *   - retry/reconnect (delegated to the underlying hooks)
 *
 * It deliberately does not re-implement the transport; it simply re-exports
 * the proven hooks under the new contract so we can swap in a different
 * adapter (e.g. WStudioHelperAdapter) later without touching the UI.
 */

import { useEngineerBridgeRelay } from "@/wstudio/bridge/useEngineerBridgeRelay";
import { useArtistBridgePost } from "@/wstudio/bridge/useArtistBridgePost";
import { useLocalBridgePoll } from "@/wstudio/bridge/useLocalBridgePoll";

import type {
  HQArtistSenderStats,
  HQAudioTransportAdapter,
  HQEngineerRelayStats,
  HQPluginPollState,
  HQTransportCapabilities,
} from "./types";

const CAPS: HQTransportCapabilities = {
  artistSend: true,
  engineerRelay: true,
  pluginPoll: true,
  requiresLocalBridge: true,
  label: "Localhost Bridge (JUCE AU 127.0.0.1:47999)",
};

export const LocalhostBridgeAdapter: HQAudioTransportAdapter = {
  id: "localhost-bridge",
  getCapabilities: () => CAPS,

  useEngineerRelay(remoteStream, slot, enabled): HQEngineerRelayStats {
    const s = useEngineerBridgeRelay(remoteStream, slot, enabled);
    return {
      enabled: s.enabled,
      targetUrl: s.targetUrl,
      remoteLevel: s.remoteLevel,
      packetsPosted: s.packetsPosted,
      packetsFailed: s.packetsFailed,
      packetsDropped: s.packetsDropped,
      lastStatus: s.lastStatus,
      lastError: s.lastError,
      state: s.state,
      sending: s.sending,
      hasRemoteAudio: s.hasRemoteAudio,
    };
  },

  useArtistSender(stream, target, slot, enabled): HQArtistSenderStats {
    const s = useArtistBridgePost(stream, target, slot, enabled);
    return {
      enabled: s.enabled,
      targetUrl: s.targetUrl,
      level: s.level,
      packetsPosted: s.packetsPosted,
      packetsFailed: s.packetsFailed,
      packetsDropped: s.packetsDropped,
      lastStatus: s.lastStatus,
      lastError: s.lastError,
      state: s.state,
      sending: s.sending,
    };
  },

  usePluginPoll(enabled): HQPluginPollState {
    const s = useLocalBridgePoll(enabled);
    return {
      connected: s.connected,
      feedActive: s.feedActive,
      level: s.level,
      lastOkAt: s.lastOkAt,
      error: s.error,
    };
  },
};
