import { useRef, useState } from "react";
import { X, Music, Upload, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { FEED_MUSIC_PRESETS, AUDIO_FILE_ACCEPT, playFeedMusicLoop, playUploadedAudio } from "@/lib/feed-music";
import type { PostEditorMeta } from "@/lib/post-editor";

interface Props {
  open: boolean;
  onClose: () => void;
  meta: PostEditorMeta;
  musicFile: File | null;
  musicPreviewUrl: string | null;
  onSelectPreset: (loopId: string) => void;
  onSelectFile: (file: File, previewUrl: string) => void;
  onClear: () => void;
  onVolumeChange: (volume: number) => void;
  onDurationChange: (durationSec: number) => void;
}

const SoundPickerSheet = ({
  open,
  onClose,
  meta,
  musicFile,
  musicPreviewUrl,
  onSelectPreset,
  onSelectFile,
  onClear,
  onVolumeChange,
  onDurationChange,
}: Props) => {
  const audioInputRef = useRef<HTMLInputElement>(null);
  const previewStopRef = useRef<(() => void) | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  const stopPreview = () => {
    previewStopRef.current?.();
    previewStopRef.current = null;
    setPreviewingId(null);
  };

  const handlePreset = (loopId: string) => {
    stopPreview();
    const player = playFeedMusicLoop(loopId, meta.music?.volume ?? 0.6);
    if (player) {
      previewStopRef.current = player.stop;
      setPreviewingId(loopId);
    }
    onSelectPreset(loopId);
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
    const player = playUploadedAudio(url, meta.music?.volume ?? 0.6);
    previewStopRef.current = player.stop;
    setPreviewingId("upload");
    onSelectFile(f, url);
    e.target.value = "";
  };

  const selectedLabel =
    musicFile?.name ||
    (meta.music?.loopId
      ? FEED_MUSIC_PRESETS.find((p) => p.id === meta.music?.loopId)?.label
      : null);

  const durationOptions = [
    { label: "15s", value: 15 },
    { label: "30s", value: 30 },
    { label: "60s", value: 60 },
    { label: "Full", value: 0 },
  ];
  const activeDuration = meta.music?.durationSec ?? 0;

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[90] bg-black/70"
        onClick={() => { stopPreview(); onClose(); }}
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="fixed bottom-0 left-0 right-0 z-[91] mx-auto max-w-lg rounded-t-2xl bg-zinc-950 border-t border-white/10 max-h-[70dvh] flex flex-col safe-area-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <button onClick={() => { stopPreview(); onClose(); }} className="text-white/70">
            <X className="w-5 h-5" />
          </button>
          <h3 className="text-sm font-bold text-white">Add sound</h3>
          <button
            onClick={() => { stopPreview(); onClose(); }}
            className="text-primary text-sm font-semibold"
          >
            Done
          </button>
        </div>

        {selectedLabel && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
            <Music className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs text-white truncate flex-1">{selectedLabel}</span>
            {previewingId && <span className="text-[10px] text-primary">Playing</span>}
            <button onClick={() => { stopPreview(); onClear(); }} className="text-[10px] text-white/50">
              Remove
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-2">Your audio</p>
            <button
              type="button"
              onClick={openAudioPicker}
              className="w-full flex items-center gap-3 rounded-xl border border-dashed border-white/25 bg-white/5 px-4 py-3 text-left active:bg-white/10"
            >
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Upload className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Upload MP3 or audio file</p>
                <p className="text-[11px] text-white/50">.mp3, .m4a, .wav, .aac</p>
              </div>
            </button>
            <input
              ref={audioInputRef}
              type="file"
              className="hidden"
              onChange={handleAudioFile}
            />
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40 mb-2">Sound library</p>
            <div className="space-y-1">
              {FEED_MUSIC_PRESETS.map((p) => {
                const active = meta.music?.loopId === p.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePreset(p.id)}
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      active ? "bg-primary/20 border border-primary/40" : "bg-white/5 border border-transparent hover:bg-white/10"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                      <Music className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-sm text-white flex-1">{p.label}</span>
                    {active && <Check className="w-4 h-4 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-white/10 space-y-3">
          {selectedLabel && (
            <div>
              <label className="text-[10px] text-white/50">Clip length</label>
              <div className="flex gap-2 mt-2">
                {durationOptions.map((d) => (
                  <button
                    key={d.label}
                    type="button"
                    onClick={() => onDurationChange(d.value)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${
                      activeDuration === d.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-white/10 text-white/80"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="text-[10px] text-white/50">Music volume</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={meta.music?.volume ?? 0.6}
              onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
              className="w-full mt-1"
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SoundPickerSheet;
