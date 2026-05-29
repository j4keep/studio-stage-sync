/**
 * MockPluginTransport — pure in-memory implementation of PluginTransport.
 *
 * Used everywhere until the real DAW plugin transport ships.
 * No JUCE, no native code, no localhost, no bridge.
 */

import type {
  PluginConnectionInfo,
  PluginControlState,
  PluginErrorEvent,
  PluginMetersFrame,
  PluginTransport,
  Unsubscribe,
} from "./types";

type Cb<T> = (v: T) => void;

function makeBus<T>() {
  const subs = new Set<Cb<T>>();
  return {
    subscribe(cb: Cb<T>): Unsubscribe {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    emit(v: T) {
      subs.forEach((cb) => {
        try { cb(v); } catch { /* ignore subscriber error */ }
      });
    },
  };
}

export class MockPluginTransport implements PluginTransport {
  readonly id = "plugin-mock" as const;
  readonly label = "DAW Plugin (Mock)";

  private info: PluginConnectionInfo = {
    state: "OFFLINE",
    version: null,
    daw: null,
    error: null,
    lastSeenAt: null,
  };

  private control: PluginControlState = {
    live: false,
    mute: false,
    monitor: true,
    talk: false,
    selectedArtist: null,
    gain: 0,
  };

  private connBus = makeBus<PluginConnectionInfo>();
  private metersBus = makeBus<PluginMetersFrame>();
  private errorsBus = makeBus<PluginErrorEvent>();

  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private metersTimer: ReturnType<typeof setInterval> | null = null;

  /* ---------- internal ---------- */

  private setInfo(patch: Partial<PluginConnectionInfo>) {
    this.info = { ...this.info, ...patch, lastSeenAt: Date.now() };
    this.connBus.emit(this.info);
  }

  private startMetersLoop() {
    if (this.metersTimer) return;
    this.metersTimer = setInterval(() => {
      this.metersBus.emit({
        inputPeak: this.control.live && !this.control.mute ? Math.random() * 0.8 : 0,
        outputPeak: this.control.monitor ? 0.2 + Math.random() * 0.5 : 0,
        talkbackPeak: this.control.talk ? 0.3 + Math.random() * 0.4 : 0,
        at: Date.now(),
      });
    }, 80);
  }

  private stopMetersLoop() {
    if (this.metersTimer) { clearInterval(this.metersTimer); this.metersTimer = null; }
  }

  /* ---------- lifecycle ---------- */

  async connect(): Promise<PluginConnectionInfo> {
    if (this.info.state === "CONNECTED") return this.info;
    this.setInfo({ state: "CONNECTING", error: null });
    await new Promise<void>((resolve) => {
      this.connectTimer = setTimeout(resolve, 500);
    });
    // Mock pretends a plugin handshake succeeded.
    this.setInfo({
      state: "CONNECTED",
      version: "0.0.0-mock",
      daw: "Mock DAW",
      error: null,
    });
    this.startMetersLoop();
    return this.info;
  }

  async disconnect(): Promise<void> {
    if (this.connectTimer) { clearTimeout(this.connectTimer); this.connectTimer = null; }
    this.stopMetersLoop();
    this.setInfo({ state: "OFFLINE", error: null });
  }

  /* ---------- audio streams (mock: just acknowledges) ---------- */

  async sendArtistAudio(_stream: MediaStream | null): Promise<void> { /* mock no-op */ }
  async sendTalkback(_stream: MediaStream | null): Promise<void> { /* mock no-op */ }
  async sendBeatPlayback(_stream: MediaStream | null): Promise<void> { /* mock no-op */ }

  /* ---------- control surface ---------- */

  async sendControlState(state: PluginControlState): Promise<void> {
    this.control = { ...state };
  }

  /* ---------- subscriptions ---------- */

  subscribePluginConnection(cb: (s: PluginConnectionInfo) => void): Unsubscribe {
    queueMicrotask(() => cb(this.info));
    return this.connBus.subscribe(cb);
  }

  subscribePluginMeters(cb: (f: PluginMetersFrame) => void): Unsubscribe {
    return this.metersBus.subscribe(cb);
  }

  subscribePluginErrors(cb: (e: PluginErrorEvent) => void): Unsubscribe {
    return this.errorsBus.subscribe(cb);
  }

  /* ---------- test-only helpers ---------- */

  /** Emit a synthetic error frame; used by tests/devtools only. */
  __emitError(err: PluginErrorEvent) {
    this.errorsBus.emit(err);
    if (err.fatal) this.setInfo({ state: "ERROR", error: err.message });
  }
}
