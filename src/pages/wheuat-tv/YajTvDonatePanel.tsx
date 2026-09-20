import { useState } from "react";
import { HeartHandshake, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { WheuatTv, type WheuatTvItem } from "./wheuatTvStore";

const TIP_AMOUNTS = [100, 500, 1000, 2500, 5000];

/** "Support" panel for an uploaded/original title. Never rendered on Live TV. */
export function YajTvDonatePanel({ item, userId }: { item: WheuatTvItem; userId?: string }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState("");

  const send = async (cents: number) => {
    if (!userId) {
      toast({ title: "Sign in to support this creator" });
      return;
    }
    setBusy(true);
    try {
      await WheuatTv.donate(item.id, item.creator.id, cents);
      toast({
        title: "Thanks for supporting!",
        description: `$${(cents / 100).toFixed(2)} sent to ${item.creator.displayName} (preview until billing).`,
      });
      setCustom("");
    } catch (e: any) {
      toast({ title: "Couldn't send support", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const customCents = Math.round(Number(custom) * 100);
  const isOwner = userId === item.creator.id;

  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="mb-2.5 flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <HeartHandshake className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-white">Support {item.creator.displayName}</p>
          <p className="text-[11px] text-white/50">Tips go directly to the creator of this original.</p>
        </div>
      </div>

      {isOwner ? (
        <p className="text-center text-[12px] text-white/40">This is your upload — viewers support you from here.</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {TIP_AMOUNTS.map((cents) => (
              <button
                key={cents}
                type="button"
                disabled={busy}
                onClick={() => void send(cents)}
                className="rounded-full bg-primary px-3.5 py-2 text-[12.5px] font-bold text-primary-foreground disabled:opacity-50"
              >
                ${(cents / 100).toFixed(0)}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-white/40">$</span>
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                placeholder="Custom amount"
                className="h-10 w-full rounded-lg border border-white/15 bg-black/40 pl-7 pr-3 text-sm text-white outline-none placeholder:text-white/40"
              />
            </div>
            <button
              type="button"
              disabled={busy || !Number.isFinite(customCents) || customCents < 100}
              onClick={() => void send(customCents)}
              className="flex h-10 items-center gap-1.5 rounded-full bg-white px-3.5 text-[12px] font-bold text-black disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Send
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-white/30">Minimum $1 · Card capture coming soon — preview tips for now.</p>
        </>
      )}
    </div>
  );
}
