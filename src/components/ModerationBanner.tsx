import { Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useModerationStatus } from "@/hooks/use-moderation-status";
import { formatRemaining, statusLabel } from "@/lib/trust-safety";

/** Soft notice for warnings / browse-only Community Timeouts. */
export default function ModerationBanner() {
  const navigate = useNavigate();
  const { status, canPublish, isLockedOut, isWarned } = useModerationStatus();

  if (isLockedOut) return null;
  if (status.moderation_status === "active") return null;

  const softTimeout = !canPublish;
  if (!isWarned && !softTimeout) return null;

  return (
    <button
      type="button"
      onClick={() => navigate("/community-timeout")}
      className="flex w-full items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-2 text-left"
    >
      <Shield className="h-3.5 w-3.5 shrink-0 text-amber-600" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-bold text-foreground">
          {isWarned && canPublish
            ? "Community warning — please review the guidelines"
            : `Community Timeout · ${statusLabel(status.moderation_status)}`}
        </p>
        <p className="truncate text-[10px] text-muted-foreground">
          {status.moderation_reason || "Community guidelines"}
          {status.moderation_until ? ` · ${formatRemaining(status.moderation_until)} left` : ""}
          {" · Tap for details"}
        </p>
      </div>
    </button>
  );
}
