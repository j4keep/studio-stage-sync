import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  CalendarClock,
  ChevronRight,
  CircleHelp,
  Gauge,
  Gem,
  MessageSquareWarning,
  Settings,
  Shield,
  Smile,
  Sparkles,
  Volume2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getYajAiVoiceLabel,
  loadYajAiActivity,
  loadYajAiPrefs,
  YAJ_AI_UPDATED_EVENT,
  type YajAiActivity,
  type YajAiPrefs,
} from "@/lib/yaj-ai-prefs";
import { toast } from "@/hooks/use-toast";

/**
 * Profile → YAJ AI Generator dashboard (Gemini account-menu style).
 * Hub for voice, avatar, conversation settings, and activity.
 */
export default function YajAiSettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<YajAiPrefs>(() => loadYajAiPrefs());
  const [activity, setActivity] = useState<YajAiActivity>(() => loadYajAiActivity());

  useEffect(() => {
    const sync = () => {
      setPrefs(loadYajAiPrefs());
      setActivity(loadYajAiActivity());
    };
    window.addEventListener(YAJ_AI_UPDATED_EVENT, sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener(YAJ_AI_UPDATED_EVENT, sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  const done = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/profile");
  };

  const email = user?.email || "YAJ AI Generator";
  const voiceLabel = getYajAiVoiceLabel();
  const lastOpen = activity.lastOpenAt
    ? new Date(activity.lastOpenAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : "Not yet";

  return (
    <div className="min-h-screen bg-[#f2f2f7] pb-28 text-stone-900 dark:bg-background dark:text-foreground">
      <header className="flex items-center justify-between gap-3 px-4 pb-3 pt-[max(0.85rem,env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] text-stone-500 dark:text-muted-foreground">{email}</p>
          <h1 className="text-[1.35rem] font-bold tracking-tight">YAJ AI Generator</h1>
        </div>
        <button
          type="button"
          onClick={done}
          className="rounded-full px-3 py-1.5 text-[15px] font-semibold text-sky-600"
        >
          Done
        </button>
      </header>

      <div className="space-y-3 px-3">
        <section className="overflow-hidden rounded-2xl bg-white shadow-sm dark:border dark:border-border dark:bg-card">
          <HubRow
            icon={<Sparkles className="h-4 w-4 text-violet-600" />}
            label="Open YAJ AI"
            trailing="Chat"
            onClick={() => navigate("/ask-yaj")}
          />
          <Divider />
          <HubRow
            icon={<Activity className="h-4 w-4" />}
            label="YAJ Apps Activity"
            onClick={() =>
              toast({
                title: "YAJ Apps Activity",
                description: `Chat opens: ${activity.chatOpens} · Voice sessions: ${activity.voiceSessions} · Last open: ${lastOpen}`,
              })
            }
          />
          <Divider />
          <HubRow
            icon={<Gauge className="h-4 w-4" />}
            label="Usage limits"
            onClick={() =>
              toast({
                title: "Usage limits",
                description:
                  "YAJ AI uses your plan’s fair-use limits for chat, voice, and images. Heavy image generation may pause briefly to keep quality high.",
              })
            }
          />
        </section>

        <section className="overflow-hidden rounded-2xl bg-white shadow-sm dark:border dark:border-border dark:bg-card">
          <HubRow
            icon={<Volume2 className="h-4 w-4" />}
            label="YAJ's voice"
            trailing={voiceLabel}
            onClick={() => navigate("/ask-yaj/conversation-settings")}
          />
          <Divider />
          <HubRow
            icon={<Smile className="h-4 w-4" />}
            label="Avatar"
            badge="Beta"
            onClick={() => navigate("/ask-yaj/avatar")}
          />
          <Divider />
          <HubRow
            icon={<Gem className="h-4 w-4 text-sky-600" />}
            label="Voice manager"
            trailing={voiceLabel}
            onClick={() => navigate("/ask-yaj/conversation-settings", { state: { openVoice: true } })}
          />
          <Divider />
          <HubRow
            icon={<CalendarClock className="h-4 w-4" />}
            label="Scheduled actions"
            onClick={() =>
              toast({
                title: "Coming soon",
                description: "Schedule YAJ reminders and coaching check-ins in a future update.",
              })
            }
          />
        </section>

        <section className="overflow-hidden rounded-2xl bg-white shadow-sm dark:border dark:border-border dark:bg-card">
          <HubRow
            icon={<Shield className="h-4 w-4" />}
            label="Privacy Help Hub"
            onClick={() =>
              toast({
                title: "Privacy Help Hub",
                description:
                  "Voice preferences stay on this device. Spoken replies are generated on demand and not used to train public models from your chats.",
              })
            }
          />
          <Divider />
          <HubRow
            icon={<Settings className="h-4 w-4" />}
            label="Settings"
            trailing={prefs.interruptLive ? "Live on" : "Live off"}
            onClick={() => navigate("/ask-yaj/conversation-settings")}
          />
          <Divider />
          <HubRow
            icon={<MessageSquareWarning className="h-4 w-4" />}
            label="Report a problem"
            onClick={() => navigate("/helpdesk")}
          />
          <Divider />
          <HubRow
            icon={<CircleHelp className="h-4 w-4" />}
            label="Help"
            onClick={() => navigate("/help")}
          />
        </section>

        <p className="px-2 text-[12px] leading-relaxed text-stone-500 dark:text-muted-foreground">
          Change YAJ’s voice, Live interrupt, and coach speed anytime. Settings apply to Ask YAJ
          conversations and Wellness coaching on this device.
        </p>
      </div>
    </div>
  );
}

function Divider() {
  return <div className="ml-[3.25rem] border-t border-stone-200/80 dark:border-border" />;
}

function HubRow({
  icon,
  label,
  trailing,
  badge,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  trailing?: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3.5 py-3.5 text-left active:bg-stone-50 dark:active:bg-muted/40"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#f2f2f7] text-stone-700 dark:bg-muted dark:text-foreground">
        {icon}
      </span>
      <span className="min-w-0 flex-1 text-[16px] font-normal">{label}</span>
      {badge ? (
        <span className="rounded-full bg-sky-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          {badge}
        </span>
      ) : null}
      {trailing ? (
        <span className="max-w-[7rem] truncate text-[14px] text-stone-400 dark:text-muted-foreground">
          {trailing}
        </span>
      ) : null}
      <ChevronRight className="h-4 w-4 shrink-0 text-stone-300 dark:text-muted-foreground" />
    </button>
  );
}
