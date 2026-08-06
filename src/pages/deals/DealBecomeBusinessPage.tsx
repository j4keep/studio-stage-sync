import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Store } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getOrCreateBusinessForUser, listMyBusinesses } from "@/lib/deals-api";
import { toast } from "sonner";

/** Shopper → merchant registration for Deals publishing. */
export default function DealBecomeBusinessPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [city, setCity] = useState("Hollywood");
  const [state, setState] = useState("FL");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!user) {
      toast.error("Sign in to become a business");
      nav("/auth");
      return;
    }
    if (!name.trim()) {
      toast.error("Enter your business name");
      return;
    }
    setSubmitting(true);
    try {
      const existing = await listMyBusinesses(user.id);
      if (existing.length) {
        toast.success("You’re already registered");
        nav("/deals/business");
        return;
      }
      const biz = await getOrCreateBusinessForUser(user.id, name.trim());
      // Best-effort location on the new/owned row
      const { supabase } = await import("@/integrations/supabase/client");
      await (supabase as any)
        .from("deal_businesses")
        .update({
          name: name.trim(),
          city: city.trim() || null,
          state: state.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", biz.id)
        .eq("owner_id", user.id);
      toast.success("Business registered — pending verification to go live");
      nav("/deals/business");
    } catch (e: any) {
      toast.error(e?.message || "Could not register business");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-28 text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur">
        <button
          type="button"
          onClick={() => nav(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-lg font-black">Become a Business</h1>
      </header>

      <div className="space-y-4 px-4 py-5">
        <div className="rounded-2xl bg-gradient-to-br from-orange-500/15 to-amber-400/10 p-4 ring-1 ring-orange-500/20">
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white">
            <Store className="h-5 w-5" />
          </div>
          <h2 className="text-base font-black">Reach local shoppers on YAJ Deals</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Post limited-time offers for food, shopping, beauty, services, and more. Verified businesses can publish
            active deals after review.
          </p>
        </div>

        <label className="block text-xs font-semibold">
          Business name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Maya’s Kitchen"
            className="mt-1 h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-semibold">
            City
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm"
            />
          </label>
          <label className="block text-xs font-semibold">
            State
            <input
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-border bg-muted px-3 text-sm"
            />
          </label>
        </div>

        <p className="text-[11px] text-muted-foreground">
          After you register you’ll open the Business Dashboard from Profile. Public deals stay pending until
          verification.
        </p>

        <button
          type="button"
          disabled={submitting}
          onClick={submit}
          className="h-12 w-full rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-sm font-black text-white disabled:opacity-50"
        >
          {submitting ? "Registering…" : "Create Business Profile"}
        </button>
      </div>
    </div>
  );
}
