import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  Download,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  applyFeedVideoAudio,
  bindFeedMediaSession,
  forceIosAudioSessionToPlayback,
  unlockFeedAudioSession,
} from "@/lib/feed-video-playback";
import { toast } from "sonner";

type Props = {
  src: string;
  className?: string;
  title?: string;
};

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Desktop post video — gesture-safe unmute, bottom progress, no playback speed. */
export default function DesktopPostVideoPlayer({ src, className = "", title = "YAJ" }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const sessionCleanupRef = useRef<(() => void) | null>(null);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const syncMuteUi = () => {
    const v = videoRef.current;
    if (!v) return;
    setMuted(Boolean(v.muted || v.volume === 0));
  };

  /**
   * Phone-aligned audible start:
   * unlock → unmute DOM props → bind session → play() with no await beforehand
   * (awaiting canplay/load() drops the user gesture and Chrome forces mute).
   */
  const activateSoundPlayback = async (fromGesture = false) => {
    const v = videoRef.current;
    if (!v) return false;

    forceIosAudioSessionToPlayback();
    unlockFeedAudioSession();
    applyFeedVideoAudio(v, { muted: false, volume: 1 });
    setMuted(false);
    sessionCleanupRef.current?.();
    sessionCleanupRef.current = bindFeedMediaSession(v, { title, artist: "YAJ" });

    try {
      await v.play();
      setPlaying(true);
      setMuted(false);
      return !v.muted;
    } catch {
      // Autoplay policy: keep picture going muted, then unmute on next gesture.
      applyFeedVideoAudio(v, { muted: true, volume: 1 });
      try {
        await v.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
      setMuted(true);
      if (fromGesture) {
        // Gesture still active — try unmute again immediately after muted play starts.
        applyFeedVideoAudio(v, { muted: false, volume: 1 });
        try {
          await v.play();
          setMuted(v.muted);
          return !v.muted;
        } catch {
          setMuted(true);
          return false;
        }
      }
      return false;
    }
  };

  useLayoutEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.preload = "auto";
    v.currentTime = 0;
    let cancelled = false;
    void (async () => {
      const ok = await activateSoundPlayback(false);
      if (cancelled) return;
      if (!ok) syncMuteUi();
    })();
    return () => {
      cancelled = true;
      sessionCleanupRef.current?.();
      sessionCleanupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, title]);

  // Capture the next pointer on the player to unmute (user gesture).
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const onPointerDown = () => {
      const v = videoRef.current;
      if (!v) return;
      if (v.muted || v.volume === 0) {
        void activateSoundPlayback(true);
      }
    };
    shell.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => shell.removeEventListener("pointerdown", onPointerDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrent(v.currentTime || 0);
    const onMeta = () => setDuration(v.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onVolume = () => syncMuteUi();
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("durationchange", onMeta);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("volumechange", onVolume);
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("durationchange", onMeta);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("volumechange", onVolume);
    };
  }, [src]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void activateSoundPlayback(true);
    else v.pause();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.muted || v.volume === 0) {
      void activateSoundPlayback(true);
    } else {
      applyFeedVideoAudio(v, { muted: true, volume: 0 });
      setMuted(true);
    }
  };

  const toggleFullscreen = async () => {
    const el = shellRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch {
      toast.error("Fullscreen unavailable");
    }
  };

  const togglePiP = async () => {
    const v = videoRef.current;
    if (!v) return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else await v.requestPictureInPicture();
    } catch {
      toast.error("Picture in picture unavailable");
    }
  };

  const download = async () => {
    try {
      const res = await fetch(src, { mode: "cors", credentials: "omit" });
      const blob = res.ok ? await res.blob() : null;
      const url = blob ? URL.createObjectURL(blob) : src;
      const a = document.createElement("a");
      a.href = url;
      a.download = `yaj-post-${Date.now()}.mp4`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (blob) URL.revokeObjectURL(url);
    } catch {
      window.open(src, "_blank", "noopener,noreferrer");
    }
  };

  const onSeek = (value: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = value;
    setCurrent(value);
  };

  const progress = duration > 0 ? Math.min(1, current / duration) : 0;

  return (
    <div
      ref={shellRef}
      className={`relative h-full w-full overflow-hidden bg-black ${className}`}
    >
      <video
        ref={videoRef}
        src={src}
        playsInline
        autoPlay
        loop
        preload="auto"
        controls={false}
        className="h-full w-full object-contain"
        onClick={togglePlay}
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10">
        <div className="pointer-events-auto flex items-center gap-2 bg-gradient-to-t from-black/75 to-transparent px-3 pb-3.5 pt-10 text-white">
          <button
            type="button"
            onClick={togglePlay}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/15"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="h-4 w-4 fill-white" /> : <Play className="h-4 w-4 fill-white" />}
          </button>
          <span className="min-w-[72px] text-[11px] tabular-nums text-white/90">
            {formatTime(current)} / {formatTime(duration)}
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={toggleMute}
            className={`flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/15 ${
              muted ? "text-white/45" : "text-white"
            }`}
            aria-label={muted ? "Unmute" : "Mute"}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/15"
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => void togglePiP()}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/15"
            aria-label="Picture in picture"
          >
            <PictureInPicture2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void download()}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-white/15"
            aria-label="Download"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>

        <div className="pointer-events-auto relative h-1.5 w-full bg-white/25">
          <div className="absolute inset-y-0 left-0 bg-white" style={{ width: `${progress * 100}%` }} />
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.05}
            value={Math.min(current, duration || 0)}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label="Seek"
          />
        </div>
      </div>
    </div>
  );
}
