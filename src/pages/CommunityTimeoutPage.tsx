import { useNavigate } from "react-router-dom";
import CommunityTimeoutScreen from "@/components/CommunityTimeoutScreen";
import { useModerationStatus } from "@/hooks/use-moderation-status";

/** Soft entry for users in cooldown/timeout who can still browse. */
export default function CommunityTimeoutPage() {
  const navigate = useNavigate();
  const { status, refresh, canPublish, isLockedOut } = useModerationStatus();

  if (canPublish && !isLockedOut && status.moderation_status === "active") {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center px-6 text-center">
        <p className="text-sm font-semibold text-foreground">You’re all clear</p>
        <p className="mt-1 text-xs text-muted-foreground">No active Community Timeout on this account.</p>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="mt-4 rounded-xl gradient-primary px-4 py-2 text-xs font-bold text-primary-foreground"
        >
          Back home
        </button>
      </div>
    );
  }

  return (
    <CommunityTimeoutScreen
      status={status}
      mode="page"
      onRestored={() => {
        void refresh().then(() => navigate("/"));
      }}
    />
  );
}
