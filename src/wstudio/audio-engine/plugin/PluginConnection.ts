/**
 * Plugin Layer — connection status + DAW routing interface facade.
 *
 * Thin abstraction the UI uses to render "plugin connected / live" without
 * knowing which transport delivers the packets. Today it reads from the
 * active HQ transport's plugin poll; tomorrow it can read from the Helper
 * App's structured plugin handshake.
 */

import { useMemo } from "react";

import type { HQAudioTransportAdapter, HQPluginPollState } from "../transports/types";

export type PluginConnectionState = "OFFLINE" | "DETECTED" | "LIVE";

export interface PluginConnectionStatus {
  state: PluginConnectionState;
  /** Most recent peak level reported by the plugin (0..1). */
  level: number;
  /** Last error message, if any. */
  error: string | null;
  /** Transport-specific routing label (e.g. "AU @ 127.0.0.1:47999"). */
  routingLabel: string;
}

export function usePluginConnection(
  transport: HQAudioTransportAdapter,
  enabled: boolean,
): PluginConnectionStatus {
  const poll: HQPluginPollState = transport.usePluginPoll(enabled);
  return useMemo<PluginConnectionStatus>(() => {
    const state: PluginConnectionState = poll.feedActive
      ? "LIVE"
      : poll.connected
        ? "DETECTED"
        : "OFFLINE";
    return {
      state,
      level: poll.level,
      error: poll.error,
      routingLabel: transport.getCapabilities().label,
    };
  }, [poll.feedActive, poll.connected, poll.level, poll.error, transport]);
}
