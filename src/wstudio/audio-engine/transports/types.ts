/**
 * HQ Audio Transport contract.
 *
 * The Audio Engine layer talks to transports (LocalhostBridge, WStudioHelper,
 * future cloud relay, etc.) through this single interface. UI components
 * must never reach into a specific transport implementation.
 */

export type HQTransportState = "DISCONNECTED" | "CONNECTING" | "CONNECTED";

export type HQTransportId = "localhost-bridge" | "wstudio-helper" | "noop";

export interface HQTransportCapabilities {
  /** True when the transport can publish artist mic → engineer DAW. */
  artistSend: boolean;
  /** True when the transport can publish remote stream → local DAW plugin. */
  engineerRelay: boolean;
  /** True when the transport can poll the DAW plugin for return audio. */
  pluginPoll: boolean;
  /** True when the transport requires the LAN/loopback bridge to be reachable. */
  requiresLocalBridge: boolean;
  /** Human-friendly label for the transport (UI status badges). */
  label: string;
}

export interface HQEngineerRelayStats {
  enabled: boolean;
  targetUrl: string;
  remoteLevel: number;
  packetsPosted: number;
  packetsFailed: number;
  packetsDropped: number;
  lastStatus: string | null;
  lastError: string | null;
  state: HQTransportState;
  sending: boolean;
  hasRemoteAudio: boolean;
}

export interface HQArtistSenderStats {
  enabled: boolean;
  targetUrl: string;
  level: number;
  packetsPosted: number;
  packetsFailed: number;
  packetsDropped: number;
  lastStatus: string | null;
  lastError: string | null;
  state: HQTransportState;
  sending: boolean;
}

export interface HQPluginPollState {
  connected: boolean;
  feedActive: boolean;
  level: number;
  lastOkAt: number | null;
  error: string | null;
}

export interface HQAudioTransportAdapter {
  readonly id: HQTransportId;
  getCapabilities(): HQTransportCapabilities;

  /** Engineer side: relay remote artist stream into the local DAW plugin. */
  useEngineerRelay(
    remoteStream: MediaStream | null,
    slot: number,
    enabled: boolean,
  ): HQEngineerRelayStats;

  /** Artist side: send local mic to engineer's bridge. */
  useArtistSender(
    stream: MediaStream | null,
    target: string,
    slot: number,
    enabled: boolean,
  ): HQArtistSenderStats;

  /** Engineer side: poll the DAW plugin for return / monitoring audio. */
  usePluginPoll(enabled: boolean): HQPluginPollState;
}
