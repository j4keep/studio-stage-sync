import { useEffect, useMemo, useState } from "react";
import { Shield, Clock, BookOpen, MessageSquareHeart, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  formatRemaining,
  statusLabel,
  submitModerationAppeal,
  type ModerationSnapshot,
} from "@/lib/trust-safety";
import { toast } from "sonner";

type Props = {
  status: ModerationSnapshot;
  /** Soft mode = overlay/page while browsing; hard = full lockout */
  mode?: "full" | "page";
  onRestored?: () => void;
};

/**
 * Branded YAJ Community Timeout — calm cooldown, not a “jail”.
 */
export default function CommunityTimeoutScreen({ status, mode = "full", onRestored }: Props) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());
  const [appeal, setAppeal] = useState("");
  const [sending, setSending] = useState(false);
  const [appealSent, setAppealSent] = useState(false);
  const [showGuidelines, setShowGuidelines] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!status.moderation_until) return;
    if (new Date(status.moderation_until).getTime() <= now) {
      onRestored?.();
    }
  }, [now, status.moderation_until, onRestored]);

  const remaining = useMemo(
    () => formatRemaining(status.moderation_until),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status.moderation_until, now],
  );

  const title =
    status.moderation_status === "banned"
      ? "Account Closed"
      : status.moderation_status === "suspended"
        ? "Under Review"
        : "Community Timeout";

  const sendAppeal = async () => {
    if (!appeal.trim()) return;
    setSending(true);
    try {
      await submitModerationAppeal(appeal);
      setAppealSent(true);
      toast.success("Appeal sent to Customer Relations");
    } catch (e: any) {
      toast.error(e?.message || "Could not send appeal");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className={`${
        mode === "full" ? "fixed inset-0 z-[100]" : "min-h-[100dvh]"
      } flex flex-col items-center justify-center bg-[radial-gradient(ellipse_at_top,#1e293b_0%,#0a0a0f_55%,#000_100%)] px-5 py-10 text-white`}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-16 h-56 w-56 -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl animate-pulse" />
        <div className="absolute bottom-24 left-8 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-400/10 shadow-[0_0_40px_rgba(34,211,238,0.25)]">
            <Shield className="h-8 w-8 text-cyan-300" />
          </div>
          <p className="mb-1 text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300/90">
            YAJ Cooldown
          </p>
          <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            Your account is taking a short cooldown because we detected activity that violated our
            community guidelines.
          </p>
          <p className="mt-3 text-sm italic text-white/55">
            “Everyone makes mistakes. Take a little break, review the guidelines, and we’ll see you
            back soon.” — YAJ
          </p>
        </div>

        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
          <div className="flex items-start gap-3">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">
                Time remaining
              </p>
              <p className="text-sm font-semibold text-white">{remaining}</p>
              <p className="text-[11px] text-white/45">Status: {statusLabel(status.moderation_status)}</p>
            </div>
          </div>
          <div className="h-px bg-white/10" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">Reason</p>
            <p className="text-sm font-semibold text-white">
              {status.moderation_reason || "Community guidelines"}
            </p>
            {status.moderation_public_note ? (
              <p className="mt-1 text-xs text-white/55">{status.moderation_public_note}</p>
            ) : null}
          </div>
          <div className="h-px bg-white/10" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/45">
              What happens next
            </p>
            <p className="text-sm text-white/75">
              {status.moderation_status === "banned"
                ? "This account has been permanently closed for severe or repeated violations."
                : status.moderation_status === "suspended"
                  ? "A moderator is reviewing your account. You’ll be restored if no further action is needed."
                  : "Your account will automatically be restored when the timer ends if there are no further issues."}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2">
          <button
            type="button"
            onClick={() => {
              if (mode === "page") navigate("/terms");
              else setShowGuidelines((v) => !v);
            }}
            className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            <BookOpen className="h-4 w-4 text-cyan-300" />
            Review Community Guidelines
          </button>

          {showGuidelines ? (
            <div className="rounded-xl border border-white/15 bg-black/40 p-3 text-left text-xs leading-relaxed text-white/70">
              <p className="mb-2 font-semibold text-white">YAJ Community Guidelines</p>
              <ul className="list-disc space-y-1 pl-4">
                <li>No harassment, hate speech, or threats.</li>
                <li>No spam, scams, or impersonation.</li>
                <li>Respect copyright and privacy.</li>
                <li>No illegal or exploitative content.</li>
                <li>Repeated violations escalate: warning → cooldown → timeout → account closed.</li>
              </ul>
            </div>
          ) : null}

          {!appealSent ? (
            <div className="rounded-xl border border-white/15 bg-white/5 p-3">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                <MessageSquareHeart className="h-4 w-4 text-cyan-300" />
                Appeal Decision
              </p>
              <textarea
                value={appeal}
                onChange={(e) => setAppeal(e.target.value)}
                rows={3}
                placeholder="Tell us why this should be reviewed…"
                className="mb-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/35 outline-none focus:border-cyan-300/40"
              />
              <button
                type="button"
                disabled={sending || !appeal.trim()}
                onClick={() => void sendAppeal()}
                className="h-10 w-full rounded-lg bg-cyan-400 text-sm font-bold text-black disabled:opacity-50"
              >
                {sending ? "Sending…" : "Submit appeal"}
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-3 text-center text-sm text-cyan-100">
              Appeal received — Customer Relations will review it.
            </div>
          )}

          <button
            type="button"
            onClick={() => void signOut()}
            className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white/55 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
