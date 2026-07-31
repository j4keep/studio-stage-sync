import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Info,
  Mic2,
  Smile,
  Sparkles,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import YajAiGeneratorIcon from "@/components/YajAiGeneratorIcon";
import YajVoicePickerSheet from "@/components/YajVoicePickerSheet";
import {
  getYajAiVoiceLabel,
  loadYajAiPrefs,
  patchYajAiPrefs,
  YAJ_AI_UPDATED_EVENT,
  type YajAiPrefs,
} from "@/lib/yaj-ai-prefs";
import { COACH_VOICE_SPEEDS } from "@/lib/wellness-move-coach";
import { YAJ_TTS_VOICES, type YajTtsVoiceId } from "@/lib/yaj-media";
import { toast } from "@/hooks/use-toast";

/**
 * Profile → YAJ AI Generator dashboard.
 * Voice + Live interrupt + coach speed — shared across Ask YAJ and Wellness.
 */
export default function YajAiSettingsPage() {
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<YajAiPrefs>(() => loadYajAiPrefs());
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    const sync = () => setPrefs(loadYajAiPrefs());
    window.addEventListener(YAJ_AI_UPDATED_EVENT, sync);
    return () => window.removeEventListener(YAJ_AI_UPDATED_EVENT, sync);
  }, []);

  const update = (patch: Partial<YajAiPrefs>) => {
    const next = patchYajAiPrefs(patch);
    setPrefs(next);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1200);
  };

  return (
    <div className="min-h-screen bg-muted/40 pb-28 text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/profile"))}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-black tracking-tight">YAJ AI Settings</h1>
            <p className="text-[11px] text-muted-foreground">Voice & generator preferences</p>
          </div>
          {savedFlash ? (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500 text-white">
              <Check className="h-4 w-4" />
            </span>
          ) : (
            <YajAiGeneratorIcon className="h-8 w-8" active />
          )}
        </div>
      </header>

      <div className="space-y-4 px-4 pt-5">
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <button
            type="button"
            onClick={() => navigate("/ask-yaj")}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/40"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Open YAJ AI Generator</p>
              <p className="text-xs text-muted-foreground">Chat or start a voice conversation</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <div className="mx-4 border-t border-border" />
          <button
            type="button"
            onClick={() => navigate("/ask-yaj/avatar")}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/40"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
              <Smile className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold">Avatar</p>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                  Beta
                </span>
              </div>
              <p className="text-xs text-muted-foreground">Capture a selfie video for your look</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <button
            type="button"
            onClick={() => setVoiceOpen(true)}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/40"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500/10">
              <Mic2 className="h-4 w-4 text-sky-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">YAJ&apos;s voice</p>
              <p className="text-xs text-muted-foreground">
                Choose how YAJ will sound · {getYajAiVoiceLabel()}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <div className="mx-4 border-t border-border" />
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Interrupt Live responses</p>
              <p className="text-xs text-muted-foreground">
                Talk (or tap) to interrupt YAJ in voice mode
              </p>
            </div>
            <Switch
              checked={prefs.interruptLive}
              onCheckedChange={(checked) => update({ interruptLive: checked })}
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="px-4 pb-2 pt-3.5">
            <p className="text-sm font-semibold">Coach speaking speed</p>
            <p className="text-xs text-muted-foreground">
              Used in Move, breathing, and sleep voice guides
            </p>
          </div>
          <div className="flex gap-2 px-4 pb-4">
            {COACH_VOICE_SPEEDS.map((s) => {
              const active = prefs.coachSpeed === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => update({ coachSpeed: s.id })}
                  className={`flex-1 rounded-xl border px-2 py-2.5 text-xs font-bold ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/40 text-muted-foreground"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <button
            type="button"
            onClick={() =>
              toast({
                title: "About YAJ AI",
                description:
                  "YAJ is your creative + wellness companion. Voice settings here apply to Ask YAJ conversations and Wellness coaching across the app.",
              })
            }
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-muted/40"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
              <Info className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">About</p>
              <p className="text-xs text-muted-foreground">How YAJ voice & generator work</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </section>

        <p className="px-1 pb-2 text-[11px] leading-relaxed text-muted-foreground">
          Voice changes apply immediately to Ask YAJ, Move coaching, breathing, and sleep guides on
          this device.
        </p>
      </div>

      <YajVoicePickerSheet
        open={voiceOpen}
        value={prefs.voice}
        onClose={() => setVoiceOpen(false)}
        onConfirm={(voice: YajTtsVoiceId) => {
          update({ voice });
          setVoiceOpen(false);
          const label = YAJ_TTS_VOICES.find((v) => v.id === voice)?.label ?? voice;
          toast({ title: "Voice updated", description: `${label} is now YAJ’s voice.` });
        }}
      />
    </div>
  );
}
