import { useRef, useState } from "react";
import { X, Music, Upload, Play, Pause } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { AUDIO_FILE_ACCEPT } from "@/lib/feed-music";
import { createTrimmedMusicPlayer, formatAudioTime } from "@/lib/post-music-preview";
import type { PostEditorMeta } from "@/lib/post-editor";

interface Props {
  open: boolean;
  onClose: () => void;
  onBeforeClose?: () => void;
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
  meta,
  musicFile,
  musicPreviewUrl,
  onSelectFile,
  onTrimChange,
  onClear,
}: Props) => {
  const audioInputRef = useRef<HTMLInputElement>(null);
  const previewStopRef = useRef<(() => void) | null>(null);
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

  const stopPreview = () => {
    previewStopRef.current?.();
    previewStopRef.current = null;
    setPreviewing(false);
  };

  const startPreview = async () => {
    if (!sourceUrl) {
      toast.message("Choose a sound first");
      return false;
    }

    const effectiveDuration =
      duration > 0
        ? duration
        : await new Promise<number>((resolve) => {
            const probe = new Audio(sourceUrl);
            probe.addEventListener(
              "loadedmetadata",
              () => {
                resolve(Number.isFinite(probe.duration) ? probe.duration : 0);
              },
              { once: true },
            );
            probe.load();
          });

    if (effectiveDuration <= 0) {
      toast.error("Couldn't read audio length — try another file");
      return false;
    }

    const effectiveTrimEnd =
      trimEnd > trimStart ? trimEnd : effectiveDuration;

    stopPreview();

    const player = createTrimmedMusicPlayer(sourceUrl, {
      trimStart,
      trimEnd: effectiveTrimEnd,
      sourceDurationSec: effectiveDuration,
      volume: meta.music?.volume ?? 1,
    });
    previewStopRef.current = player.stop;

    const ok = await player.play();
    if (ok) {
      setPreviewing(true);
      return true;
    }

    toast.error("Couldn't start preview — tap Preview again");
    stopPreview();
    return false;
  };

  const togglePreview = () => {
    if (previewing) {
      stopPreview();
      return;
    }
    void startPreview();
  };

  const closePicker = () => {
    stopPreview();
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
    const probe = new Audio(url);
    probe.addEventListener(
      "loadedmetadata",
      () => {
        const dur = Number.isFinite(probe.duration) ? probe.duration : 0;
        onSelectFile(f, url, dur);
        stopPreview();
        const player = createTrimmedMusicPlayer(url, {
          trimStart: 0,
          trimEnd: dur,
          sourceDurationSec: dur,
          volume: meta.music?.volume ?? 1,
        });
        previewStopRef.current = player.stop;
        void player.play().then((ok) => {
          if (ok) setPreviewing(true);
        });
      },
      { once: true },
    );
    probe.load();
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
                  onClick={togglePreview}
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
                    if (previewing) void startPreview();
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
                    if (previewing) void startPreview();
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
            Upload audio
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
            Tap Preview to hear your trim. The sound plays through your speaker while you record so you can lip-sync or vibe to the beat.
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SoundPickerSheet;
