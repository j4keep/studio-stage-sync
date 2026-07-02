import { useRef, useState, useEffect } from "react";
import { X, Music, Upload, Play, Pause, Mic } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { AUDIO_FILE_ACCEPT } from "@/lib/feed-music";
import {
  armFeedAudioPlayback,
  unlockFeedAudioSession,
} from "@/lib/feed-video-playback";
import { createTrimmedMusicPlayer, formatAudioTime, sameMediaElementSrc } from "@/lib/post-music-preview";
import type { PostEditorMeta } from "@/lib/post-editor";

/** Full-level preview while trimming — separate from post playback mix levels. */
const TRIM_PREVIEW_VOLUME = 1;

interface Props {
  open: boolean;
  onClose: () => void;
  onBeforeClose?: () => void;
  onSelectOriginalSound?: () => void;
  meta: PostEditorMeta;
  musicFile: File | null;
  musicPreviewUrl?: string | null;
  onSelectFile: (file: File, previewUrl: string, durationSec: number) => void;
  onTrimChange: (trimStart: number, trimEnd: number) => void;
  onClear: () => void;
}

const SoundPickerSheet = ({
  open,
  onClose,
  onBeforeClose,
  onSelectOriginalSound,
  meta,
  musicFile,
  musicPreviewUrl,
  onSelectFile,
  onTrimChange,
  onClear,
}: Props) => {
  const audioInputRef = useRef<HTMLInputElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const previewStopRef = useRef<(() => void) | null>(null);
  const previewSessionRef = useRef<(() => void) | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const sourceUrl = musicPreviewUrl || meta.music?.audioUrl || null;
  const duration = meta.music?.durationSec ?? 0;
  const trimStart = meta.music?.trimStart ?? 0;
  const trimEnd =
    meta.music?.trimEnd && meta.music.trimEnd > trimStart
      ? meta.music.trimEnd
      : duration > 0
        ? duration
        : 0;

  useEffect(() => {
    if (!open || !sourceUrl) return;
    const audio = previewAudioRef.current;
    if (!audio) return;
    if (!sameMediaElementSrc(audio, sourceUrl)) {
      audio.src = sourceUrl;
      audio.preload = "auto";
      try {
        audio.load();
      } catch {
        /* ignore */
      }
    }
  }, [open, sourceUrl]);

  useEffect(() => {
    if (!open) return;
    unlockFeedAudioSession();
  }, [open]);

  const stopPreview = () => {
    previewSessionRef.current?.();
    previewSessionRef.current = null;
    previewStopRef.current?.();
    previewStopRef.current = null;
    setPreviewing(false);
  };

  const previewTitle = () =>
    meta.music?.fileName?.replace(/\.[^.]+$/, "") ||
    musicFile?.name?.replace(/\.[^.]+$/, "") ||
    "Sound preview";

  const armLoudPreview = (audio: HTMLAudioElement) => {
    previewSessionRef.current?.();
    previewSessionRef.current = armFeedAudioPlayback(
      audio,
      { title: previewTitle() },
      TRIM_PREVIEW_VOLUME,
    );
  };

  const mountPreviewPlayer = (
    url: string,
    start: number,
    end: number,
    sourceDurationSec: number,
  ) => {
    const audio = previewAudioRef.current;
    if (!audio) return null;

    previewStopRef.current?.();
    previewStopRef.current = null;

    const player = createTrimmedMusicPlayer(
      url,
      {
        trimStart: start,
        trimEnd: end,
        sourceDurationSec,
        volume: TRIM_PREVIEW_VOLUME,
      },
      { audioElement: audio, retainElement: true },
    );
    previewStopRef.current = player.stop;
    return player;
  };

  /** Start playback in the same user-gesture turn — required for iOS media volume. */
  const startPreviewFromGesture = (): boolean => {
    unlockFeedAudioSession();

    if (!sourceUrl) {
      toast.message("Choose a sound first");
      return false;
    }

    const effectiveTrimEnd = trimEnd > trimStart ? trimEnd : duration > 0 ? duration : 0;
    const effectiveDuration = duration > 0 ? duration : effectiveTrimEnd;

    previewSessionRef.current?.();
    previewSessionRef.current = null;
    previewStopRef.current?.();
    previewStopRef.current = null;

    const player = mountPreviewPlayer(
      sourceUrl,
      trimStart,
      effectiveTrimEnd > trimStart ? effectiveTrimEnd : effectiveDuration,
      effectiveDuration,
    );
    if (!player) return false;

    const audio = player.audio;
    armLoudPreview(audio);

    const start = Math.max(0, trimStart);
    if (audio.readyState >= 1) {
      audio.currentTime = start;
    }

    try {
      void audio
        .play()
        .then(() => {
          armLoudPreview(audio);
          setPreviewing(true);
        })
        .catch(() => {
          void player.play().then((ok) => {
            if (ok) {
              armLoudPreview(player.audio);
              setPreviewing(true);
            } else {
              toast.error("Couldn't start preview — tap Preview again");
              stopPreview();
            }
          });
        });
      return true;
    } catch {
      toast.error("Couldn't start preview — tap Preview again");
      stopPreview();
      return false;
    }
  };

  const startPreviewAsync = async () => {
    unlockFeedAudioSession();

    if (!sourceUrl) {
      toast.message("Choose a sound first");
      return false;
    }

    const effectiveDuration =
      duration > 0
        ? duration
        : await new Promise<number>((resolve) => {
            const probe = previewAudioRef.current ?? new Audio(sourceUrl);
            probe.addEventListener(
              "loadedmetadata",
              () => {
                resolve(Number.isFinite(probe.duration) ? probe.duration : 0);
              },
              { once: true },
            );
            if (probe !== previewAudioRef.current) probe.load();
          });

    if (effectiveDuration <= 0) {
      toast.error("Couldn't read audio length — try another file");
      return false;
    }

    const effectiveTrimEnd = trimEnd > trimStart ? trimEnd : effectiveDuration;

    stopPreview();

    const player = mountPreviewPlayer(
      sourceUrl,
      trimStart,
      effectiveTrimEnd,
      effectiveDuration,
    );
    if (!player) return false;

    const ok = await player.play();
    if (ok) {
      armLoudPreview(player.audio);
      setPreviewing(true);
      return true;
    }

    toast.error("Couldn't start preview — tap Preview again");
    stopPreview();
    return false;
  };

  const closePicker = () => {
    stopPreview();
    onBeforeClose?.();
    onClose();
  };

  const selectOriginalSound = () => {
    stopPreview();
    onSelectOriginalSound?.();
    onBeforeClose?.();
    onClose();
  };

  const openAudioPicker = () => {
    stopPreview();
    const input = audioInputRef.current;
    if (!input) return;
    input.value = "";
    input.accept = AUDIO_FILE_ACCEPT;
    input.click();
  };

  const handleAudioFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const isAudio =
      f.type.startsWith("audio/") ||
      /\.(mp3|m4a|wav|aac|ogg|flac)$/i.test(f.name);
    if (!isAudio) return;

    stopPreview();
    const url = URL.createObjectURL(f);
    const audio = previewAudioRef.current;
    if (!audio) return;

    if (!sameMediaElementSrc(audio, url)) {
      audio.src = url;
      try {
        audio.load();
      } catch {
        /* ignore */
      }
    }

    const onMeta = () => {
      const dur = Number.isFinite(audio.duration) ? audio.duration : 0;
      onSelectFile(f, url, dur);
      mountPreviewPlayer(url, 0, dur, dur);
      armLoudPreview(audio);
      if (audio.paused) {
        void audio
          .play()
          .then(() => setPreviewing(true))
          .catch(() => {});
      } else {
        setPreviewing(true);
      }
    };

    audio.addEventListener("loadedmetadata", onMeta, { once: true });
    armLoudPreview(audio);

    void audio
      .play()
      .then(() => setPreviewing(true))
      .catch(() => {
        /* loadedmetadata will retry */
      });

    e.target.value = "";
  };

  const selectedLabel =
    musicFile?.name ||
    (meta.music?.fileName ?? (meta.music?.audioUrl ? "Added sound" : null));

  const setTrimStart = (next: number) => {
    const clamped = Math.max(0, Math.min(next, Math.max(0, trimEnd - 0.25)));
    onTrimChange(clamped, trimEnd);
  };

  const setTrimEnd = (next: number) => {
    const max = duration > 0 ? duration : next;
    const clamped = Math.max(trimStart + 0.25, Math.min(next, max));
    onTrimChange(trimStart, clamped);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[110] bg-black/70"
        onClick={closePicker}
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="fixed bottom-0 left-0 right-0 z-[111] mx-auto max-w-lg rounded-t-2xl bg-zinc-950 border-t border-white/10 max-h-[70dvh] flex flex-col safe-area-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <audio
          ref={previewAudioRef}
          className="fixed left-0 bottom-0 w-px h-px opacity-[0.01] pointer-events-none"
          playsInline
          preload="auto"
        />

        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <button
            onClick={closePicker}
            className="text-white/70"
          >
            <X className="w-5 h-5" />
          </button>
          <h3 className="text-sm font-bold text-white">Add sound</h3>
          <button
            onClick={closePicker}
            className="text-primary text-sm font-semibold"
          >
            Done
          </button>
        </div>

        {selectedLabel && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
            <Music className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs text-white truncate flex-1">{selectedLabel}</span>
            <button
              onClick={() => {
                stopPreview();
                onClear();
              }}
              className="text-[10px] text-white/50"
            >
              Remove
            </button>
          </div>
        )}

        {selectedLabel && duration > 0 && (
          <div className="mx-4 mt-3 rounded-xl bg-white/5 border border-white/10 px-4 py-3">
            <div className="flex items-center justify-between mb-2 gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">
                Trim sound
              </p>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-white/60 tabular-nums">
                  {formatAudioTime(trimStart)} – {formatAudioTime(trimEnd)}
                </span>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    if (previewing) {
                      stopPreview();
                      return;
                    }
                    startPreviewFromGesture();
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/20 border border-primary/40 text-primary text-[11px] font-semibold active:scale-95 transition-transform"
                >
                  {previewing ? (
                    <>
                      <Pause className="w-3 h-3" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="w-3 h-3" />
                      Preview
                    </>
                  )}
                </button>
              </div>
            </div>
            <div className="space-y-3">
              <label className="block">
                <span className="text-[10px] text-white/50 mb-1 block">Start</span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0.25, trimEnd - 0.25)}
                  step={0.1}
                  value={trimStart}
                  onChange={(e) => setTrimStart(Number(e.target.value))}
                  onPointerUp={() => {
                    if (previewing) void startPreviewAsync();
                  }}
                  className="w-full accent-primary"
                />
              </label>
              <label className="block">
                <span className="text-[10px] text-white/50 mb-1 block">End</span>
                <input
                  type="range"
                  min={trimStart + 0.25}
                  max={duration}
                  step={0.1}
                  value={trimEnd}
                  onChange={(e) => setTrimEnd(Number(e.target.value))}
                  onPointerUp={() => {
                    if (previewing) void startPreviewAsync();
                  }}
                  className="w-full accent-primary"
                />
              </label>
            </div>
            <p className="text-[10px] text-white/40 mt-2">
              Full track: {formatAudioTime(duration)} · Using {formatAudioTime(trimEnd - trimStart)}
            </p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-2">
            Record with
          </p>
          <button
            type="button"
            onClick={selectOriginalSound}
            className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left mb-4 active:scale-[0.99] transition-transform ${
              !selectedLabel
                ? "border-2 border-primary/60 bg-primary/10"
                : "border border-white/15 bg-white/5 active:bg-white/10"
            }`}
          >
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
              <Mic className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Original sound</p>
              <p className="text-[11px] text-white/50">Raw vocals only — no added song</p>
            </div>
          </button>

          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-2">
            Or add a song
          </p>
          <button
            type="button"
            onClick={openAudioPicker}
            className="w-full flex items-center gap-3 rounded-xl border border-dashed border-white/25 bg-white/5 px-4 py-3 text-left active:bg-white/10"
          >
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
              <Upload className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Choose audio file</p>
              <p className="text-[11px] text-white/50">.mp3, .m4a, .wav, .aac</p>
            </div>
          </button>
          <input
            ref={audioInputRef}
            type="file"
            className="hidden"
            onChange={handleAudioFile}
          />
          <p className="text-[11px] text-white/40 mt-4 leading-relaxed">
            Choose original sound for raw vocals, or upload a track and tap Preview to hear your trim before recording.
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SoundPickerSheet;
