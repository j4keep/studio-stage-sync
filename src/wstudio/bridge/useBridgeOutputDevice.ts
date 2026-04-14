import { useCallback, useEffect, useRef, useState } from "react";

export type AudioOutputDevice = { deviceId: string; label: string };

type RoutableAudioElement = HTMLAudioElement & {
  setSinkId?: (deviceId: string) => Promise<void>;
};

function getRoutingErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to start bridge output";
}

/**
 * Enumerates audio output devices and routes a MediaStream to the selected one via setSinkId.
 * Used by the Bridge panel to pipe BRIDGE OUT into a virtual cable (BlackHole / VB-Cable).
 */
export function useBridgeOutputDevice(bridgeStream: MediaStream | null) {
  const [devices, setDevices] = useState<AudioOutputDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("default");
  const [routingError, setRoutingError] = useState<string | null>(null);
  const [routed, setRouted] = useState(false);
  const audioRef = useRef<RoutableAudioElement | null>(null);
  const unlockCleanupRef = useRef<() => void>(() => {});

  const clearUnlockRetry = useCallback(() => {
    unlockCleanupRef.current();
    unlockCleanupRef.current = () => {};
  }, []);

  const armUnlockRetry = useCallback((el: RoutableAudioElement) => {
    clearUnlockRetry();

    let disposed = false;
    const retry = () => {
      void el.play().then(() => {
        if (disposed) return;
        setRouted(true);
        setRoutingError(null);
        clearUnlockRetry();
      }).catch(() => {});
    };

    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      window.removeEventListener("pointerdown", retry, true);
      window.removeEventListener("touchstart", retry, true);
      window.removeEventListener("keydown", retry, true);
    };

    unlockCleanupRef.current = cleanup;
    window.addEventListener("pointerdown", retry, true);
    window.addEventListener("touchstart", retry, true);
    window.addEventListener("keydown", retry, true);
  }, [clearUnlockRetry]);

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

  useEffect(() => {
    setRoutingError(null);
    setRouted(false);
    clearUnlockRetry();

    if (!bridgeStream) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.srcObject = null;
      }
      return;
    }

    let el = audioRef.current;
    if (!el) {
      el = new Audio() as RoutableAudioElement;
      el.autoplay = true;
      el.preload = "auto";
      audioRef.current = el;
    }

    el.srcObject = bridgeStream;
    el.muted = false;
    el.volume = 1;

    let cancelled = false;

    const applySinkAndPlay = async () => {
      try {
        if (selectedDeviceId !== "default") {
          if (typeof el.setSinkId !== "function") {
            throw new Error("setSinkId not supported in this browser");
          }
          await el.setSinkId(selectedDeviceId);
        } else if (typeof el.setSinkId === "function") {
          await el.setSinkId("default");
        }

        await el.play();
        if (cancelled) return;
        setRouted(true);
        setRoutingError(null);
        clearUnlockRetry();
      } catch (error) {
        if (cancelled) return;
        setRoutingError(getRoutingErrorMessage(error));
        setRouted(false);
        armUnlockRetry(el);
      }
    };

    void applySinkAndPlay();

    return () => {
      cancelled = true;
      clearUnlockRetry();
      el.pause();
    };
  }, [bridgeStream, selectedDeviceId, armUnlockRetry, clearUnlockRetry]);

  useEffect(() => {
    return () => {
      clearUnlockRetry();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.srcObject = null;
        audioRef.current = null;
      }
    };
  }, [clearUnlockRetry]);

  return {
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    routingError,
    routed,
    refreshDevices,
  };
}
