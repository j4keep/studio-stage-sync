/**
 * WStudioHelperAdapter — stub for the upcoming desktop Helper App transport.
 *
 * Phase 1 ships only the contract surface so UI/Session code can already be
 * written against the transport interface. Implementation lands when the
 * Helper App IPC channel (WebSocket / native messaging / loopback PCM) is
 * finalized.
 *
 * Until then, this adapter advertises its capabilities but reports a
 * DISCONNECTED state from every hook. It MUST NOT be selected as the
 * active transport at runtime yet.
 */

import { useEffect, useState } from "react";

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
  requiresLocalBridge: false,
  label: "W.STUDIO Helper App (planned)",
};

const idleEngineer = (enabled: boolean): HQEngineerRelayStats => ({
  enabled,
  targetUrl: "wstudio-helper://relay",
  remoteLevel: 0,
  packetsPosted: 0,
  packetsFailed: 0,
  packetsDropped: 0,
  lastStatus: null,
  lastError: "WStudioHelperAdapter not implemented yet",
  state: "DISCONNECTED",
  sending: false,
  hasRemoteAudio: false,
});

const idleArtist = (enabled: boolean): HQArtistSenderStats => ({
  enabled,
  targetUrl: "wstudio-helper://artist",
  level: 0,
  packetsPosted: 0,
  packetsFailed: 0,
  packetsDropped: 0,
  lastStatus: null,
  lastError: "WStudioHelperAdapter not implemented yet",
  state: "DISCONNECTED",
  sending: false,
});

const idlePlugin = (): HQPluginPollState => ({
  connected: false,
  feedActive: false,
  level: 0,
  lastOkAt: null,
  error: "WStudioHelperAdapter not implemented yet",
});

export const WStudioHelperAdapter: HQAudioTransportAdapter = {
  id: "wstudio-helper",
  getCapabilities: () => CAPS,

  useEngineerRelay(_remoteStream, _slot, enabled) {
    const [s] = useState(() => idleEngineer(enabled));
    useEffect(() => {
      /* future: open Helper App channel */
    }, [enabled]);
    return s;
  },

  useArtistSender(_stream, _target, _slot, enabled) {
    const [s] = useState(() => idleArtist(enabled));
    return s;
  },

  usePluginPoll(_enabled) {
    const [s] = useState(() => idlePlugin());
    return s;
  },
};
