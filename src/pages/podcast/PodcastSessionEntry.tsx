import { useEffect } from "react";
import { usePodcastSession } from "./podcastSessionStore";

/**
 * Tiny route stub: visiting /tv/podcast just opens the persistent studio
 * (which is mounted at the App root via <GlobalPodcastSession />). The route
 * itself renders nothing — the overlay covers the screen.
 */
export default function PodcastSessionEntry() {
  const open = usePodcastSession((s) => s.open);
  useEffect(() => { open(); }, [open]);
  return null;
}
