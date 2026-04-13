import { useCallback, useEffect, useState } from "react";

export type AudioInputDevice = { deviceId: string; label: string };

/**
 * Enumerates audio INPUT devices for DAW Return capture.
 * BlackHole / VB-Cable appear as audio inputs when installed.
 */
export function useBridgeInputDevices() {
  const [devices, setDevices] = useState<AudioInputDevice[]>([]);

  const refreshDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const inputs = all
        .filter((d) => d.kind === "audioinput")
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Input ${d.deviceId.slice(0, 8)}`,
        }));
      setDevices(inputs);
    } catch {
      setDevices([]);
    }
  }, []);

  useEffect(() => {
    refreshDevices();
    navigator.mediaDevices.addEventListener("devicechange", refreshDevices);
    return () => navigator.mediaDevices.removeEventListener("devicechange", refreshDevices);
  }, [refreshDevices]);

  return { devices, refreshDevices };
}
