/**
 * W.STUDIO Helper App — Transport contract.
 *
 * Formal API surface for the future Mac (and eventually Windows) Helper App
 * that will replace the temporary LocalhostBridgeAdapter. This file defines
 * ONLY the contract + types. No native code, no IPC, no localhost calls.
 *
 * UI code must depend on `HelperTransport` (this file) and never reach into
 * a concrete adapter implementation.
 */

export type HelperTransportState =
  | "NOT_INSTALLED"
  | "NOT_RUNNING"
  | "CONNECTING"
  | "CONNECTED"
  | "ERROR";

export interface HelperStatus {
  state: HelperTransportState;
  /** Helper App reported version, when known. */
  version: string | null;
  /** Human-readable error, populated only when state === "ERROR". */
  error: string | null;
  /** Epoch ms of the last successful status update. */
  lastSeenAt: number | null;
}

export interface PluginState {
  /** True when the DAW-side plugin has handshaked with the helper. */
  connected: boolean;
  /** True when the plugin is actively pushing return audio frames. */
  feedActive: boolean;
  /** Plugin-reported name (DAW track / channel label), when known. */
  trackName: string | null;
}

export interface ArtistLevelFrame {
  /** Normalized peak (0..1). */
  peak: number;
  /** Normalized RMS (0..1). */
  rms: number;
  /** Frame timestamp (epoch ms). */
  at: number;
}

export interface DawReturnFrame {
  /** Normalized peak (0..1) for the DAW return bus. */
  peak: number;
  /** Frame timestamp (epoch ms). */
  at: number;
}

export interface LatencyReport {
  /** Round-trip latency in milliseconds. */
  roundTripMs: number;
  /** One-way mic→DAW estimate in milliseconds. */
  micToDawMs: number;
  /** One-way DAW→artist estimate in milliseconds. */
  dawToArtistMs: number;
  /** Confidence 0..1; mocks always return a fixed value. */
  confidence: number;
}

export type Unsubscribe = () => void;

/**
 * Helper Transport public contract.
 *
 * All methods are non-blocking; subscriptions return an Unsubscribe handle.
 * Implementations MUST be safe to call before connect() — they should report
 * a sensible state (typically NOT_INSTALLED / NOT_RUNNING) rather than throw.
 */
export interface HelperTransport {
  readonly id: "wstudio-helper" | "wstudio-helper-mock" | "localhost-bridge-compat";
  readonly label: string;

  /* Lifecycle */
  connect(): Promise<HelperStatus>;
  disconnect(): Promise<void>;
  getStatus(): HelperStatus;

  /* One-shot diagnostics */
  startMicTest(): Promise<void>;
  startHeadphoneTest(): Promise<void>;
  startBeatPlayback(): Promise<void>;
  startLatencyCheck(): Promise<LatencyReport>;

  /* Subscriptions */
  subscribeToPluginState(cb: (s: PluginState) => void): Unsubscribe;
  subscribeToArtistLevel(cb: (f: ArtistLevelFrame) => void): Unsubscribe;
  subscribeToDawReturn(cb: (f: DawReturnFrame) => void): Unsubscribe;
  subscribeToHelperStatus(cb: (s: HelperStatus) => void): Unsubscribe;
}
