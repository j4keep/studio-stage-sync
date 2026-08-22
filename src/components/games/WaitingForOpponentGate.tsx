import { Loader2 } from "lucide-react";

type Props = {
  show: boolean;
  opponentName: string;
  onCancel: () => void;
};

/**
 * Blocks the host from starting a multiplayer match until the invited player actually
 * accepts — mirrors PendingChallengeGate.tsx's overlay pattern (same full-screen backdrop,
 * same z-index) but for the other side of the challenge. Without this, the host could tap
 * Play immediately after sending an invite and play the whole match alone before the
 * invited player ever joined.
 */
export default function WaitingForOpponentGate({ show, opponentName, onCancel }: Props) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
      <div className="w-full max-w-[340px] rounded-3xl border border-white/15 bg-[hsl(234_45%_10%)] p-5 text-center text-white shadow-2xl">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="mt-3 text-[11px] font-black uppercase tracking-[0.2em] text-white/50">Challenge Sent</p>
        <h2 className="mt-1 text-lg font-black">Waiting for {opponentName} to join</h2>
        <p className="mt-1 text-xs text-white/60">The match starts the moment they accept.</p>
        <button
          type="button"
          onClick={onCancel}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-3 text-sm font-black text-white transition active:scale-[0.98]"
        >
          Cancel Challenge
        </button>
      </div>
    </div>
  );
}
