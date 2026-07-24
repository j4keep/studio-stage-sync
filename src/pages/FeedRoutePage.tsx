import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import FeedPage from "./FeedPage";
import { useIsDesktop } from "@/hooks/use-is-desktop";

const OPEN_KEY = "incognito-feed-window-open";
const MINIMIZED_KEY = "incognito-feed-window-minimized";

/**
 * Phone: full Feed page.
 * Desktop: open Incognito feed window and return Home.
 */
export default function FeedRoutePage() {
  const isDesktop = useIsDesktop();

  useEffect(() => {
    if (!isDesktop) return;
    try {
      sessionStorage.setItem(OPEN_KEY, "true");
      sessionStorage.setItem(MINIMIZED_KEY, "false");
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event("open-incognito-feed"));
  }, [isDesktop]);

  if (isDesktop) return <Navigate to="/" replace />;
  return <FeedPage />;
}
