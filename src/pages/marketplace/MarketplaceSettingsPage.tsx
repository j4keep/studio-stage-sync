import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  ensureMarketplaceProfile,
  getMarketplaceProfile,
  updateMarketplaceProfile,
} from "@/lib/marketplace-api";
import MarketplaceSafetyTips from "@/components/marketplace/MarketplaceSafetyTips";

export default function MarketplaceSettingsPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [city, setCity] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [notifOffers, setNotifOffers] = useState(true);
  const [notifMessages, setNotifMessages] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    void (async () => {
      await ensureMarketplaceProfile(user.id);
      const p = await getMarketplaceProfile(user.id);
      setCity(p?.city || "");
      setDisplayName(p?.display_name || "");
      try {
        const raw = localStorage.getItem(`yaj_mp_notif_${user.id}`);
        if (raw) {
          const j = JSON.parse(raw);
          setNotifOffers(j.offers !== false);
          setNotifMessages(j.messages !== false);
        }
      } catch {
        /* ignore */
      }
    })();
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateMarketplaceProfile(user.id, { city, display_name: displayName });
      localStorage.setItem(
        `yaj_mp_notif_${user.id}`,
        JSON.stringify({ offers: notifOffers, messages: notifMessages }),
      );
      toast.success("Marketplace settings saved");
    } catch (e: any) {
      toast.error(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button type="button" onClick={() => nav("/marketplace/account")} className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-black">Marketplace settings</h1>
      </header>
      <div className="space-y-4 px-4 pt-4">
        <MarketplaceSafetyTips variant="panel" defaultOpen />
        <p className="text-xs text-muted-foreground">
          Separate from general YAJ notifications. Your Marketplace profile stays separate from your social profile.
        </p>
        <label className="block text-xs font-bold">Marketplace display name</label>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm" />
        <label className="block text-xs font-bold">Default location (city)</label>
        <input value={city} onChange={(e) => setCity(e.target.value)} className="h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm" />
        <Toggle label="Offer notifications" value={notifOffers} onChange={setNotifOffers} />
        <Toggle label="Message notifications" value={notifMessages} onChange={setNotifMessages} />
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="h-12 w-full rounded-full bg-primary text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          Save
        </button>
      </div>    </div>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!value)} className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-3 py-3 text-sm font-semibold">
      {label}
      <span className={`h-6 w-10 rounded-full p-0.5 ${value ? "bg-primary" : "bg-muted"}`}>
        <span className={`block h-5 w-5 rounded-full bg-white shadow transition ${value ? "translate-x-4" : ""}`} />
      </span>
    </button>
  );
}
