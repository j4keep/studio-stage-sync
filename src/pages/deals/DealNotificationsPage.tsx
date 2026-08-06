import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getNotificationPrefs,
  updateNotificationPrefs,
  type DealNotificationPrefs,
} from "@/lib/deals-api";
import { toast } from "sonner";

const TOGGLES: { key: keyof Omit<DealNotificationPrefs, "user_id">; label: string; hint: string }[] = [
  { key: "saved_ending_soon", label: "Saved deal ending soon", hint: "Reminders before a saved offer expires" },
  { key: "claimed_expiring_soon", label: "Claimed deal expiring soon", hint: "Reminders for claims you haven’t used" },
  { key: "followed_business_new", label: "New deal from a followed business", hint: "Opt-in only" },
  { key: "category_new", label: "New deal in a selected category", hint: "Opt-in only" },
  { key: "nearby_new", label: "New deal nearby", hint: "Opt-in only" },
  { key: "business_review_result", label: "Business deal approved or rejected", hint: "For publishers" },
  { key: "claim_limit_warning", label: "Claim-limit warning", hint: "When inventory is almost gone" },
  { key: "sold_out", label: "Deal sold out", hint: "When a saved deal sells out" },
];

export default function DealNotificationsPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<DealNotificationPrefs | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    void getNotificationPrefs(user.id)
      .then(setPrefs)
      .catch((e) => toast.error(e?.message || "Could not load preferences"));
  }, [user]);

  if (!user) {
    return (
      <div className="px-6 pt-20 text-center">
        <p className="font-bold">Sign in to manage Deals notifications</p>
        <button type="button" onClick={() => nav("/auth")} className="mt-4 text-sm font-semibold text-orange-600">
          Sign in
        </button>
      </div>
    );
  }

  const toggle = async (key: keyof Omit<DealNotificationPrefs, "user_id">) => {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setSaving(true);
    try {
      await updateNotificationPrefs(user.id, { [key]: next[key] });
    } catch (e: any) {
      setPrefs(prefs);
      toast.error(e?.message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => nav("/deals")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-black">Deals notifications</h1>
      </header>

      <p className="px-4 pt-3 text-xs text-muted-foreground">
        Promotional Deals alerts are off unless you opt in. Transactional claim and review updates can stay on.
      </p>

      <div className="mt-3 space-y-2 px-3">
        {!prefs ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Loading…</p>
        ) : (
          TOGGLES.map((t) => (
            <button
              key={t.key}
              type="button"
              disabled={saving}
              onClick={() => toggle(t.key)}
              className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-3 py-3 text-left"
            >
              <div className="min-w-0 pr-3">
                <p className="text-sm font-semibold">{t.label}</p>
                <p className="text-[11px] text-muted-foreground">{t.hint}</p>
              </div>
              <span
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                  prefs[t.key] ? "bg-orange-500" : "bg-muted"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                    prefs[t.key] ? "left-5" : "left-0.5"
                  }`}
                />
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
