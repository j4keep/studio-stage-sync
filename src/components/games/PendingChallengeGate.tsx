import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { respondToInvite } from "@/lib/games";
import { toast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

type Props = {
  gameId: string;
  userId: string | undefined;
  /** Whether the match is still waiting on the challenged player. */
  waiting: boolean;
  challengerName: string;
  onAccepted: () => void;
};

/**
 * Shows the invited player an Accept / Decline card whenever they open a match that is
 * still waiting on them — same flow the pool table uses, shared by every game.
 */
export default function PendingChallengeGate({ gameId, userId, waiting, challengerName, onAccepted }: Props) {
  const navigate = useNavigate();
  const [inviteId, setInviteId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!waiting || !userId) {
      setInviteId(null);
      return;
    }
    void (supabase as any)
      .from("game_invites")
      .select("id")
      .eq("game_id", gameId)
      .eq("to_user_id", userId)
      .eq("status", "pending")
      .maybeSingle()
      .then(({ data }: any) => setInviteId(data?.id ?? null));
  }, [gameId, userId, waiting]);

  if (!waiting || !inviteId) return null;

  const answer = async (accept: boolean) => {
    setBusy(true);
    try {
      await respondToInvite(inviteId, accept);
      if (accept) {
        toast({ title: "Challenge accepted — good luck!" });
        onAccepted();
      } else {
        toast({ title: "Challenge declined" });
        navigate("/games");
      }
    } catch (e: any) {
      toast({ title: "Could not respond", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
      <div className="w-full max-w-[340px] rounded-3xl border border-white/15 bg-[hsl(234_45%_10%)] p-5 text-center text-white shadow-2xl">
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/50">Challenge</p>
        <h2 className="mt-2 text-lg font-black">{challengerName} challenged you</h2>
        <p className="mt-1 text-xs text-white/60">Accept to start playing right now.</p>
        <div className="mt-5 space-y-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void answer(true)}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-black text-primary-foreground transition active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Accept & Play
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void answer(false)}
            className="flex w-full items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-3 text-sm font-black text-white transition active:scale-[0.98] disabled:opacity-60"
          >
            <X className="h-4 w-4" /> Decline
          </button>
        </div>
      </div>
    </div>
  );
}
