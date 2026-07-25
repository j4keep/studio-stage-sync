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
  armFeedAudioPlayback,
  forceIosAudioSessionToPlayback,
  playFeedVideo,
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

/** Desktop post video: custom chrome with sound, fullscreen, PiP, download — no playback speed. */
export default function DesktopPostVideoPlayer({ src, className = "", title = "YAJ" }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useLayoutEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    forceIosAudioSessionToPlayback();
    unlockFeedAudioSession();
    const cleanup = armFeedAudioPlayback(v, { title, artist: "YAJ" }, 1);
    applyFeedVideoAudio(v, { muted: false, volume: 1 });
    v.currentTime = 0;

    let cancelled = false;
    void (async () => {
      const ok = await playFeedVideo(v, { title, artist: "YAJ" }, { muted: false });
      if (cancelled) return;
      if (ok && !v.muted) {
        setMuted(false);
        setPlaying(true);
        return;
      }
      // Autoplay may force mute — play muted then immediately unmute while activation may still apply.
      applyFeedVideoAudio(v, { muted: true, volume: 1 });
      try {
        await v.play();
      } catch {
        /* ignore */
      }
      if (cancelled) return;
      applyFeedVideoAudio(v, { muted: false, volume: 1 });
      setMuted(v.muted);
      setPlaying(!v.paused);
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [src, title]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrent(v.currentTime || 0);
    const onMeta = () => setDuration(v.duration || 0);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onVolume = () => setMuted(v.muted || v.volume === 0);
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

  const ensureSound = () => {
    const v = videoRef.current;
    if (!v) return;
    forceIosAudioSessionToPlayback();
    unlockFeedAudioSession();
    applyFeedVideoAudio(v, { muted: false, volume: 1 });
    setMuted(false);
    void v.play().catch(() => {});
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      ensureSound();
    } else {
      v.pause();
    }
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    if (muted || v.muted) {
      ensureSound();
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

  return (
    <div
      ref={shellRef}
      className={`relative flex h-full max-h-full w-full items-center justify-center overflow-hidden bg-black ${className}`}
    >
      <video
        ref={videoRef}
        src={src}
        playsInline
        autoPlay
        loop
        controls={false}
        className="max-h-full max-w-full object-contain"
        onClick={togglePlay}
      />

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-3 pb-2.5 pt-10">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.05}
          value={Math.min(current, duration || 0)}
          onChange={(e) => onSeek(Number(e.target.value))}
          className="mb-2 h-1 w-full cursor-pointer accent-white"
          aria-label="Seek"
        />
        <div className="flex items-center gap-2 text-white">
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
      </div>
    </div>
  );
}
