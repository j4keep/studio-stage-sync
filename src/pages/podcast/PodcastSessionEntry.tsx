import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { usePodcastSession } from "./podcastSessionStore";

/**
 * Tiny route stub: visiting /tv/podcast just opens the persistent studio
 * (which is mounted at the App root via <GlobalPodcastSession />). The route
 * itself renders nothing — the overlay covers the screen.
 */
export default function PodcastSessionEntry() {
  const open = usePodcastSession((s) => s.open);
  const [params] = useSearchParams();
  const code = params.get("session");
  useEffect(() => { open(code); }, [open, code]);
  return null;
}
