import { useCallback, useEffect, useRef, useState } from "react";

const BRIDGE_TAG = "[BRIDGE-OUTPUT]";
const WATCHDOG_INTERVAL_MS = 1500;
const STALLED_CYCLE_LIMIT = 2;

function getLiveAudioTracks(stream: MediaStream | null) {
  return stream?.getAudioTracks().filter((track) => track.readyState === "live") ?? [];
}

function buildPlaybackStream(stream: MediaStream | null) {
  const liveTracks = getLiveAudioTracks(stream);
  if (!liveTracks.length) return null;
  const playbackStream = new MediaStream();
  liveTracks.forEach((track) => playbackStream.addTrack(track));
  return playbackStream;
}

/**
 * Plays the bridge stream to the browser's DEFAULT output only.
 * No setSinkId — macOS Multi-Output Device duplicates to BlackHole for DAW capture.
 */
export function useBridgeOutputDevice(bridgeStream: MediaStream | null) {
  const [routed, setRouted] = useState(false);
  const [routingError, setRoutingError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const watchdogRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unlockCleanupRef = useRef<() => void>(() => {});
  const lastCurrentTimeRef = useRef(0);

  const clearUnlockRetry = useCallback(() => {
    unlockCleanupRef.current();
    unlockCleanupRef.current = () => {};
  }, []);

  const armUnlockRetry = useCallback((recover: () => void) => {
    clearUnlockRetry();
    let disposed = false;

    const retry = () => {
      if (disposed) return;
      recover();
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
    lastCurrentTimeRef.current = 0;
    if (watchdogRef.current) {
      clearInterval(watchdogRef.current);
      watchdogRef.current = null;
    }

    if (!bridgeStream) {
      console.log(BRIDGE_TAG, "No bridge stream, tearing down");
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.srcObject = null;
        if (audioRef.current.parentNode) audioRef.current.parentNode.removeChild(audioRef.current);
        audioRef.current = null;
      }
      return;
    }

    const initialTracks = getLiveAudioTracks(bridgeStream);
    if (!initialTracks.length) {
      console.warn(BRIDGE_TAG, "No live audio tracks");
      setRoutingError("Bridge stream has no live audio tracks");
      return;
    }

    let el = audioRef.current;
    if (!el) {
      el = document.createElement("audio");
      el.autoplay = true;
      el.preload = "auto";
      el.style.position = "absolute";
      el.style.width = "0";
      el.style.height = "0";
      el.style.opacity = "0";
      el.style.pointerEvents = "none";
      document.body.appendChild(el);
      audioRef.current = el;
      console.log(BRIDGE_TAG, "Created hidden audio element (default output)");
    }

    let cancelled = false;
    let stalledCycles = 0;

    const logState = (label: string) => {
      console.debug(BRIDGE_TAG, label, {
        paused: el?.paused,
        muted: el?.muted,
        volume: el?.volume,
        readyState: el?.readyState,
        currentTime: Number(el?.currentTime?.toFixed?.(3) ?? 0),
        trackStates: getLiveAudioTracks(bridgeStream).map((track) => ({
          id: track.id,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
        })),
      });
    };

    const attachPlaybackStream = () => {
      const playbackStream = buildPlaybackStream(bridgeStream);
      if (!playbackStream || !el) return false;
      el.srcObject = playbackStream;
      el.defaultMuted = false;
      el.muted = false;
      el.volume = 1;
      return true;
    };

    const ensurePlayback = async (reason: string) => {
      if (cancelled || !el) return;

      if (!attachPlaybackStream()) {
        console.warn(BRIDGE_TAG, "Playback attach failed", { reason });
        setRouted(false);
        setRoutingError("Bridge stream has no live audio tracks");
        return;
      }

      try {
        await el.play();
        if (cancelled) return;
        stalledCycles = 0;
        setRouted(true);
        setRoutingError(null);
        logState(`playing (${reason})`);
      } catch (err) {
        if (cancelled) return;
        console.error(BRIDGE_TAG, `Play failed during ${reason}:`, err);
        setRouted(false);
        setRoutingError("Click anywhere to start bridge output");
        armUnlockRetry(() => {
          void ensurePlayback("user gesture retry");
        });
      }
    };

    const handlePlaying = () => logState("event: playing");
    const handleCanPlay = () => logState("event: canplay");
    const handlePause = () => logState("event: pause");
    const handleWaiting = () => logState("event: waiting");
    const handleStalled = () => {
      console.warn(BRIDGE_TAG, "event: stalled");
      void ensurePlayback("stalled event");
    };

    el.addEventListener("playing", handlePlaying);
    el.addEventListener("canplay", handleCanPlay);
    el.addEventListener("pause", handlePause);
    el.addEventListener("waiting", handleWaiting);
    el.addEventListener("stalled", handleStalled);

    console.log(BRIDGE_TAG, "Attaching live bridge stream", {
      streamId: bridgeStream.id,
      trackStates: initialTracks.map((track) => ({
        id: track.id,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
      })),
    });

    void ensurePlayback("initial attach");

    watchdogRef.current = setInterval(() => {
      if (cancelled || !el) return;

      const liveTracks = getLiveAudioTracks(bridgeStream);
      const hasLiveTracks = liveTracks.length > 0;
      const currentTime = el.currentTime;
      const timeAdvanced = currentTime > lastCurrentTimeRef.current + 0.01;
      const stalled = !el.paused && hasLiveTracks && !timeAdvanced && el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;

      lastCurrentTimeRef.current = currentTime;

      if (el.muted) {
        console.warn(BRIDGE_TAG, "Watchdog: element was muted, forcing unmute");
        el.muted = false;
      }

      if (el.volume < 1) {
        console.warn(BRIDGE_TAG, "Watchdog: volume was", el.volume, "forcing to 1");
        el.volume = 1;
      }

      console.debug(BRIDGE_TAG, "watchdog", {
        paused: el.paused,
        muted: el.muted,
        volume: el.volume,
        readyState: el.readyState,
        currentTime,
        hasLiveTracks,
        stalledCycles,
        trackStates: liveTracks.map((track) => ({
          id: track.id,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState,
        })),
      });

      if (!hasLiveTracks) {
        setRouted(false);
        setRoutingError("Bridge stream has no live audio tracks");
        return;
      }

      if (el.paused) {
        console.warn(BRIDGE_TAG, "Watchdog: restarting paused playback");
        void ensurePlayback("watchdog paused");
        return;
      }

      if (stalled) {
        stalledCycles += 1;
        if (stalledCycles >= STALLED_CYCLE_LIMIT) {
          console.warn(BRIDGE_TAG, "Watchdog: currentTime stalled, rebuilding playback stream");
          void ensurePlayback("watchdog stalled");
        }
        return;
      }

      stalledCycles = 0;
      setRouted(true);
      setRoutingError(null);
    }, WATCHDOG_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearUnlockRetry();
      if (watchdogRef.current) {
        clearInterval(watchdogRef.current);
        watchdogRef.current = null;
      }
      el?.removeEventListener("playing", handlePlaying);
      el?.removeEventListener("canplay", handleCanPlay);
      el?.removeEventListener("pause", handlePause);
      el?.removeEventListener("waiting", handleWaiting);
      el?.removeEventListener("stalled", handleStalled);
      if (el) {
        el.pause();
        el.srcObject = null;
      }
    };
  }, [bridgeStream, armUnlockRetry, clearUnlockRetry]);

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
        if (audioRef.current.parentNode) audioRef.current.parentNode.removeChild(audioRef.current);
        audioRef.current = null;
      }
    };
  }, [clearUnlockRetry]);

  return { routed, routingError };
}
