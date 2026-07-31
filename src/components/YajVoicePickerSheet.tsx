import { useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import {
  playYajAudio,
  stopYajAudio,
  synthesizeYajVoice,
  unlockYajAudio,
  YAJ_TTS_VOICES,
  type YajTtsVoiceId,
} from "@/lib/yaj-media";

type Props = {
  open: boolean;
  value: YajTtsVoiceId;
  onClose: () => void;
  onConfirm: (voice: YajTtsVoiceId) => void;
};

const PREVIEW =
  "Hi, I'm Yaj. This is how I'll sound in conversations and wellness coaching.";

/**
 * Full-screen voice picker — Gemini-style list with preview + confirm.
 */
export default function YajVoicePickerSheet({ open, value, onClose, onConfirm }: Props) {
  const [selected, setSelected] = useState<YajTtsVoiceId>(value);
  const [previewing, setPreviewing] = useState<YajTtsVoiceId | null>(null);

  useEffect(() => {
    if (open) setSelected(value);
  }, [open, value]);

  useEffect(() => {
    if (!open) {
      stopYajAudio();
      setPreviewing(null);
    }
  }, [open]);

  if (!open) return null;

  const preview = async (id: YajTtsVoiceId) => {
    setSelected(id);
    unlockYajAudio();
    stopYajAudio();
    setPreviewing(id);
    try {
      const src = await synthesizeYajVoice(PREVIEW, id);
      playYajAudio(src, () => setPreviewing((cur) => (cur === id ? null : cur)));
    } catch {
      setPreviewing(null);
    }
  };

  const dirty = selected !== value;

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-white text-stone-900 dark:bg-background dark:text-foreground">
      <header className="flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <h1 className="flex-1 text-center text-[17px] font-semibold">Choose a voice</h1>
        <button
          type="button"
          onClick={() => {
            stopYajAudio();
            onClose();
          }}
          className="absolute right-4 top-[max(0.75rem,env(safe-area-inset-top))] flex h-9 w-9 items-center justify-center rounded-full bg-[#f2f2f7] dark:bg-muted"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-4">
        <ul className="space-y-1">
          {YAJ_TTS_VOICES.map((v) => {
            const active = selected === v.id;
            return (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => void preview(v.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-5 py-3.5 text-left transition ${
                    active
                      ? "bg-[#d6ebff] text-stone-900 dark:bg-sky-950/50 dark:text-sky-50"
                      : "text-stone-400 dark:text-muted-foreground"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-[22px] font-normal tracking-tight ${
                        active ? "text-stone-900 dark:text-foreground" : ""
                      }`}
                    >
                      {v.label}
                    </span>
                    {previewing === v.id ? (
                      <span className="block text-xs text-sky-700 dark:text-sky-300">Playing preview…</span>
                    ) : null}
                  </span>
                  {active ? <Check className="h-5 w-5 shrink-0 text-stone-900 dark:text-foreground" strokeWidth={2.5} /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <footer className="flex items-center justify-between gap-3 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          onClick={() => {
            stopYajAudio();
            onClose();
          }}
          className="px-2 py-2 text-[17px] font-normal text-stone-800 dark:text-foreground"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!dirty && !previewing}
          onClick={() => {
            stopYajAudio();
            onConfirm(selected);
          }}
          className={`min-w-[120px] rounded-full px-6 py-2.5 text-[17px] font-medium ${
            dirty
              ? "bg-stone-800 text-white dark:bg-primary dark:text-primary-foreground"
              : "bg-[#e5e5ea] text-white dark:bg-muted dark:text-muted-foreground"
          }`}
        >
          Confirm
        </button>
      </footer>
    </div>
  );
}
