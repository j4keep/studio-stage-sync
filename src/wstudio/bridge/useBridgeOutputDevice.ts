import { useCallback, useEffect, useRef, useState } from "react";

const BRIDGE_TAG = "[BRIDGE-OUTPUT]";

/**
 * Plays the bridge stream to the browser's DEFAULT output only.
 * No setSinkId — macOS Multi-Output Device duplicates to BlackHole for DAW capture.
 * This is how pro remote-session apps (Audiomovers, Cleanfeed, etc.) work.
 */
export function useBridgeOutputDevice(bridgeStream: MediaStream | null) {
  const [routed, setRouted] = useState(false);
  const [routingError, setRoutingError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unlockCleanupRef = useRef<() => void>(() => {});

  const clearUnlockRetry = useCallback(() => {
    unlockCleanupRef.current();
    unlockCleanupRef.current = () => {};
  }, []);

  const armUnlockRetry = useCallback((el: HTMLAudioElement) => {
    clearUnlockRetry();
    let disposed = false;
    const retry = () => {
      void el.play().then(() => {
        if (disposed) return;
        console.log(BRIDGE_TAG, "Autoplay unlocked via user gesture");
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

  useEffect(() => {
    setRoutingError(null);
    setRouted(false);
    clearUnlockRetry();
    if (watchdogRef.current) { clearInterval(watchdogRef.current); watchdogRef.current = null; }

    if (!bridgeStream) {
      console.log(BRIDGE_TAG, "No bridge stream, tearing down");
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.srcObject = null;
        if (audioRef.current.parentNode) audioRef.current.parentNode.removeChild(audioRef.current);
      }
      return;
    }

    const tracks = bridgeStream.getAudioTracks();
    if (tracks.length === 0 || tracks.every(t => t.readyState !== "live")) {
      console.warn(BRIDGE_TAG, "No live audio tracks");
      setRoutingError("Bridge stream has no live audio tracks");
      return;
    }

    let el = audioRef.current;
    if (!el) {
      el = new Audio();
      el.autoplay = true;
      el.style.position = "absolute";
      el.style.width = "0";
      el.style.height = "0";
      el.style.opacity = "0";
      el.style.pointerEvents = "none";
      document.body.appendChild(el);
      audioRef.current = el;
      console.log(BRIDGE_TAG, "Created hidden audio element (default output)");
    }

    el.srcObject = bridgeStream;
    el.muted = false;
    el.volume = 1;

    let cancelled = false;

    void el.play().then(() => {
      if (cancelled) return;
      console.log(BRIDGE_TAG, "✅ Playing to default output (use macOS Multi-Output for DAW)");
      setRouted(true);
      setRoutingError(null);
    }).catch(err => {
      if (cancelled) return;
      console.error(BRIDGE_TAG, "Play failed, waiting for gesture:", err);
      setRoutingError("Click anywhere to start bridge output");
      armUnlockRetry(el!);
    });

    watchdogRef.current = setInterval(() => {
      if (cancelled || !el) return;
      const st = el.srcObject instanceof MediaStream ? el.srcObject.getAudioTracks() : [];
      if (el.paused && st.some(t => t.readyState === "live")) {
        console.warn(BRIDGE_TAG, "Watchdog: restarting play()");
        void el.play().then(() => { setRouted(true); setRoutingError(null); }).catch(() => {});
      }
    }, 2000);

    return () => {
      cancelled = true;
      clearUnlockRetry();
      if (watchdogRef.current) { clearInterval(watchdogRef.current); watchdogRef.current = null; }
      el!.pause();
    };
  }, [bridgeStream, armUnlockRetry, clearUnlockRetry]);

  useEffect(() => {
    return () => {
      clearUnlockRetry();
      if (watchdogRef.current) { clearInterval(watchdogRef.current); watchdogRef.current = null; }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.srcObject = null;
        if (audioRef.current.parentNode) audioRef.current.parentNode.removeChild(audioRef.current);
        audioRef.current = null;
      }
    };
  }, [clearUnlockRetry]);

  return { routed, routingError };
}
