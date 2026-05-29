/**
 * Plugin Transport contract.
 *
 * Defines the formal API that /studio (and future surfaces) use to talk to
 * the W.STUDIO DAW plugin (AU/VST/AAX). This file contains ONLY the
 * interface + types. No JUCE, no native code, no localhost, no IPC.
 *
 * UI must depend on `PluginTransport` and never reach into a concrete
 * implementation. Swap the active transport via `getActivePluginTransport()`
 * in ./registry.ts.
 */

export type PluginTransportState =
  | "OFFLINE"
  | "CONNECTING"
  | "CONNECTED"
  | "ERROR";

export interface PluginConnectionInfo {
  state: PluginTransportState;
  /** Plugin-reported version (e.g. "1.0.3"), when known. */
  version: string | null;
  /** DAW name reported by the plugin host, when known. */
  daw: string | null;
  /** Last error, populated only when state === "ERROR". */
  error: string | null;
  /** Epoch ms of last successful status update. */
  lastSeenAt: number | null;
}

export interface PluginMetersFrame {
  /** Input bus peak 0..1 (artist audio reaching the plugin). */
  inputPeak: number;
  /** Output bus peak 0..1 (DAW return going back to artist). */
  outputPeak: number;
  /** Talkback bus peak 0..1, or 0 when talkback is idle. */
  talkbackPeak: number;
  /** Frame timestamp (epoch ms). */
  at: number;
}

export interface PluginErrorEvent {
  code: string;
  message: string;
  /** True when the transport considers the error fatal (state → ERROR). */
  fatal: boolean;
  at: number;
}

export interface PluginControlState {
  /** Mic is "live" into the DAW. */
  live: boolean;
  /** Artist mic muted at the plugin. */
  mute: boolean;
  /** Artist hears the DAW monitor return. */
  monitor: boolean;
  /** Engineer talkback engaged. */
  talk: boolean;
  /** Which artist slot is currently selected at the plugin (id or null). */
  selectedArtist: string | null;
  /** Plugin input gain in dB (-60..+12 typical). */
  gain: number;
}

export type Unsubscribe = () => void;

/**
 * Plugin Transport public contract.
 *
 * - All methods are non-blocking.
 * - Subscriptions return an Unsubscribe handle and may emit a current
 *   snapshot synchronously after subscribe (via microtask).
 * - Send methods are safe to call when OFFLINE; they should buffer or
 *   no-op and surface the failure via subscribePluginErrors.
 */
export interface PluginTransport {
  readonly id:
    | "plugin-mock"
    | "plugin-helper"
    | "plugin-localhost-bridge-compat";
  readonly label: string;

  /* Lifecycle */
  connect(): Promise<PluginConnectionInfo>;
  disconnect(): Promise<void>;

  /* Audio streams (engineer → plugin → DAW) */
  sendArtistAudio(stream: MediaStream | null): Promise<void>;
  sendTalkback(stream: MediaStream | null): Promise<void>;
  sendBeatPlayback(stream: MediaStream | null): Promise<void>;

  /* Control surface (engineer UI → plugin) */
  sendControlState(state: PluginControlState): Promise<void>;

  /* Subscriptions (plugin → UI) */
  subscribePluginMeters(cb: (f: PluginMetersFrame) => void): Unsubscribe;
  subscribePluginConnection(cb: (s: PluginConnectionInfo) => void): Unsubscribe;
  subscribePluginErrors(cb: (e: PluginErrorEvent) => void): Unsubscribe;
}
