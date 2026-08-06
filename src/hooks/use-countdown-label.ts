import { useEffect, useState } from "react";
import { formatCountdown, formatExpiresLabel } from "@/lib/deals";

/** Live-updating expiry label; ticks every 30s for urgency under 48h. */
export function useCountdownLabel(expiresAt: string | null | undefined) {
  const [label, setLabel] = useState(() => formatExpiresLabel(expiresAt));

  useEffect(() => {
    const tick = () => setLabel(formatExpiresLabel(expiresAt));
    tick();
    if (!expiresAt) return;
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0 || ms > 48 * 3_600_000) return;
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  return label;
}

export function usePreciseCountdown(expiresAt: string | null | undefined) {
  const [label, setLabel] = useState(() => formatCountdown(expiresAt));

  useEffect(() => {
    const tick = () => setLabel(formatCountdown(expiresAt));
    tick();
    if (!expiresAt) return;
    const ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return;
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  return label;
}
