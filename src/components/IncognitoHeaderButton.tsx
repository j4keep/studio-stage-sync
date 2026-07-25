import { Eye } from "lucide-react";

/** Opens the floating Incognito feed window (listens in IncognitoFeedWindow). */
export function openIncognitoFeed() {
  try {
    sessionStorage.setItem("incognito-feed-window-open", "true");
    sessionStorage.setItem("incognito-feed-window-minimized", "false");
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event("open-incognito-feed"));
}

export default function IncognitoHeaderButton({ className = "" }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={openIncognitoFeed}
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-muted text-foreground hover:bg-muted/80 lg:h-10 lg:w-10 ${className}`}
      aria-label="Open Incognito feed"
      title="Incognito feed"
    >
      <Eye className="h-4 w-4 lg:h-5 lg:w-5" />
    </button>
  );
}
