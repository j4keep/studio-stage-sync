import { useCallback, useEffect, useRef, useState } from "react";

export type AudioOutputDevice = { deviceId: string; label: string };

/**
 * Virtual output: sends bridge audio to the W.Studio plugin over `ws://127.0.0.1` (no virtual cable).
 * Must match `kPluginNetworkAudioPort` in the plugin (default 47999).
 */
export const WSTUDIO_PLUGIN_LOCAL_DEVICE_ID = "wstudio-plugin-local";

/** Shown in bridge output dropdown; includes “WStudioPlugin” so it’s easy to spot. */
const PLUGIN_OUTPUT_LABEL = "WStudioPlugin — localhost (Logic / AU, port 47999)";

const initialBridgeDevices = (): AudioOutputDevice[] => [
  { deviceId: WSTUDIO_PLUGIN_LOCAL_DEVICE_ID, label: PLUGIN_OUTPUT_LABEL },
];

function getPluginAudioPort(): number {
  const raw = import.meta.env?.VITE_WSTUDIO_PLUGIN_AUDIO_PORT;
  const n = raw !== undefined ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 47999;
}

function isPluginLocalDevice(deviceId: string): boolean {
  return deviceId === WSTUDIO_PLUGIN_LOCAL_DEVICE_ID;
}

/**
 * Enumerates audio output devices and routes a MediaStream to the selected one via setSinkId,
 * or to the W.Studio plugin via a local WebSocket when {@link WSTUDIO_PLUGIN_LOCAL_DEVICE_ID} is selected.
 */
export function useBridgeOutputDevice(bridgeStream: MediaStream | null) {
  const [devices, setDevices] = useState<AudioOutputDevice[]>(initialBridgeDevices);
  const [selectedDeviceId, setSelectedDeviceId] = useState("default");
  const [routingError, setRoutingError] = useState<string | null>(null);
  const [routed, setRouted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pluginGraphRef = useRef<{
    ctx: AudioContext;
    ws: WebSocket;
    processor: ScriptProcessorNode;
    source: MediaStreamAudioSourceNode;
    mute: GainNode;
  } | null>(null);

  const refreshDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const outputs = all
        .filter((d) => d.kind === "audiooutput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Output ${d.deviceId.slice(0, 8)}`,
        }));

      const pluginVirtual: AudioOutputDevice = {
        deviceId: WSTUDIO_PLUGIN_LOCAL_DEVICE_ID,
        label: PLUGIN_OUTPUT_LABEL,
      };

      setDevices([pluginVirtual, ...outputs]);
    } catch {
      setDevices(initialBridgeDevices());
    }
  }, []);

  useEffect(() => {
    refreshDevices();
    navigator.mediaDevices.addEventListener("devicechange", refreshDevices);
    return () => navigator.mediaDevices.removeEventListener("devicechange", refreshDevices);
  }, [refreshDevices]);

  // Route stream: virtual cable (setSinkId) or plugin WebSocket
  useEffect(() => {
    setRoutingError(null);
    setRouted(false);

    const stopPluginGraph = () => {
      const g = pluginGraphRef.current;
      pluginGraphRef.current = null;
      if (!g) return;
      try {
        g.processor.disconnect();
        g.source.disconnect();
        g.mute.disconnect();
        g.ws.close();
        void g.ctx.close();
      } catch {
        /* ignore */
      }
    };

    if (!bridgeStream) {
      stopPluginGraph();
      if (audioRef.current) {
        audioRef.current.srcObject = null;
      }
      return;
    }

    if (isPluginLocalDevice(selectedDeviceId)) {
      if (audioRef.current) {
        audioRef.current.srcObject = null;
      }

      stopPluginGraph();

      const port = getPluginAudioPort();
      const wsUrl = `ws://127.0.0.1:${port}`;

      let cancelled = false;
      const run = async () => {
        try {
          const ctx = new AudioContext();
          const ws = new WebSocket(wsUrl);
          ws.binaryType = "arraybuffer";

          await new Promise<void>((resolve, reject) => {
            ws.onopen = () => resolve();
            ws.onerror = () => reject(new Error("Could not connect to W.Studio plugin. Open the plugin in your DAW on this Mac (it listens on 127.0.0.1)."));
          });

          if (cancelled) {
            ws.close();
            void ctx.close();
            return;
          }

          const source = ctx.createMediaStreamSource(bridgeStream);
          const bufferSize = 2048;
          const processor = ctx.createScriptProcessor(bufferSize, 2, 2);
          const mute = ctx.createGain();
          mute.gain.value = 0;

          processor.onaudioprocess = (e) => {
            if (ws.readyState !== WebSocket.OPEN) return;
            const nIn = e.inputBuffer.numberOfChannels;
            const inL = e.inputBuffer.getChannelData(0);
            const inR = nIn > 1 ? e.inputBuffer.getChannelData(1) : inL;
            const n = inL.length;
            const interleaved = new Float32Array(n * 2);
            for (let i = 0; i < n; i++) {
              interleaved[i * 2] = inL[i];
              interleaved[i * 2 + 1] = inR[i];
            }
            ws.send(interleaved.buffer);
          };

          source.connect(processor);
          processor.connect(mute);
          mute.connect(ctx.destination);

          pluginGraphRef.current = { ctx, ws, processor, source, mute };

          await ctx.resume();

          if (cancelled) {
            stopPluginGraph();
            return;
          }

          setRouted(true);
          setRoutingError(null);
        } catch (err) {
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
  }, [bridgeStream, selectedDeviceId]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.srcObject = null;
        audioRef.current = null;
      }
      const g = pluginGraphRef.current;
      pluginGraphRef.current = null;
      if (g) {
        try {
          g.processor.disconnect();
          g.source.disconnect();
          g.mute.disconnect();
          g.ws.close();
          void g.ctx.close();
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
