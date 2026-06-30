import { useRef, useState } from "react";
import { X, Music, Upload } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { AUDIO_FILE_ACCEPT, playUploadedAudio } from "@/lib/feed-music";
import type { PostEditorMeta } from "@/lib/post-editor";

interface Props {
  open: boolean;
  onClose: () => void;
  meta: PostEditorMeta;
  musicFile: File | null;
  onSelectFile: (file: File, previewUrl: string) => void;
  onClear: () => void;
}

const SoundPickerSheet = ({
  open,
  onClose,
  meta,
  musicFile,
  onSelectFile,
  onClear,
}: Props) => {
  const audioInputRef = useRef<HTMLInputElement>(null);
  const previewStopRef = useRef<(() => void) | null>(null);
  const [previewing, setPreviewing] = useState(false);

  const stopPreview = () => {
    previewStopRef.current?.();
    previewStopRef.current = null;
    setPreviewing(false);
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
    const player = playUploadedAudio(url);
    previewStopRef.current = player.stop;
    setPreviewing(true);
    onSelectFile(f, url);
    e.target.value = "";
  };

  const selectedLabel =
    musicFile?.name ||
    (meta.music?.fileName ?? (meta.music?.audioUrl ? "Added sound" : null));

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[90] bg-black/70"
        onClick={() => {
          stopPreview();
          onClose();
        }}
      />
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 320 }}
        className="fixed bottom-0 left-0 right-0 z-[91] mx-auto max-w-lg rounded-t-2xl bg-zinc-950 border-t border-white/10 max-h-[55dvh] flex flex-col safe-area-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <button
            onClick={() => {
              stopPreview();
              onClose();
            }}
            className="text-white/70"
          >
            <X className="w-5 h-5" />
          </button>
          <h3 className="text-sm font-bold text-white">Add sound</h3>
          <button
            onClick={() => {
              stopPreview();
              onClose();
            }}
            className="text-primary text-sm font-semibold"
          >
            Done
          </button>
        </div>

        {selectedLabel && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2">
            <Music className="w-4 h-4 text-primary shrink-0" />
            <span className="text-xs text-white truncate flex-1">{selectedLabel}</span>
            {previewing && <span className="text-[10px] text-primary">Playing</span>}
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
            Sound plays over your video in the feed. Your camera recording stays natural — no mixing while you film.
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SoundPickerSheet;
