import { useEffect } from "react";
import { Navigate } from "react-router-dom";

const OPEN_KEY = "incognito-feed-window-open";
const MINIMIZED_KEY = "incognito-feed-window-minimized";

/** /feed no longer hosts a full-page feed — open the Incognito window on Home instead. */
export default function OpenIncognitoFeedRedirect() {
  useEffect(() => {
    try {
      sessionStorage.setItem(OPEN_KEY, "true");
      sessionStorage.setItem(MINIMIZED_KEY, "false");
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event("open-incognito-feed"));
  }, []);

  return <Navigate to="/" replace />;
}
