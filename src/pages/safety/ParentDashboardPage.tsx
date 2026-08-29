import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Link2, Shield } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useSafetyBalance } from "@/hooks/useSafetyBalance";
import {
  AccountSafetyPolicy,
  effectiveSocialMinutesUsed,
  formatMinutes,
} from "@/lib/safety-balance";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const ParentDashboardPage = () => {
  const navigate = useNavigate();
  const {
    policy,
    createParentInvite,
    claimParentCode,
    listLinkedTeens,
    updateTeenPolicy,
    extendTeenSocialTime,
  } = useSafetyBalance();

  const [codeInput, setCodeInput] = useState("");
  const [teens, setTeens] = useState<(AccountSafetyPolicy & { display_name?: string })[]>([]);
  const [busy, setBusy] = useState(false);

  const refreshTeens = async () => {
    const list = await listLinkedTeens();
    const withNames = await Promise.all(
      list.map(async (t) => {
        const { data } = await supabase
          .from("profiles")
          .select("display_name")
          .eq("user_id", t.user_id)
          .maybeSingle();
        return { ...t, display_name: data?.display_name || "Youth account" };
      }),
    );
    setTeens(withNames);
  };

  useEffect(() => {
    void refreshTeens();
  }, [policy?.parent_account_id]);

  const onGenerate = async () => {
    setBusy(true);
    try {
      const next = await createParentInvite();
      if (next?.parent_link_code) {
        toast({ title: "Invite code ready", description: "Share it with a parent’s YAJ account." });
      }
    } catch (e: any) {
      toast({ title: "Could not create code", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const onClaim = async () => {
    if (!codeInput.trim()) return;
    setBusy(true);
    try {
      await claimParentCode(codeInput);
      toast({ title: "Connected", description: "You can manage Youth Balance settings." });
      setCodeInput("");
      await refreshTeens();
    } catch (e: any) {
      toast({ title: "Link failed", description: e?.message || "Invalid or expired code", variant: "destructive" });
    } finally {
      setBusy(false);
    }
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
          <h1 className="text-xl font-display font-bold text-foreground">Parent & Guardian</h1>
          <p className="text-[11px] text-muted-foreground">Controls — not private message surveillance</p>
        </div>
      </div>

      {policy?.youth_mode && (
        <div className="mb-6 p-4 rounded-2xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-primary" />
            <p className="text-sm font-bold text-foreground">Connect Parent or Guardian</p>
          </div>
          {policy.parent_account_id ? (
            <p className="text-xs text-muted-foreground">A parent account is already linked to this Youth account.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3">
                Generate a temporary code. Your parent signs in on their own YAJ account and enters it here.
              </p>
              {policy.parent_link_code ? (
                <div className="flex items-center gap-2 mb-3">
                  <code className="flex-1 text-center text-lg font-display font-bold tracking-[0.3em] py-3 rounded-xl bg-background border border-border">
                    {policy.parent_link_code}
                  </code>
                  <button
                    type="button"
                    className="p-3 rounded-xl bg-secondary"
                    onClick={() => {
                      void navigator.clipboard.writeText(policy.parent_link_code || "");
                      toast({ title: "Copied" });
                    }}
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onGenerate()}
                  className="w-full py-3 rounded-xl gradient-primary text-primary-foreground text-sm font-bold"
                >
                  Generate invite code
                </button>
              )}
            </>
          )}
        </div>
      )}

      {!policy?.youth_mode && (
        <div className="mb-6 p-4 rounded-2xl bg-card border border-border">
          <div className="flex items-center gap-2 mb-2">
            <Link2 className="w-4 h-4 text-primary" />
            <p className="text-sm font-bold text-foreground">Link a Youth account</p>
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Enter the code from your teen’s Safety Center. You will manage limits and quiet hours — not read private chats.
          </p>
          <div className="flex gap-2">
            <Input
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
              placeholder="ABC123"
              className="bg-background border-border tracking-widest uppercase"
              maxLength={8}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void onClaim()}
              className="px-4 rounded-xl gradient-primary text-primary-foreground text-sm font-bold"
            >
              Link
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {teens.map((teen) => {
          const used = effectiveSocialMinutesUsed(teen);
          const limit = teen.daily_social_limit_minutes ?? 90;
          return (
            <div key={teen.user_id} className="p-4 rounded-2xl bg-card border border-border">
              <p className="text-sm font-bold text-foreground mb-1">{teen.display_name} — YAJ Youth</p>
              <p className="text-xs text-muted-foreground mb-4">
                Today: Social time {formatMinutes(used)} / {formatMinutes(limit)}
              </p>

              <Control label="Daily Limit">
                <div className="flex flex-wrap gap-2">
                  {[60, 90, 120, 180].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() =>
                        void updateTeenPolicy(teen.user_id, { daily_social_limit_minutes: m }).then(refreshTeens)
                      }
                      className={`px-3 py-1 rounded-lg text-[10px] font-semibold ${
                        limit === m ? "gradient-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {formatMinutes(m)}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => void extendTeenSocialTime(30, teen.user_id).then(refreshTeens)}
                    className="px-3 py-1 rounded-lg text-[10px] font-semibold bg-secondary text-muted-foreground"
                  >
                    +30 min today
                  </button>
                </div>
              </Control>

              <Control label="Quiet Hours">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">Enabled</span>
                  <Switch
                    checked={teen.quiet_hours_enabled}
                    onCheckedChange={(v) =>
                      void updateTeenPolicy(teen.user_id, {
                        quiet_hours_enabled: v,
                        quiet_hours_start: teen.quiet_hours_start || "22:00:00",
                        quiet_hours_end: teen.quiet_hours_end || "06:00:00",
                      }).then(refreshTeens)
                    }
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={(teen.quiet_hours_start || "22:00").slice(0, 5)}
                    onChange={(e) =>
                      void updateTeenPolicy(teen.user_id, { quiet_hours_start: `${e.target.value}:00` }).then(
                        refreshTeens,
                      )
                    }
                    className="flex-1 rounded-lg bg-background border border-border px-2 py-2 text-sm"
                  />
                  <input
                    type="time"
                    value={(teen.quiet_hours_end || "06:00").slice(0, 5)}
                    onChange={(e) =>
                      void updateTeenPolicy(teen.user_id, { quiet_hours_end: `${e.target.value}:00` }).then(
                        refreshTeens,
                      )
                    }
                    className="flex-1 rounded-lg bg-background border border-border px-2 py-2 text-sm"
                  />
                </div>
              </Control>

              <Control label="Profile">
                <p className="text-xs text-foreground capitalize">{teen.profile_privacy}</p>
              </Control>
              <Control label="Location">
                <p className="text-xs text-foreground capitalize">{teen.location_permission}</p>
              </Control>
              <Control label="Messages">
                <p className="text-xs text-foreground">{teen.dm_permission.replace(/_/g, " ")}</p>
              </Control>
              <Control label="Games daily">
                <div className="flex flex-wrap gap-2">
                  {[30, 60, 90, null].map((m) => (
                    <button
                      key={String(m)}
                      type="button"
                      onClick={() =>
                        void updateTeenPolicy(teen.user_id, { games_daily_limit_minutes: m }).then(refreshTeens)
                      }
                      className={`px-3 py-1 rounded-lg text-[10px] font-semibold ${
                        (teen.games_daily_limit_minutes ?? null) === m
                          ? "gradient-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {m == null ? "Off" : formatMinutes(m)}
                    </button>
                  ))}
                </div>
              </Control>
            </div>
          );
        })}

        {!policy?.youth_mode && teens.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-8">No linked Youth accounts yet.</p>
        )}
      </div>
    </div>
  );
};

function Control({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{label}</p>
      {children}
    </div>
  );
}

export default ParentDashboardPage;
