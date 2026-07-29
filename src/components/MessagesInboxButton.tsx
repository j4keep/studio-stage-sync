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

/** Chat icon with the same red unread badge style as NotificationBell. */
export default function MessagesInboxButton({
  className = "relative flex h-9 w-9 items-center justify-center rounded-full bg-muted",
  iconClassName = "h-4 w-4 text-foreground",
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
    >
      <MessageCircle className={iconClassName} />
      {unread > 0 && (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </button>
  );
}
