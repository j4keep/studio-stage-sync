/**
 * HttpHelperTransport — real implementation of HelperTransport that talks to
 * the locally-running W.STUDIO Helper App over HTTP on 127.0.0.1:48000.
 *
 * The Helper App today:
 *   - accepts POSTs from the DAW plugin at  /plugin-event
 *     (PLUGIN_HELLO, PLUGIN_STATE)
 *   - exposes a status snapshot at         /status
 *     { helper: { version }, plugin: { connected, trackName, lastSeenAt } }
 *
 * We poll /status every ~1s. If we can reach the helper we mark CONNECTED.
 * If the plugin's last event is fresher than PLUGIN_FRESH_MS we mark the
 * plugin connected (drives /studio "Plugin connected" badges).
 *
 * No JUCE, no native code in the browser — just fetch().
 */

import type {
  ArtistLevelFrame,
  DawReturnFrame,
  HelperStatus,
  HelperTransport,
  LatencyReport,
  PluginState,
  Unsubscribe,
} from "./types";

const DEFAULT_HELPER_BASE = "http://127.0.0.1:48000";
const POLL_MS = 1000;
const PLUGIN_FRESH_MS = 5000;

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
        try { cb(v); } catch { /* ignore */ }
      });
    },
  };
}

interface HelperStatusResponse {
  helper?: { version?: string | null };
  plugin?: {
    connected?: boolean;
    trackName?: string | null;
    lastSeenAt?: number | null; // epoch ms; alt: lastEventAt / lastHelloAt
    lastEventAt?: number | null;
    lastHelloAt?: number | null;
  };
}

export class HttpHelperTransport implements HelperTransport {
  readonly id = "wstudio-helper" as const;
  readonly label = "W.STUDIO Helper App (127.0.0.1:48000)";
  readonly baseUrl: string;

  private status: HelperStatus = {
    state: "NOT_RUNNING",
    version: null,
    error: null,
    lastSeenAt: null,
  };
  private plugin: PluginState = { connected: false, feedActive: false, trackName: null };

  private statusBus = makeBus<HelperStatus>();
  private pluginBus = makeBus<PluginState>();
  private levelBus = makeBus<ArtistLevelFrame>();
  private returnBus = makeBus<DawReturnFrame>();

  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private started = false;

  constructor(baseUrl: string = DEFAULT_HELPER_BASE) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    // Auto-start polling so subscribers see live data immediately, even
    // before connect() is explicitly called.
    this.startPolling();
  }

  private setStatus(patch: Partial<HelperStatus>) {
    this.status = { ...this.status, ...patch };
    this.statusBus.emit(this.status);
  }
  private setPlugin(patch: Partial<PluginState>) {
    const next = { ...this.plugin, ...patch };
    if (
      next.connected === this.plugin.connected &&
      next.feedActive === this.plugin.feedActive &&
      next.trackName === this.plugin.trackName
    ) return;
    this.plugin = next;
    this.pluginBus.emit(this.plugin);
  }

  private startPolling() {
    if (this.started) return;
    this.started = true;
    void this.pollOnce();
    this.pollTimer = setInterval(() => { void this.pollOnce(); }, POLL_MS);
  }

  private stopPolling() {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null; }
    this.started = false;
  }

  private async pollOnce(): Promise<void> {
    const prevState = this.status.state;
    const prevPluginConnected = this.plugin.connected;
    try {
      const res = await fetch(`${this.baseUrl}/status`, {
        method: "GET",
        cache: "no-store",
        mode: "cors",
      });
      if (!res.ok) {
        this.setStatus({ state: "NOT_RUNNING", error: `helper HTTP ${res.status}` });
        this.evaluatePluginFreshness(null);
        return;
      }
      const body = (await res.json().catch(() => ({}))) as HelperStatusResponse;
      this.setStatus({
        state: "CONNECTED",
        version: body.helper?.version ?? this.status.version,
        error: null,
        lastSeenAt: Date.now(),
      });
      const last =
        body.plugin?.lastSeenAt ?? body.plugin?.lastEventAt ?? body.plugin?.lastHelloAt ?? null;
      this.evaluatePluginFreshness(last, body.plugin?.trackName ?? null, body.plugin?.connected);
      // Log only on transition to avoid 1Hz spam.
      if (prevState !== "CONNECTED" || prevPluginConnected !== this.plugin.connected) {
        // eslint-disable-next-line no-console
        console.log("HELPER_STATUS", {
          base: this.baseUrl,
          state: this.status.state,
          version: this.status.version,
          plugin: this.plugin,
        });
      }
    } catch (err) {
      // Network/CORS error → helper not reachable on this host.
      const msg = err instanceof Error ? err.message : String(err);
      this.setStatus({ state: "NOT_RUNNING", error: msg });
      this.evaluatePluginFreshness(null);
    }
  }


  /**
   * Mark the plugin connected when we either:
   *   - received an explicit { connected: true } flag from the helper, OR
   *   - saw a plugin event within PLUGIN_FRESH_MS.
   */
  private evaluatePluginFreshness(
    lastSeenAt: number | null,
    trackName: string | null = this.plugin.trackName,
    explicit?: boolean,
  ) {
    const fresh = lastSeenAt != null && Date.now() - lastSeenAt < PLUGIN_FRESH_MS;
    const connected = explicit === true || fresh;
    this.setPlugin({
      connected,
      feedActive: fresh,
      trackName,
    });
  }

  /* ---------- HelperTransport contract ---------- */

  async connect(): Promise<HelperStatus> {
    this.setStatus({ state: "CONNECTING", error: null });
    this.startPolling();
    await this.pollOnce();
    return this.status;
  }

  async disconnect(): Promise<void> {
    this.stopPolling();
    this.setStatus({ state: "NOT_RUNNING", error: null });
    this.setPlugin({ connected: false, feedActive: false });
  }

  getStatus(): HelperStatus { return this.status; }

  async startMicTest(): Promise<void> { /* helper-side TODO */ }
  async startHeadphoneTest(): Promise<void> { /* helper-side TODO */ }
  async startBeatPlayback(): Promise<void> { /* helper-side TODO */ }
  async startLatencyCheck(): Promise<LatencyReport> {
    return { roundTripMs: 0, micToDawMs: 0, dawToArtistMs: 0, confidence: 0 };
  }

  subscribeToHelperStatus(cb: StatusCb): Unsubscribe {
    queueMicrotask(() => cb(this.status));
    return this.statusBus.subscribe(cb);
  }
  subscribeToPluginState(cb: PluginCb): Unsubscribe {
    queueMicrotask(() => cb(this.plugin));
    return this.pluginBus.subscribe(cb);
  }
  subscribeToArtistLevel(cb: LevelCb): Unsubscribe { return this.levelBus.subscribe(cb); }
  subscribeToDawReturn(cb: ReturnCb): Unsubscribe { return this.returnBus.subscribe(cb); }

  /* ---------- helper-aware URLs (used by other transports) ---------- */
  artistAudioUrl(slot: number): string {
    return `${this.baseUrl}/artist-audio/${slot}`;
  }
}
