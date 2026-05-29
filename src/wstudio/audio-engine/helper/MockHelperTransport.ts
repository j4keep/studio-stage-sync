/**
 * MockHelperTransport — pure in-memory implementation of HelperTransport.
 *
 * Used everywhere until the real W.STUDIO Helper App ships. No native code,
 * no IPC, no localhost. Safe for tests, Storybook, and the /studio prototype.
 */

import type {
  ArtistLevelFrame,
  DawReturnFrame,
  HelperStatus,
  HelperTransport,
  HelperTransportState,
  LatencyReport,
  PluginState,
  Unsubscribe,
} from "./types";

type StatusCb = (s: HelperStatus) => void;
type PluginCb = (s: PluginState) => void;
type LevelCb = (f: ArtistLevelFrame) => void;
type ReturnCb = (f: DawReturnFrame) => void;

function makeBus<T>() {
  const subs = new Set<(v: T) => void>();
  return {
    subscribe(cb: (v: T) => void): Unsubscribe {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    emit(v: T) {
      subs.forEach((cb) => {
        try { cb(v); } catch { /* ignore subscriber error */ }
      });
    },
    clear() { subs.clear(); },
  };
}

export class MockHelperTransport implements HelperTransport {
  readonly id = "wstudio-helper-mock" as const;
  readonly label = "W.STUDIO Helper (Mock)";

  private status: HelperStatus = {
    state: "NOT_INSTALLED",
    version: null,
    error: null,
    lastSeenAt: null,
  };
  private plugin: PluginState = { connected: false, feedActive: false, trackName: null };

  private statusBus = makeBus<HelperStatus>();
  private pluginBus = makeBus<PluginState>();
  private levelBus = makeBus<ArtistLevelFrame>();
  private returnBus = makeBus<DawReturnFrame>();

  private connectTimer: ReturnType<typeof setTimeout> | null = null;

  private setStatus(patch: Partial<HelperStatus>) {
    this.status = { ...this.status, ...patch, lastSeenAt: Date.now() };
    this.statusBus.emit(this.status);
  }

  private setPlugin(patch: Partial<PluginState>) {
    this.plugin = { ...this.plugin, ...patch };
    this.pluginBus.emit(this.plugin);
  }

  /* ---------- Lifecycle ---------- */

  async connect(): Promise<HelperStatus> {
    if (this.status.state === "CONNECTED") return this.status;
    this.setStatus({ state: "CONNECTING", error: null });
    // Mock never finds a real helper → resolve to NOT_INSTALLED after a short delay.
    await new Promise<void>((resolve) => {
      this.connectTimer = setTimeout(resolve, 600);
    });
    this.setStatus({
      state: "NOT_INSTALLED",
      error: "Helper App is not installed on this system (mock).",
    });
    return this.status;
  }

  async disconnect(): Promise<void> {
    if (this.connectTimer) { clearTimeout(this.connectTimer); this.connectTimer = null; }
    this.setStatus({ state: "NOT_RUNNING", error: null });
    this.setPlugin({ connected: false, feedActive: false, trackName: null });
  }

  getStatus(): HelperStatus {
    return this.status;
  }

  /* ---------- One-shot diagnostics ---------- */

  async startMicTest(): Promise<void> {
    this.emitMockLevels(1500);
  }

  async startHeadphoneTest(): Promise<void> {
    this.emitMockReturn(1500);
  }

  async startBeatPlayback(): Promise<void> {
    this.emitMockReturn(3000);
  }

  async startLatencyCheck(): Promise<LatencyReport> {
    return {
      roundTripMs: 42,
      micToDawMs: 18,
      dawToArtistMs: 24,
      confidence: 0.0,
    };
  }

  /* ---------- Subscriptions ---------- */

  subscribeToHelperStatus(cb: StatusCb): Unsubscribe {
    // Emit current snapshot immediately so consumers don't wait for the next tick.
    queueMicrotask(() => cb(this.status));
    return this.statusBus.subscribe(cb);
  }

  subscribeToPluginState(cb: PluginCb): Unsubscribe {
    queueMicrotask(() => cb(this.plugin));
    return this.pluginBus.subscribe(cb);
  }

  subscribeToArtistLevel(cb: LevelCb): Unsubscribe {
    return this.levelBus.subscribe(cb);
  }

  subscribeToDawReturn(cb: ReturnCb): Unsubscribe {
    return this.returnBus.subscribe(cb);
  }

  /* ---------- Internal helpers ---------- */

  private emitMockLevels(durationMs: number) {
    const start = Date.now();
    const tick = () => {
      const t = Date.now() - start;
      if (t >= durationMs) return;
      const peak = 0.2 + Math.random() * 0.6;
      this.levelBus.emit({ peak, rms: peak * 0.7, at: Date.now() });
      setTimeout(tick, 60);
    };
    tick();
  }

  private emitMockReturn(durationMs: number) {
    const start = Date.now();
    const tick = () => {
      const t = Date.now() - start;
      if (t >= durationMs) return;
      this.returnBus.emit({ peak: 0.3 + Math.random() * 0.5, at: Date.now() });
      setTimeout(tick, 60);
    };
    tick();
  }
}

export const __testing = { makeBus };
export type { HelperTransportState };
