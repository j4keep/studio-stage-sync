import { useCallback, useEffect, useState } from "react";

export type ExpandPanelId = "remote" | "share" | "viewer" | "waveform" | "session";

export function useExpandablePanels() {
  const [expandId, setExpandId] = useState<ExpandPanelId | null>(null);

  const exitExpand = useCallback(() => setExpandId(null), []);

  const toggleExpand = useCallback((id: ExpandPanelId) => {
    setExpandId((cur) => (cur === id ? null : id));
  }, []);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") exitExpand();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [exitExpand]);

  return { expandId, setExpandId, exitExpand, toggleExpand };
}
