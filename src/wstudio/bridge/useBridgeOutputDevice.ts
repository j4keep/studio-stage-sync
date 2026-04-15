import { useCallback, useEffect, useRef, useState } from "react";

export type AudioOutputDevice = { deviceId: string; label: string };

/**
 * Enumerates audio output devices and routes a MediaStream to the selected one via setSinkId.
 * Used by the Bridge panel to pipe BRIDGE OUT into a virtual cable (BlackHole / VB-Cable).
 */
export function useBridgeOutputDevice(bridgeStream: MediaStream | null) {
  const [devices, setDevices] = useState<AudioOutputDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("default");
  const [routingError, setRoutingError] = useState<string | null>(null);
  const [routed, setRouted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Enumerate output devices
  const refreshDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const outputs = all
        .filter((d) => d.kind === "audiooutput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Output ${d.deviceId.slice(0, 8)}`,
        }));
      setDevices(outputs);
    } catch {
      setDevices([]);
    }
  }, []);

  useEffect(() => {
    refreshDevices();
    navigator.mediaDevices.addEventListener("devicechange", refreshDevices);
    return () => navigator.mediaDevices.removeEventListener("devicechange", refreshDevices);
  }, [refreshDevices]);

  // Route stream to selected device
  useEffect(() => {
    setRoutingError(null);
    setRouted(false);

    if (!bridgeStream) {
      if (audioRef.current) {
        audioRef.current.srcObject = null;
      }
      return;
    }

    let el = audioRef.current;
    if (!el) {
      el = new Audio();
      el.autoplay = true;
      // Mute the default speaker output — the real output goes to the selected sink
      el.volume = 0;
      audioRef.current = el;
    }

    el.srcObject = bridgeStream;

    const applySink = async () => {
      try {
        if (typeof (el as any).setSinkId === "function") {
          await (el as any).setSinkId(selectedDeviceId);
          // When routing to a virtual cable, we want full volume on that sink
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

    applySink();

    return () => {
      // Don't destroy audio element on re-render, just stop stream
    };
  }, [bridgeStream, selectedDeviceId]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.srcObject = null;
        audioRef.current = null;
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
