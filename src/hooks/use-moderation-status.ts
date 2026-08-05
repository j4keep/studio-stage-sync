import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  blocksAppAccess,
  blocksPublishing,
  EMPTY_MODERATION,
  refreshMyModerationStatus,
  type ModerationSnapshot,
} from "@/lib/trust-safety";

export function useModerationStatus() {
  const { user } = useAuth();
  const [status, setStatus] = useState<ModerationSnapshot>(EMPTY_MODERATION);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setStatus(EMPTY_MODERATION);
      setLoading(false);
      return EMPTY_MODERATION;
    }
    try {
      const next = await refreshMyModerationStatus();
      setStatus(next);
      return next;
    } catch {
      setStatus(EMPTY_MODERATION);
      return EMPTY_MODERATION;
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  return {
    status,
    loading,
    refresh,
    isLockedOut: blocksAppAccess(status.moderation_status),
    canPublish: !blocksPublishing(status.moderation_status),
    isWarned: status.moderation_status === "warned",
  };
}
