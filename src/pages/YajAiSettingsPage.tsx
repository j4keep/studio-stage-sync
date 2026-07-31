import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, Info, Smile, Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
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
 * Profile → YAJ AI Generator dashboard (Gemini Settings–style).
 * Voice + Live interrupt + coach speed — shared across Ask YAJ and Wellness.
 */
export default function YajAiSettingsPage() {
  const navigate = useNavigate();
  const [prefs, setPrefs] = useState<YajAiPrefs>(() => loadYajAiPrefs());
  const [voiceOpen, setVoiceOpen] = useState(false);

  useEffect(() => {
    const sync = () => setPrefs(loadYajAiPrefs());
    window.addEventListener(YAJ_AI_UPDATED_EVENT, sync);
    return () => window.removeEventListener(YAJ_AI_UPDATED_EVENT, sync);
  }, []);

  const update = (patch: Partial<YajAiPrefs>) => {
    setPrefs(patchYajAiPrefs(patch));
  };

  const done = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/profile");
  };

  return (
    <div className="min-h-screen bg-[#f2f2f7] pb-28 text-stone-900 dark:bg-background dark:text-foreground">
      <header className="flex items-start justify-between gap-3 px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
        <h1 className="text-[1.75rem] font-bold tracking-tight">YAJ AI Settings</h1>
        <button
          type="button"
          onClick={done}
          className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500 text-white shadow-sm"
          aria-label="Done"
        >
          <Check className="h-5 w-5" strokeWidth={2.5} />
        </button>
      </header>

      <div className="space-y-4 px-4 pt-3">
        {/* Generator + Avatar */}
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm dark:border dark:border-border dark:bg-card">
          <Row
            label="Open YAJ AI Generator"
            sub="Chat or start a voice conversation"
            onClick={() => navigate("/ask-yaj")}
            leading={<Sparkles className="h-4 w-4 text-violet-600" />}
          />
          <Divider />
          <Row
            label="Avatar"
            sub="Capture a selfie video for your look"
            badge="Beta"
            onClick={() => navigate("/ask-yaj/avatar")}
            leading={<Smile className="h-4 w-4" />}
          />
        </section>

        {/* Voice & Live */}
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm dark:border dark:border-border dark:bg-card">
          <Row
            label="YAJ's voice"
            sub={`Choose how YAJ will sound · ${getYajAiVoiceLabel()}`}
            onClick={() => setVoiceOpen(true)}
          />
          <Divider />
          <div className="flex items-center gap-3 px-4 py-3.5">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-medium">Interrupt Live responses</p>
              <p className="mt-0.5 text-[13px] leading-snug text-stone-500 dark:text-muted-foreground">
                Talk to interrupt YAJ in Live chats
              </p>
            </div>
            <Switch
              checked={prefs.interruptLive}
              onCheckedChange={(checked) => update({ interruptLive: checked })}
            />
          </div>
        </section>

        {/* Coach speed */}
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm dark:border dark:border-border dark:bg-card">
          <div className="px-4 pb-2 pt-3.5">
            <p className="text-[15px] font-medium">Coach speaking speed</p>
            <p className="mt-0.5 text-[13px] text-stone-500 dark:text-muted-foreground">
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
                  className={`flex-1 rounded-xl px-2 py-2.5 text-xs font-bold ${
                    active
                      ? "bg-sky-500 text-white"
                      : "bg-[#f2f2f7] text-stone-600 dark:bg-muted dark:text-muted-foreground"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* About */}
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm dark:border dark:border-border dark:bg-card">
          <Row
            label="About"
            sub="How YAJ voice & generator work"
            onClick={() =>
              toast({
                title: "About YAJ AI",
                description:
                  "YAJ is your creative + wellness companion. Voice settings here apply to Ask YAJ conversations and Wellness coaching across the app.",
              })
            }
            leading={<Info className="h-4 w-4" />}
          />
        </section>

        <p className="px-1 text-[12px] leading-relaxed text-stone-500 dark:text-muted-foreground">
          YAJ uses your voice choice for conversations and wellness coaching on this device.
        </p>
        <button
          type="button"
          className="px-1 text-left text-[12px] font-medium text-sky-600"
          onClick={() =>
            toast({
              title: "Voice & privacy",
              description:
                "Voice clips are generated on demand for replies. Preferences stay on this device.",
            })
          }
        >
          Learn more about how YAJ uses voice settings
        </button>
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

function Divider() {
  return <div className="ml-4 border-t border-stone-200/80 dark:border-border" />;
}

function Row({
  label,
  sub,
  onClick,
  badge,
  leading,
}: {
  label: string;
  sub?: string;
  onClick: () => void;
  badge?: string;
  leading?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-stone-50 dark:active:bg-muted/40"
    >
      {leading ? (
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f2f2f7] text-stone-700 dark:bg-muted dark:text-foreground">
          {leading}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-[15px] font-medium">{label}</span>
          {badge ? (
            <span className="rounded-full bg-sky-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
              {badge}
            </span>
          ) : null}
        </span>
        {sub ? (
          <span className="mt-0.5 block text-[13px] leading-snug text-stone-500 dark:text-muted-foreground">
            {sub}
          </span>
        ) : null}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-stone-300 dark:text-muted-foreground" />
    </button>
  );
}
