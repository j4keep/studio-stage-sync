import { useCallback, useEffect, useRef, useState } from "react";

export type AudioOutputDevice = { deviceId: string; label: string };

/** Primary path: engineer tab sends PCM to the Rust desktop bridge on localhost (see `npm run wstudio:bridge`). */
export const WSTUDIO_DESKTOP_BRIDGE_LOCAL_DEVICE_ID = "wstudio-desktop-bridge-local";

const DESKTOP_BRIDGE_LABEL = "W.STUDIO Desktop Bridge — localhost (run npm run wstudio:bridge, port 48001)";

/**
 * Experimental: WebSocket PCM into the in-DAW AU. Enable with `VITE_WSTUDIO_PLUGIN_WS_BRIDGE=true`.
 */
export const WSTUDIO_PLUGIN_WS_BRIDGE_ENABLED =
  typeof import.meta.env !== "undefined" && import.meta.env.VITE_WSTUDIO_PLUGIN_WS_BRIDGE === "true";

/**
 * Virtual output ID for the experimental AU WebSocket path (only listed when {@link WSTUDIO_PLUGIN_WS_BRIDGE_ENABLED}).
 * Must match the AU when `WSTUDIO_AU_ENABLE_NETWORK_BRIDGE=1` (default port 47999).
 */
export const WSTUDIO_PLUGIN_LOCAL_DEVICE_ID = "wstudio-plugin-local";

/** Shown in bridge output dropdown when experimental path is enabled. */
const PLUGIN_OUTPUT_LABEL = "Experimental: WStudioPlugin — localhost (AU WebSocket, port 47999)";

const initialBridgeDevices = (): AudioOutputDevice[] => {
  const head: AudioOutputDevice[] = [
    { deviceId: WSTUDIO_DESKTOP_BRIDGE_LOCAL_DEVICE_ID, label: DESKTOP_BRIDGE_LABEL },
  ];
  if (WSTUDIO_PLUGIN_WS_BRIDGE_ENABLED) {
    head.push({ deviceId: WSTUDIO_PLUGIN_LOCAL_DEVICE_ID, label: PLUGIN_OUTPUT_LABEL });
  }
  return head;
};

function getDesktopBridgePort(): number {
  const raw = import.meta.env?.VITE_WSTUDIO_DESKTOP_BRIDGE_PORT;
  const n = raw !== undefined ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 48001;
}

function getPluginAudioPort(): number {
  const raw = import.meta.env?.VITE_WSTUDIO_PLUGIN_AUDIO_PORT;
  const n = raw !== undefined ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 47999;
}

type LocalWsBridgeKind = "desktop" | "plugin";

function getLocalWsBridgeTarget(deviceId: string): { port: number; kind: LocalWsBridgeKind } | null {
  if (deviceId === WSTUDIO_DESKTOP_BRIDGE_LOCAL_DEVICE_ID) {
    return { port: getDesktopBridgePort(), kind: "desktop" };
  }
  if (deviceId === WSTUDIO_PLUGIN_LOCAL_DEVICE_ID && WSTUDIO_PLUGIN_WS_BRIDGE_ENABLED) {
    return { port: getPluginAudioPort(), kind: "plugin" };
  }
  return null;
}

/** Same MediaStream cannot reliably drive two AudioContexts; clone tracks for the tap graph. */
function cloneStreamForAudioTap(stream: MediaStream): MediaStream {
  const tracks = stream.getAudioTracks().map((t) => {
    try {
      return typeof t.clone === "function" ? t.clone() : t;
    } catch {
      return t;
    }
  });
  return new MediaStream(tracks);
}

function isPublicHttpsBlockingLoopbackWs(): boolean {
  if (typeof window === "undefined") return false;
  if (!window.isSecureContext) return false;
  if (window.location.protocol !== "https:") return false;
  const h = window.location.hostname;
  return h !== "localhost" && h !== "127.0.0.1";
}

/** On local dev, default to the desktop bridge so engineers run `npm run wstudio:bridge` once. */
function getInitialBridgeOutputDeviceId(): string {
  if (typeof window === "undefined") return "default";
  const h = window.location.hostname;
  if (h === "localhost" || h === "127.0.0.1") return WSTUDIO_DESKTOP_BRIDGE_LOCAL_DEVICE_ID;
  return "default";
}

async function ensureAudioContextRunning(ctx: AudioContext): Promise<void> {
  try {
    if (ctx.state !== "closed") await ctx.resume();
  } catch {
    /* ignore */
  }
}

/**
 * Enumerates audio output devices and routes a MediaStream to the selected one via setSinkId,
 * to **W.STUDIO Desktop Bridge** on `ws://127.0.0.1:48001` (or the experimental AU path if enabled).
 *
 * **Bridge path (important):** `bridgeStream` must be the **engineer’s** graph — typically
 * `engineerDawVocalIn1`, which carries the **remote WebRTC artist mic**. Run the Rust bridge (`npm run wstudio:bridge`)
 * and set macOS **Sound output** to the device your DAW records from (loopback / aggregate / W.STUDIO routing). The artist’s browser does not talk to Logic directly.
 *
 * The plugin tap always uses its **own** `AudioContext`. Feeding a `MediaStreamDestination` from the engineer
 * vocal graph back into a `MediaStreamSource` **in that same context** is unreliable in Chrome and often
 * produces silence; a second context + cloned tracks is the stable pattern.
 */
export function useBridgeOutputDevice(bridgeStream: MediaStream | null) {
  const [devices, setDevices] = useState<AudioOutputDevice[]>(initialBridgeDevices);
  const [selectedDeviceId, setSelectedDeviceId] = useState(getInitialBridgeOutputDeviceId);
  const [routingError, setRoutingError] = useState<string | null>(null);
  const [routed, setRouted] = useState(false);
  /** Bumps when a localhost WebSocket bridge drops unexpectedly so the routing effect can reconnect. */
  const [localWsBridgeReconnectNonce, setLocalWsBridgeReconnectNonce] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pluginGraphRef = useRef<{
    ctx: AudioContext;
    ownsContext: boolean;
    ws: WebSocket;
    processor: ScriptProcessorNode;
    source: MediaStreamAudioSourceNode;
    mute: GainNode;
    tapStream: MediaStream;
  } | null>(null);
  const pluginTapListenersRef = useRef<(() => void) | null>(null);
  const localWsBridgeRetryCountRef = useRef(0);

  const refreshDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const outputs = all
        .filter((d) => d.kind === "audiooutput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Output ${d.deviceId.slice(0, 8)}`,
        }));

      const head: AudioOutputDevice[] = [
        { deviceId: WSTUDIO_DESKTOP_BRIDGE_LOCAL_DEVICE_ID, label: DESKTOP_BRIDGE_LABEL },
      ];
      if (WSTUDIO_PLUGIN_WS_BRIDGE_ENABLED) {
        head.push({ deviceId: WSTUDIO_PLUGIN_LOCAL_DEVICE_ID, label: PLUGIN_OUTPUT_LABEL });
      }

      setDevices([...head, ...outputs]);
    } catch {
      setDevices(initialBridgeDevices());
    }
  }, []);

  useEffect(() => {
    refreshDevices();
    navigator.mediaDevices.addEventListener("devicechange", refreshDevices);
    return () => navigator.mediaDevices.removeEventListener("devicechange", refreshDevices);
  }, [refreshDevices]);

  useEffect(() => {
    if (!WSTUDIO_PLUGIN_WS_BRIDGE_ENABLED && selectedDeviceId === WSTUDIO_PLUGIN_LOCAL_DEVICE_ID) {
      setSelectedDeviceId("default");
    }
  }, [selectedDeviceId]);

  useEffect(() => {
    const onVis = () => {
      if (typeof document === "undefined" || document.visibilityState !== "visible") return;
      const g = pluginGraphRef.current;
      if (g?.ctx && g.ctx.state !== "closed") void ensureAudioContextRunning(g.ctx);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Route stream: virtual cable (setSinkId) or plugin WebSocket
  useEffect(() => {
    setRoutingError(null);
    setRouted(false);

    const stopPluginGraph = () => {
      pluginTapListenersRef.current?.();
      pluginTapListenersRef.current = null;
      const g = pluginGraphRef.current;
      pluginGraphRef.current = null;
      if (!g) return;
      try {
        g.processor.disconnect();
        g.source.disconnect();
        g.mute.disconnect();
        g.ws.close();
        if (g.ownsContext) void g.ctx.close();
        g.tapStream.getTracks().forEach((t) => {
          try {
            t.stop();
          } catch {
            /* ignore */
          }
        });
      } catch {
        /* ignore */
      }
    };

    if (!bridgeStream) {
      localWsBridgeRetryCountRef.current = 0;
      stopPluginGraph();
      if (audioRef.current) {
        audioRef.current.srcObject = null;
      }
      return;
    }

    const wsTarget = getLocalWsBridgeTarget(selectedDeviceId);
    if (wsTarget !== null) {
      if (audioRef.current) {
        audioRef.current.srcObject = null;
      }

      stopPluginGraph();

      const wsUrl = `ws://127.0.0.1:${wsTarget.port}`;

      if (isPublicHttpsBlockingLoopbackWs()) {
        setRouted(false);
        setRoutingError(
          "This bridge uses ws://127.0.0.1. Browsers block that from most HTTPS sites. Run the web app at http://localhost (npm run dev) on this Mac, or use “Default output” with your normal loopback routing until a secure tunnel exists.",
        );
        return () => {};
      }

      let cancelled = false;
      const run = async () => {
        let tapStream: MediaStream | null = null;
        let ctx: AudioContext | null = null;
        let ownsContext = false;
        let ws: WebSocket | null = null;
        try {
          tapStream = cloneStreamForAudioTap(bridgeStream);
          ownsContext = true;
          ctx = new AudioContext();
          ws = new WebSocket(wsUrl);
          ws.binaryType = "arraybuffer";

          await new Promise<void>((resolve, reject) => {
            ws!.onopen = () => resolve();
            ws!.onerror = () =>
              reject(
                new Error(
                  wsTarget.kind === "desktop"
                    ? `Could not open WebSocket to 127.0.0.1:${wsTarget.port}. On this Mac run: npm run wstudio:bridge (Rust bridge must be listening). Then click Refresh. Use http://localhost for this site (not HTTPS).`
                    : `Could not open WebSocket to 127.0.0.1:${wsTarget.port}. Enable the AU network bridge in Xcode/Projucer, open WStudioPlugin in Logic, start playback once, then Refresh. Use http://localhost (not HTTPS).`,
                ),
              );
          });

          if (cancelled) {
            ws.close();
            if (ownsContext) void ctx.close();
            tapStream.getTracks().forEach((t) => {
              try {
                t.stop();
              } catch {
                /* ignore */
              }
            });
            return;
          }

          localWsBridgeRetryCountRef.current = 0;
          ws.onclose = (ev: CloseEvent) => {
            if (cancelled) return;
            if (ev.code === 1000 && ev.wasClean) return;
            setRouted(false);
            setRoutingError(
              wsTarget.kind === "desktop"
                ? "Desktop bridge WebSocket closed. Run npm run wstudio:bridge and click Refresh."
                : "WStudioPlugin WebSocket closed. Open the plugin in Logic, start playback once, then Refresh.",
            );
            const n = localWsBridgeRetryCountRef.current;
            if (n < 8) {
              localWsBridgeRetryCountRef.current = n + 1;
              window.setTimeout(() => setLocalWsBridgeReconnectNonce((c) => c + 1), 1500);
            }
          };

          const source = ctx.createMediaStreamSource(tapStream);
          const bufferSize = 2048;
          const processor = ctx.createScriptProcessor(bufferSize, 2, 2);
          const mute = ctx.createGain();
          mute.gain.value = 0;

          let bridgeSendLogCounter = 0;
          processor.onaudioprocess = (e) => {
            const c = ctx;
            if (!c) return;
            void ensureAudioContextRunning(c);
            if (c.state !== "running") return;
            if (ws.readyState !== WebSocket.OPEN) return;
            const nIn = e.inputBuffer.numberOfChannels;
            const inL = e.inputBuffer.getChannelData(0);
            // Mono WebRTC → duplicate to stereo for the plugin FIFO (L/R interleaved float32).
            const inR = nIn > 1 ? e.inputBuffer.getChannelData(1) : inL;
            const n = inL.length;
            const interleaved = new Float32Array(n * 2);
            let peak = 0;
            for (let i = 0; i < n; i++) {
              const l = inL[i];
              const r = inR[i];
              interleaved[i * 2] = l;
              interleaved[i * 2 + 1] = r;
              peak = Math.max(peak, Math.abs(l), Math.abs(r));
            }
            ws.send(interleaved.buffer);
            if (import.meta.env.DEV) {
              bridgeSendLogCounter += 1;
              if (bridgeSendLogCounter % 48 === 0) {
                console.debug("[W.Studio bridge] sent PCM to localhost bridge (engineer path)", {
                  samplesPerChannel: n,
                  stereoFloats: interleaved.length,
                  peak,
                });
              }
            }
          };

          source.connect(processor);
          processor.connect(mute);
          mute.connect(ctx.destination);

          pluginGraphRef.current = { ctx, ownsContext, ws, processor, source, mute, tapStream };

          await ensureAudioContextRunning(ctx);

          const onUserGestureWake = () => {
            void ensureAudioContextRunning(ctx);
          };
          window.addEventListener("pointerdown", onUserGestureWake, { passive: true });
          window.addEventListener("keydown", onUserGestureWake);

          const clearWakeListeners = () => {
            window.removeEventListener("pointerdown", onUserGestureWake);
            window.removeEventListener("keydown", onUserGestureWake);
          };

          const onCtxState = () => {
            if (ctx.state === "running") {
              setRoutingError((prev) =>
                prev != null && prev.includes("Click or tap") ? null : prev,
              );
              clearWakeListeners();
              ctx.removeEventListener("statechange", onCtxState);
              pluginTapListenersRef.current = null;
            }
          };
          ctx.addEventListener("statechange", onCtxState);

          pluginTapListenersRef.current = () => {
            clearWakeListeners();
            ctx.removeEventListener("statechange", onCtxState);
          };

          if (cancelled) {
            pluginTapListenersRef.current?.();
            pluginTapListenersRef.current = null;
            stopPluginGraph();
            return;
          }

          if (ctx.state !== "running") {
            setRoutingError(
              "Audio to Logic is paused in the browser. Click or tap anywhere on this page once, then check Logic meters.",
            );
          } else {
            setRoutingError(null);
          }

          setRouted(true);
        } catch (err) {
          if (ws) {
            try {
              ws.close();
            } catch {
              /* ignore */
            }
          }
          if (ctx && ownsContext) {
            try {
              void ctx.close();
            } catch {
              /* ignore */
            }
          }
          if (tapStream) {
            tapStream.getTracks().forEach((t) => {
              try {
                t.stop();
              } catch {
                /* ignore */
              }
            });
          }
          if (!cancelled) {
            setRouted(false);
            setRoutingError(err instanceof Error ? err.message : "Plugin audio routing failed");
          }
        }
      };

      void run();

      return () => {
        cancelled = true;
        stopPluginGraph();
      };
    }

    localWsBridgeRetryCountRef.current = 0;
    stopPluginGraph();

    let el = audioRef.current;
    if (!el) {
      el = new Audio();
      el.autoplay = true;
      el.volume = 0;
      audioRef.current = el;
    }

    el.srcObject = bridgeStream;

    const applySink = async () => {
      try {
        if (typeof (el as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }).setSinkId === "function") {
          await (el as HTMLAudioElement & { setSinkId: (id: string) => Promise<void> }).setSinkId(selectedDeviceId);
          el!.volume = 1;
          setRouted(true);
          setRoutingError(null);
        } else {
          setRoutingError("setSinkId not supported in this browser");
        }
      } catch (err) {
        setRoutingError(err instanceof Error ? err.message : "Failed to set output device");
        setRouted(false);
      }
    };

    void applySink();

    return () => {
      /* keep element for reuse */
    };
  }, [bridgeStream, selectedDeviceId, localWsBridgeReconnectNonce]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.srcObject = null;
        audioRef.current = null;
      }
      pluginTapListenersRef.current?.();
      pluginTapListenersRef.current = null;
      const g = pluginGraphRef.current;
      pluginGraphRef.current = null;
      if (g) {
        try {
          g.processor.disconnect();
          g.source.disconnect();
          g.mute.disconnect();
          g.ws.close();
          if (g.ownsContext) void g.ctx.close();
          g.tapStream.getTracks().forEach((t) => {
            try {
              t.stop();
            } catch {
              /* ignore */
            }
          });
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  return {
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    routingError,
    routed,
    refreshDevices,
  };
}
