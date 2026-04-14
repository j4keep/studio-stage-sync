import { useCallback, useEffect, useRef, useState } from "react";

export type AudioOutputDevice = { deviceId: string; label: string };

type RoutableAudioElement = HTMLAudioElement & {
  setSinkId?: (deviceId: string) => Promise<void>;
};

const BRIDGE_TAG = "[BRIDGE-OUTPUT]";

function getRoutingErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to start bridge output";
}

/**
 * Enumerates audio output devices and routes a MediaStream to the selected one via setSinkId.
 * Used by the Bridge panel to pipe BRIDGE OUT into a virtual cable (BlackHole / VB-Cable).
 *
 * CRITICAL: This hook creates a REAL hidden <audio> element appended to the DOM,
 * sets its srcObject, routes it to the selected sink device, and keeps it playing.
 * Without this, the BRIDGE OUT meter may move but no audio actually reaches the OS device.
 */
export function useBridgeOutputDevice(bridgeStream: MediaStream | null) {
  const [devices, setDevices] = useState<AudioOutputDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("default");
  const [routingError, setRoutingError] = useState<string | null>(null);
  const [routed, setRouted] = useState(false);
  const audioRef = useRef<RoutableAudioElement | null>(null);
  const unlockCleanupRef = useRef<() => void>(() => {});
  /** Interval that keeps verifying the element is still playing */
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        console.log(BRIDGE_TAG, "Autoplay unlocked via user gesture, now playing");
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
      console.log(BRIDGE_TAG, "Output devices enumerated:", outputs.map((d) => `${d.label} (${d.deviceId.slice(0, 12)})`));
    } catch {
      setDevices([]);
    }
  }, []);

  useEffect(() => {
    refreshDevices();
    navigator.mediaDevices.addEventListener("devicechange", refreshDevices);
    return () => navigator.mediaDevices.removeEventListener("devicechange", refreshDevices);
  }, [refreshDevices]);

  /* ─── Main routing effect ─── */
  useEffect(() => {
    setRoutingError(null);
    setRouted(false);
    clearUnlockRetry();

    if (watchdogRef.current) {
      clearInterval(watchdogRef.current);
      watchdogRef.current = null;
    }

    if (!bridgeStream) {
      console.log(BRIDGE_TAG, "No bridge stream, tearing down audio element");
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.srcObject = null;
        if (audioRef.current.parentNode) {
          audioRef.current.parentNode.removeChild(audioRef.current);
        }
      }
      return;
    }

    // Check that the stream has active audio tracks
    const tracks = bridgeStream.getAudioTracks();
    console.log(BRIDGE_TAG, "Bridge stream received:", {
      streamId: bridgeStream.id,
      audioTrackCount: tracks.length,
      trackStates: tracks.map((t) => ({ id: t.id.slice(0, 8), readyState: t.readyState, enabled: t.enabled, muted: t.muted })),
    });

    if (tracks.length === 0 || tracks.every((t) => t.readyState !== "live")) {
      console.warn(BRIDGE_TAG, "No live audio tracks on bridge stream – nothing to route");
      setRoutingError("Bridge stream has no live audio tracks");
      return;
    }

    // Create or reuse audio element – MUST be appended to document body
    let el = audioRef.current;
    if (!el) {
      el = new Audio() as RoutableAudioElement;
      el.autoplay = true;
      el.preload = "auto";
      // Some browsers need the element in the DOM to actually route audio
      el.style.position = "absolute";
      el.style.width = "0";
      el.style.height = "0";
      el.style.opacity = "0";
      el.style.pointerEvents = "none";
      document.body.appendChild(el);
      audioRef.current = el;
      console.log(BRIDGE_TAG, "Created hidden audio element and appended to DOM");
    }

    el.srcObject = bridgeStream;
    el.muted = false;
    el.volume = 1;

    console.log(BRIDGE_TAG, "srcObject set on audio element, volume=1, muted=false");

    let cancelled = false;

    const applySinkAndPlay = async () => {
      try {
        // Apply sink ID
        if (typeof el!.setSinkId === "function") {
          const targetSinkId = selectedDeviceId || "default";
          console.log(BRIDGE_TAG, "Calling setSinkId:", targetSinkId);
          await el!.setSinkId(targetSinkId);
          console.log(BRIDGE_TAG, "setSinkId SUCCESS:", targetSinkId);
        } else {
          console.warn(BRIDGE_TAG, "setSinkId not supported – audio will play to browser default output only");
        }

        // Play
        await el!.play();
        if (cancelled) return;

        console.log(BRIDGE_TAG, "✅ Audio element PLAYING successfully", {
          paused: el!.paused,
          currentTime: el!.currentTime,
          readyState: el!.readyState,
          selectedDeviceId,
        });
        setRouted(true);
        setRoutingError(null);
        clearUnlockRetry();
      } catch (error) {
        if (cancelled) return;
        console.error(BRIDGE_TAG, "❌ Failed to start bridge output:", error);
        setRoutingError(getRoutingErrorMessage(error));
        setRouted(false);
        armUnlockRetry(el!);
      }
    };

    void applySinkAndPlay();

    // Watchdog: if the element stops playing (e.g. browser suspension), restart it
    watchdogRef.current = setInterval(() => {
      if (cancelled || !el) return;
      const streamTracks = el.srcObject instanceof MediaStream ? el.srcObject.getAudioTracks() : [];
      const hasLiveTracks = streamTracks.some((t) => t.readyState === "live");

      if (el.paused && hasLiveTracks) {
        console.warn(BRIDGE_TAG, "Watchdog: audio element paused unexpectedly, restarting play()");
        void el.play().then(() => {
          console.log(BRIDGE_TAG, "Watchdog: play() restarted successfully");
          setRouted(true);
          setRoutingError(null);
        }).catch((e) => {
          console.warn(BRIDGE_TAG, "Watchdog: play() restart failed:", e);
        });
      }
    }, 2000);

    return () => {
      cancelled = true;
      clearUnlockRetry();
      if (watchdogRef.current) {
        clearInterval(watchdogRef.current);
        watchdogRef.current = null;
      }
      el!.pause();
    };
  }, [bridgeStream, selectedDeviceId, armUnlockRetry, clearUnlockRetry]);

  /* ─── Final teardown ─── */
  useEffect(() => {
    return () => {
      clearUnlockRetry();
      if (watchdogRef.current) {
        clearInterval(watchdogRef.current);
        watchdogRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.srcObject = null;
        if (audioRef.current.parentNode) {
          audioRef.current.parentNode.removeChild(audioRef.current);
        }
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
