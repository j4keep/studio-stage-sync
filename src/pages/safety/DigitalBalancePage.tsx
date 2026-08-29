import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Coffee, Moon, Timer } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useSafetyBalance } from "@/hooks/useSafetyBalance";
import {
  detoxUntilFromChoice,
  effectiveSocialMinutesUsed,
  formatMinutes,
  isDetoxActive,
  TEEN_DEFAULT_DAILY_LIMIT_MINUTES,
  TEEN_DEFAULT_REMINDER_MINUTES,
} from "@/lib/safety-balance";
import { toast } from "@/hooks/use-toast";

const LIMIT_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Off", value: null },
  { label: "30 min", value: 30 },
  { label: "1 hr", value: 60 },
  { label: "1 hr 30", value: 90 },
  { label: "2 hr", value: 120 },
];

const REMINDER_OPTIONS: { label: string; value: number | null }[] = [
  { label: "Off", value: null },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "1 hr", value: 60 },
];

const DigitalBalancePage = () => {
  const navigate = useNavigate();
  const { policy, updatePolicy } = useSafetyBalance();
  const [customLimit, setCustomLimit] = useState("");
  const youth = Boolean(policy?.youth_mode);
  const used = policy ? effectiveSocialMinutesUsed(policy) : 0;
  const detox = policy ? isDetoxActive(policy) : false;

  const quietLabel = useMemo(() => {
    if (!policy?.quiet_hours_enabled) return "Off";
    const s = (policy.quiet_hours_start || "").slice(0, 5);
    const e = (policy.quiet_hours_end || "").slice(0, 5);
    return `${s || "22:00"} – ${e || "06:00"}`;
  }, [policy]);

  const setLimit = async (value: number | null) => {
    if (youth && (value == null || value <= 0)) {
      toast({
        title: "Parent required",
        description: "Teen daily social limits stay on. A connected parent can adjust them.",
      });
      return;
    }
    await updatePolicy({ daily_social_limit_minutes: value });
  };

  const setReminder = async (value: number | null) => {
    if (youth && value == null) {
      toast({
        title: "Kept on for Youth",
        description: "Break reminders stay enabled for teen accounts.",
      });
      await updatePolicy({ continuous_reminder_minutes: TEEN_DEFAULT_REMINDER_MINUTES });
      return;
    }
    await updatePolicy({ continuous_reminder_minutes: value });
  };

  const toggleQuiet = async (on: boolean) => {
    if (youth && !on && !policy?.parent_account_id) {
      toast({
        title: "Quiet hours stay on",
        description: "A connected parent can change Youth quiet hours.",
      });
      return;
    }
    await updatePolicy({
      quiet_hours_enabled: on,
      quiet_hours_start: on ? policy?.quiet_hours_start || "22:00:00" : policy?.quiet_hours_start,
      quiet_hours_end: on ? policy?.quiet_hours_end || "06:00:00" : policy?.quiet_hours_end,
    });
  };

  const startDetox = async (choice: "tomorrow" | "3d" | "7d") => {
    const until = detoxUntilFromChoice(choice);
    await updatePolicy({ detox_until: until.toISOString() });
    toast({ title: "Social Detox active", description: "Feed and social discovery are paused." });
  };

  const endDetox = async () => {
    await updatePolicy({ detox_until: null });
    toast({ title: "Detox ended", description: "Social surfaces are available again." });
  };

  return (
    <div className="px-4 pt-6 pb-24 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => navigate("/safety")}
          className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-xl font-display font-bold text-foreground">
            {youth ? "YAJ Youth Balance" : "Digital Balance"}
          </h1>
          <p className="text-[11px] text-muted-foreground">
            {youth ? "Default protections for teens" : "Optional tools for healthier use"}
          </p>
        </div>
      </div>

      <div className="mb-5 p-4 rounded-2xl bg-card border border-border">
        <div className="flex items-center gap-2 mb-1 text-primary">
          <Timer className="w-4 h-4" />
          <p className="text-sm font-bold text-foreground">Today</p>
        </div>
        <p className="text-2xl font-display font-bold text-foreground">
          {formatMinutes(used)}
          {policy?.daily_social_limit_minutes != null && (
            <span className="text-sm font-medium text-muted-foreground">
              {" "}
              / {formatMinutes(policy.daily_social_limit_minutes)}
            </span>
          )}
        </p>
        <p className="text-[11px] text-muted-foreground mt-1">
          Counts Feed, Explore social browsing, Battles, Circles discovery, and Games — not Marketplace, Jobs, or bookings.
        </p>
      </div>

      <Section title="Daily Social Limit" icon={<Timer className="w-4 h-4" />}>
        <div className="flex flex-wrap gap-2">
          {LIMIT_OPTIONS.filter((o) => !(youth && o.value === null)).map((o) => {
            const active = (policy?.daily_social_limit_minutes ?? null) === o.value;
            return (
              <button
                key={o.label}
                type="button"
                onClick={() => void setLimit(o.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  active ? "gradient-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        {!youth && (
          <div className="mt-3 flex gap-2">
            <input
              type="number"
              min={1}
              placeholder="Custom minutes"
              value={customLimit}
              onChange={(e) => setCustomLimit(e.target.value)}
              className="flex-1 rounded-lg bg-background border border-border px-3 py-2 text-sm"
            />
            <button
              type="button"
              className="px-3 py-2 rounded-lg bg-secondary text-xs font-semibold"
              onClick={() => {
                const n = Number(customLimit);
                if (!n || n < 1) return;
                void setLimit(n);
              }}
            >
              Set
            </button>
          </div>
        )}
        {youth && (
          <p className="text-[10px] text-muted-foreground mt-2">
            Default {TEEN_DEFAULT_DAILY_LIMIT_MINUTES} minutes. A verified parent can extend time from their dashboard.
          </p>
        )}
      </Section>

      <Section title="Continuous-use reminder" icon={<Coffee className="w-4 h-4" />}>
        <div className="flex flex-wrap gap-2">
          {REMINDER_OPTIONS.map((o) => {
            const active = (policy?.continuous_reminder_minutes ?? null) === o.value;
            return (
              <button
                key={o.label}
                type="button"
                onClick={() => void setReminder(o.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  active ? "gradient-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Quiet Hours" icon={<Moon className="w-4 h-4" />}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm text-foreground">Quiet nights</p>
            <p className="text-[10px] text-muted-foreground">{quietLabel}</p>
          </div>
          <Switch checked={Boolean(policy?.quiet_hours_enabled)} onCheckedChange={(v) => void toggleQuiet(v)} />
        </div>
        {policy?.quiet_hours_enabled && (
          <div className="flex gap-2">
            <label className="flex-1 text-[10px] text-muted-foreground">
              Start
              <input
                type="time"
                value={(policy.quiet_hours_start || "22:00").slice(0, 5)}
                disabled={youth && !policy.parent_account_id}
                onChange={(e) =>
                  void updatePolicy({ quiet_hours_start: `${e.target.value}:00` })
                }
                className="mt-1 w-full rounded-lg bg-background border border-border px-2 py-2 text-sm text-foreground"
              />
            </label>
            <label className="flex-1 text-[10px] text-muted-foreground">
              End
              <input
                type="time"
                value={(policy.quiet_hours_end || "06:00").slice(0, 5)}
                disabled={youth && !policy.parent_account_id}
                onChange={(e) => void updatePolicy({ quiet_hours_end: `${e.target.value}:00` })}
                className="mt-1 w-full rounded-lg bg-background border border-border px-2 py-2 text-sm text-foreground"
              />
            </label>
          </div>
        )}
      </Section>

      <Section title="Social Detox" icon={<Coffee className="w-4 h-4" />}>
        {detox ? (
          <div>
            <p className="text-sm text-foreground mb-2">Detox is active until {new Date(policy!.detox_until!).toLocaleString()}</p>
            <button
              type="button"
              onClick={() => void endDetox()}
              className="px-4 py-2 rounded-xl bg-secondary text-sm font-semibold"
            >
              End detox
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["Until tomorrow", "tomorrow"],
                ["3 days", "3d"],
                ["7 days", "7d"],
              ] as const
            ).map(([label, key]) => (
              <button
                key={key}
                type="button"
                onClick={() => void startDetox(key)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-secondary text-muted-foreground"
              >
                {label}
              </button>
            ))}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-2">
          Hides Feed and social discovery. Keeps messages, Marketplace, Local Help, Jobs, and settings.
        </p>
      </Section>

      {!youth && (
        <Section title="Who can message me">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["Everyone", "everyone"],
                ["Friends & approved", "friends_and_approved"],
                ["None", "none"],
              ] as const
            ).map(([label, value]) => (
              <button
                key={value}
                type="button"
                onClick={() => void updatePolicy({ dm_permission: value })}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  policy?.dm_permission === value
                    ? "gradient-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
};

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2 px-1">
        {icon && <span className="text-primary">{icon}</span>}
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      </div>
      <div className="p-3.5 rounded-xl bg-card border border-border">{children}</div>
    </div>
  );
}

export default DigitalBalancePage;
