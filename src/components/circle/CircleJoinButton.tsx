import { useState } from "react";
import { Check, Clock, Loader2, Lock } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Circle, CircleMember, leaveCircle, requestToJoin } from "@/lib/circles";

type Props = {
  circle: Circle;
  userId: string;
  membership: CircleMember | null;
  isOwner: boolean;
  onChanged: () => void;
};

export default function CircleJoinButton({ circle, userId, membership, isOwner, onChanged }: Props) {
  const [busy, setBusy] = useState(false);

  if (isOwner) {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-muted px-4 py-2 text-[12.5px] font-bold text-muted-foreground">
        <Check className="h-3.5 w-3.5" /> You own this Circle
      </span>
    );
  }

  if (membership?.status === "approved") {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await leaveCircle(circle.id, userId);
            onChanged();
          } catch (e: any) {
            toast({ title: "Could not leave", description: e.message, variant: "destructive" });
          } finally {
            setBusy(false);
          }
        }}
        className="flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-[12.5px] font-bold active:scale-95"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5 text-emerald-500" />}
        Member · Leave
      </button>
    );
  }

  if (membership?.status === "pending") {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-muted px-4 py-2 text-[12.5px] font-bold text-muted-foreground">
        <Clock className="h-3.5 w-3.5" /> Request pending
      </span>
    );
  }

  if (membership?.status === "blocked") {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-muted px-4 py-2 text-[12.5px] font-bold text-muted-foreground opacity-70">
        <Lock className="h-3.5 w-3.5" /> You can't join this Circle
      </span>
    );
  }

  if (circle.is_paid) {
    return (
      <button
        type="button"
        disabled
        title="Payment setup coming soon"
        className="flex items-center gap-1.5 rounded-full bg-amber-500/20 px-4 py-2 text-[12.5px] font-black text-amber-700 opacity-80"
      >
        <Lock className="h-3.5 w-3.5" /> Subscribe — ${(circle.price_cents ?? 0) / 100}/mo (coming soon)
      </button>
    );
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const m = await requestToJoin(circle.id, userId, circle.requires_approval);
          toast({ title: m.status === "pending" ? "Request sent" : "You're in!" });
          onChanged();
        } catch (e: any) {
          toast({ title: "Could not join", description: e.message, variant: "destructive" });
        } finally {
          setBusy(false);
        }
      }}
      className="flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-[12.5px] font-black text-primary-foreground active:scale-95 disabled:opacity-60"
    >
      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
      {circle.requires_approval ? "Ask to Join" : "Join Circle"}
    </button>
  );
}
