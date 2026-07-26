import { MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface MessageUserButtonProps {
  userId?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  label?: string;
  className?: string;
  hideOtherYajPage?: boolean;
  iconOnly?: boolean;
}

/**
 * Drop-in "Message" button usable on any page.
 * Opens the Messages page and starts (or resumes) a chat with the given user.
 */
const MessageUserButton = ({
  userId,
  displayName,
  avatarUrl,
  label = "Message",
  className = "",
  hideOtherYajPage,
  iconOnly,
}: MessageUserButtonProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  if (!userId || userId === user?.id) return null;

  const open = () => {
    if (!user) {
      toast({ title: "Sign in to send messages" });
      navigate("/auth");
      return;
    }
    navigate("/messages", {
      state: {
        startWithUserId: userId,
        startWithProfile: { user_id: userId, display_name: displayName ?? null, avatar_url: avatarUrl ?? null },
        hideOtherYajPage,
      },
    });
  };

  return (
    <button
      type="button"
      onClick={open}
      aria-label={label}
      className={
        className ||
        (iconOnly
          ? "flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary"
          : "inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-2.5 text-xs font-semibold text-foreground hover:border-primary/40 hover:text-primary")
      }
    >
      <MessageCircle className="h-3.5 w-3.5" />
      {!iconOnly && label}
    </button>
  );
};

export default MessageUserButton;
