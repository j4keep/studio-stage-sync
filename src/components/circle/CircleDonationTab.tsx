import { useState } from "react";
import { HeartHandshake, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Circle, donateToCircle } from "@/lib/circles";

const TIP_AMOUNTS = [100, 500, 1000, 2500, 5000];

type Props = {
  circle: Circle;
  userId?: string;
  canDonate: boolean;
};

/** Circle Donation tab — members tip the Circle owner directly. */
export default function CircleDonationTab({ circle, userId, canDonate }: Props) {
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState("");

  const send = async (cents: number) => {
    if (!userId) {
      toast({ title: "Sign in to donate", variant: "destructive" });
      return;
    }
    if (!canDonate) {
      toast({ title: "Join this Circle to donate", variant: "destructive" });
      return;
    }
    if (userId === circle.owner_id) {
      toast({ title: "This is your Circle", description: "Members donate to you from this tab." });
      return;
    }
    setBusy(true);
    try {
      await donateToCircle({
        circleId: circle.id,
        fromUserId: userId,
        toUserId: circle.owner_id,
        amountCents: cents,
      });
      toast({
        title: "Thanks for supporting!",
        description: `$${(cents / 100).toFixed(2)} sent to the Circle owner (preview until billing).`,
      });
      setCustom("");
    } catch (e: any) {
      toast({ title: "Couldn't donate", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const customCents = Math.round(Number(custom) * 100);

  return (
    <div className="space-y-4 px-4 py-5">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <HeartHandshake className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-black">Support this Circle</h2>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              Anyone who joins can donate here. Tips go to the Circle owner to help keep the community going.
            </p>
          </div>
        </div>
      </div>

      {!canDonate ? (
        <p className="text-center text-[13px] text-muted-foreground">Join this Circle to donate.</p>
      ) : userId === circle.owner_id ? (
        <p className="rounded-2xl border border-border bg-muted/40 px-4 py-6 text-center text-[13px] text-muted-foreground">
          You own this Circle. Members use this tab to send you support.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {TIP_AMOUNTS.map((cents) => (
              <button
                key={cents}
                type="button"
                disabled={busy}
                onClick={() => void send(cents)}
                className="rounded-full bg-primary px-4 py-2.5 text-[13px] font-black text-primary-foreground disabled:opacity-50"
              >
                ${(cents / 100).toFixed(0)}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                placeholder="Custom amount"
                className="h-11 w-full rounded-xl border border-border bg-card pl-7 pr-3 text-sm outline-none"
              />
            </div>
            <button
              type="button"
              disabled={busy || !Number.isFinite(customCents) || customCents < 100}
              onClick={() => void send(customCents)}
              className="flex h-11 items-center gap-1.5 rounded-full bg-foreground px-4 text-[12px] font-bold text-background disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Donate
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">Minimum $1 · Card capture coming soon — preview tips for now.</p>
        </>
      )}
    </div>
  );
}
