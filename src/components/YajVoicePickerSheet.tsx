import { useEffect, useState } from "react";
import { Check, Volume2, X } from "lucide-react";
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

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-background text-foreground">
      <header className="flex items-center justify-between px-4 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <h1 className="text-base font-semibold">Choose a voice</h1>
        <button
          type="button"
          onClick={() => {
            stopYajAudio();
            onClose();
          }}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-2">
        <ul className="space-y-1">
          {YAJ_TTS_VOICES.map((v) => {
            const active = selected === v.id;
            return (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => void preview(v.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition ${
                    active ? "bg-sky-100 text-stone-900 dark:bg-sky-950/50 dark:text-sky-50" : "text-muted-foreground"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className={`block text-lg font-medium ${active ? "text-foreground" : ""}`}>
                      {v.label}
                    </span>
                    <span className="block text-xs opacity-70">
                      {previewing === v.id ? "Playing preview…" : v.blurb}
                    </span>
                  </span>
                  {active ? <Check className="h-5 w-5 shrink-0 text-foreground" /> : null}
                  {!active ? <Volume2 className="h-4 w-4 shrink-0 opacity-40" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <footer className="flex items-center justify-between gap-3 border-t border-border px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          onClick={() => {
            stopYajAudio();
            onClose();
          }}
          className="px-2 py-2 text-sm font-semibold text-muted-foreground"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => {
            stopYajAudio();
            onConfirm(selected);
          }}
          className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
        >
          Confirm
        </button>
      </footer>
    </div>
  );
}
