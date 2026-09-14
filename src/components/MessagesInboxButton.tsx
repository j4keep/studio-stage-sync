import { MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useUnreadMessageCount } from "@/hooks/use-unread-message-count";

type Props = {
  className?: string;
  iconClassName?: string;
  /** Optional navigate state (e.g. marketplace context) */
  state?: Record<string, unknown>;
  "aria-label"?: string;
};

/** Shared Messages action used across the YAJ shell. */
export default function MessagesInboxButton({
  className = "relative flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-card text-foreground shadow-sm transition hover:bg-muted/70 active:scale-95",
  iconClassName = "h-[18px] w-[18px]",
  state,
  "aria-label": ariaLabel = "Messages",
}: Props) {
  const nav = useNavigate();
  const unread = useUnreadMessageCount();

  return (
    <button
      type="button"
      onClick={() => nav("/messages", state ? { state } : undefined)}
      className={className}
      aria-label={unread > 0 ? `${ariaLabel} (${unread} unread)` : ariaLabel}
      title={ariaLabel}
    >
      <MessageCircle className={iconClassName} />
      {unread > 0 && (
        <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold leading-none text-destructive-foreground ring-2 ring-background">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </button>
  );
}
